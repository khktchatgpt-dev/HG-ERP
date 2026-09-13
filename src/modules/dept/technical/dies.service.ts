import { BadRequest, Conflict, NotFound } from '@/server/http'
import { canAction, assertAction } from '@/modules/core/rbac/rbac.service'
import type { User } from '@/modules/core/users/users.repo'
import {
  dieCatalogRepo,
  dieWriteRepo,
  type DieEventType,
  type DieRow,
  type DieSpec,
  type DieWriteFields,
} from './dies.repo'
import type { DieCreateInput, DieEventInput, DieUpdateInput } from './dies.schema'

/**
 * Nghiệp vụ danh mục KHUÔN NHÔM (0190) — thêm / sửa / xoá + nhật ký đời khuôn.
 *
 * ⭐ ĐỔI HỒ SƠ LÀ TỰ ĐẺ MỘT DÒNG NHẬT KÝ. Đây là lý do tính năng này đáng làm:
 * trước 0190, cả đời một cái khuôn nằm trong ô ghi chú ("Hư · TD-DTBD05 (Mở Lại)
 * · Báo khuôn hư 23/2/2022 ĐỨC TOÀN MỞ LẠI 12/5/2022") — ba sự kiện, hai mốc
 * ngày, một mã thay thế trong một chuỗi không đếm được. Bắt người dùng vừa sửa
 * ô vừa nhớ ghi thêm nhật ký thì sau ba tuần không ai ghi nữa; nên hệ thống tự
 * ghi, và chỉ ghi khi có thứ THẬT SỰ đổi.
 *
 * Ba thay đổi sinh sự kiện, vì ba thứ đó là đời sống của khuôn:
 *   · trạng thái đổi  → broken / retired / replaced / reopened / note
 *   · nơi giữ đổi     → transferred (kèm từ đâu sang đâu)
 *   · kg/m đổi        → modified (kèm trước–sau)
 * Đổi tên chi tiết hay ghi chú thì KHÔNG — nhật ký đầy dòng vô nghĩa là nhật ký
 * không ai đọc.
 */

/** Cờ SỬA cho giao diện — cùng nguồn với guard ở service, không tự tính lại. */
export async function canEditDies(user: User): Promise<boolean> {
  return canAction(user, 'technical.die.update')
}

/** Trạng thái mới → loại sự kiện tương ứng. `null` = không đáng ghi riêng. */
const STATUS_EVENT: Record<DieRow['status'], DieEventType | null> = {
  broken: 'broken',
  retired: 'retired',
  replaced: 'replaced',
  active: 'reopened',
  pending: 'note',
  rarely_used: 'note',
  unknown: 'note',
}

const STATUS_LABEL: Record<DieRow['status'], string> = {
  pending: 'Chờ mở khuôn',
  active: 'Đang dùng',
  rarely_used: 'Ít dùng',
  broken: 'Khuôn hư',
  replaced: 'Khuôn cũ (đã thay)',
  retired: 'Đã bỏ',
  unknown: 'Chưa rõ tình trạng',
}

/** Bỏ các khoá `undefined` — gửi `undefined` xuống PostgREST là ghi đè thành null. */
function defined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(o).filter(([, v]) => v !== undefined),
  ) as Partial<T>
}

export const diesService = {
  async get(user: User, id: string): Promise<DieRow & DieSpec> {
    await assertAction(user, 'technical.die.view')
    const die = await dieCatalogRepo.getById(id)
    if (!die) throw NotFound('Không thấy khuôn này')
    return die
  },

  async create(user: User, input: DieCreateInput): Promise<string> {
    await assertAction(user, 'technical.die.create')

    /*
     * Chặn trùng mã ở TẦNG NGHIỆP VỤ, không ở DB: cột `code` cố ý không unique
     * (0106 — cùng mã có nhiều đời khác kg/m). Chặn ở đây thì báo được câu người
     * dùng hiểu và chỉ được sang hồ sơ đang có.
     */
    const dup = await dieWriteRepo.findByCode(input.code)
    if (dup) throw Conflict(`Mã khuôn “${dup.code}” đã có trong danh mục`)

    const id = await dieWriteRepo.insert({
      ...(defined(input) as DieWriteFields),
      code: input.code.trim(),
      // Khuôn mới do người dùng khai thì số liệu là của chính họ — không phải
      // hàng nạp từ bốn file cũ, nên không gắn cờ "cần rà".
      data_confidence: 'confirmed',
      source_note: 'Khai tay trên hệ thống',
    })

    /*
     * Sự kiện MỞ KHUÔN chỉ ghi khi có tiền khuôn: không có số tiền thì dòng nhật
     * ký chẳng nói gì hơn `created_at` của bản ghi, mà lại làm mọi khuôn mới đều
     * mở đầu bằng một dòng rỗng.
     */
    if (input.die_price != null) {
      await dieWriteRepo.insertEvent({
        die_id: id,
        event_type: 'opened',
        cost: input.die_price,
        to_holder: input.holder_name ?? null,
        content: 'Khai khuôn vào danh mục',
        created_by: user.id,
      })
    }
    return id
  },

  async update(user: User, id: string, input: DieUpdateInput): Promise<void> {
    await assertAction(user, 'technical.die.update')
    const before = await dieCatalogRepo.getById(id)
    if (!before) throw NotFound('Không thấy khuôn này')

    if (input.code != null && input.code.trim() !== before.code) {
      const dup = await dieWriteRepo.findByCode(input.code)
      if (dup && dup.id !== id)
        throw Conflict(`Mã khuôn “${dup.code}” đã có trong danh mục`)
    }

    const patch = defined(input) as DieWriteFields
    if (Object.keys(patch).length === 0) return
    await dieWriteRepo.update(id, patch)

    // ── Tự đẻ nhật ký cho ba thứ đáng ghi ────────────────────────────────
    if (input.status != null && input.status !== before.status) {
      const type = STATUS_EVENT[input.status] ?? 'note'
      await dieWriteRepo.insertEvent({
        die_id: id,
        event_type: type,
        content: `Tình trạng: ${STATUS_LABEL[before.status]} → ${STATUS_LABEL[input.status]}`,
        created_by: user.id,
      })
    }

    if (input.holder_name !== undefined && input.holder_name !== before.holder_name) {
      await dieWriteRepo.insertEvent({
        die_id: id,
        event_type: 'transferred',
        from_holder: before.holder_name,
        to_holder: input.holder_name ?? null,
        content: `Chuyển nơi giữ: ${before.holder_name ?? '(chưa ghi)'} → ${input.holder_name ?? '(chưa ghi)'}`,
        created_by: user.id,
      })
    }

    if (input.weight_per_m !== undefined && input.weight_per_m !== before.weight_per_m) {
      await dieWriteRepo.insertEvent({
        die_id: id,
        event_type: 'modified',
        weight_before: before.weight_per_m,
        weight_after: input.weight_per_m ?? null,
        content: 'Sửa kg/m trên hồ sơ',
        created_by: user.id,
      })
    }
  },

  /**
   * XOÁ HẲN — chỉ cho khi KHÔNG ai còn trỏ vào mã này.
   *
   * Dòng đơn mua và dòng định mức nhắc tới khuôn bằng TEXT (`die_code`,
   * `profile_code`), không FK. Nghĩa là xoá dòng khuôn không làm chúng gãy —
   * nó làm chúng MỒ CÔI: một dòng đơn ghi "TD-B108" mà tra không ra khuôn nào,
   * và không ai biết kg/m ở đó lấy từ đâu. Đó là thứ tệ hơn cả lỗi.
   *
   * Khuôn đã dùng rồi thì không xoá — đổi tình trạng sang "Đã bỏ" là đủ, và giữ
   * được lịch sử.
   */
  async remove(user: User, id: string): Promise<void> {
    await assertAction(user, 'technical.die.remove')
    const die = await dieCatalogRepo.getById(id)
    if (!die) throw NotFound('Không thấy khuôn này')

    const { poLines, parts } = await dieWriteRepo.referenceCount([
      die.code,
      ...die.legacy_codes,
    ])
    if (poLines > 0 || parts > 0) {
      const why = [
        poLines > 0 ? `${poLines} dòng đơn mua` : '',
        parts > 0 ? `${parts} dòng định mức` : '',
      ]
        .filter(Boolean)
        .join(' và ')
      throw BadRequest(
        `Không xoá được: còn ${why} đang ghi mã “${die.code}”. Đổi tình trạng sang “Đã bỏ” để giữ lịch sử.`,
      )
    }

    // Nhật ký có `on delete cascade` nên đi theo; ảnh mặt cắt thì `set null` —
    // file vẫn nằm trên Storage, tìm lại được (xem 0190 mục 5).
    await dieWriteRepo.remove(id)
  },

  /**
   * Đặt / bỏ ẢNH MẶT CẮT của khuôn.
   *
   * File đã được tải lên trước qua luồng 3 bước của `filesService` với
   * `parent: { kind: 'die', id }` — nên tới đây chỉ còn việc trỏ con trỏ.
   *
   * KHÔNG xoá file cũ (khác `/products`, nơi "một SP một ảnh, thay là xoá").
   * Lý do riêng của khuôn: ảnh hiện tại phần lớn là BẢN XỬ LÝ do
   * `khuon-images-enhance.mjs` sinh ra, còn bản gốc bóc từ file Excel vẫn nằm
   * cạnh nó cùng `die_id`. Xoá theo con trỏ là xoá mất một trong hai mà không ai
   * biết mình vừa mất bản nào — trong khi vài chục KB ảnh mồ côi thì vô hại.
   */
  async setImage(user: User, id: string, fileId: string | null): Promise<void> {
    await assertAction(user, 'technical.die.update')
    const die = await dieCatalogRepo.getById(id)
    if (!die) throw NotFound('Không thấy khuôn này')
    await dieWriteRepo.update(id, { image_file_id: fileId })
  },

  /** Ghi một dòng nhật ký bằng tay — cho những việc hệ thống không tự thấy. */
  async addEvent(user: User, id: string, input: DieEventInput): Promise<void> {
    await assertAction(user, 'technical.die.update')
    const die = await dieCatalogRepo.getById(id)
    if (!die) throw NotFound('Không thấy khuôn này')
    await dieWriteRepo.insertEvent({
      ...defined(input),
      die_id: id,
      // `event_type` là bắt buộc ở zod nên luôn có; nhắc lại tường minh để TS
      // không phải suy từ `Partial<>` của `defined()`.
      event_type: input.event_type,
      created_by: user.id,
    })
  },
}
