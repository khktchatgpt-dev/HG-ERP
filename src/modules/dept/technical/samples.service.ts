import { BadRequest, Forbidden, NotFound } from '@/server/http'
import { db } from '@/server/db'
import type { User } from '@/modules/core/users/users.repo'
import { isTechnicalStaff } from './technical.service'
import { samplesRepo, type SampleWithRefs } from './samples.repo'
import { loansRepo } from './loans.repo'
import {
  SAMPLE_STATUS_LABEL,
  type SampleCondition,
  type SampleCreateInput,
  type SampleListQuery,
  type SampleStatus,
  type SampleUpdateInput,
} from './samples.schema'

/**
 * Chuyển trạng thái hợp lệ: key = trạng thái hiện tại, value = được đi tới đâu.
 * Cùng pattern allow-map với PO (pos.service.ts:162).
 *
 * `on_loan` KHÔNG có ở value nào — vào trạng thái đó chỉ bằng cách ghi phiếu
 * mượn, ra khỏi nó chỉ bằng cách ghi trả (hoặc báo mất). Nếu cho đổi tay thì
 * `status` sẽ trôi khỏi sổ mượn, đúng cái rủi ro lớn nhất của thiết kế này.
 */
const ALLOWED: Record<SampleStatus, SampleStatus[]> = {
  in_showroom: ['maintenance', 'lost', 'disposed'],
  on_loan: ['lost'], // khách làm mất khi đang mượn
  maintenance: ['in_showroom', 'disposed', 'lost'],
  lost: ['in_showroom'], // tìm lại được
  disposed: [], // điểm cuối: thanh lý rồi thì không quay lại lưu thông
}

export function canTransition(from: SampleStatus, to: SampleStatus): boolean {
  return ALLOWED[from].includes(to)
}

async function assertTechnical(user: User): Promise<void> {
  if (!(await isTechnicalStaff(user))) {
    throw Forbidden('Chỉ phòng Kỹ thuật quản lý mẫu showroom')
  }
}

/**
 * Đồng bộ cờ cũ `technical_products.showroom_sample`.
 *
 * Cột đó (0026) vẫn đang bị đọc ở trang in LSX và production.repo, chưa xoá
 * được. Giữ nó ĐÚNG bằng cách suy từ bảng mẫu, thay vì để người dùng tick tay —
 * nếu không sẽ có hai nguồn sự thật cãi nhau.
 */
async function syncProductFlag(productId: string): Promise<void> {
  const has = await samplesRepo.productHasLiveSample(productId)
  const { error } = await db()
    .from('technical_products')
    .update({ showroom_sample: has })
    .eq('id', productId)
  if (error) console.error('[samples] sync showroom_sample failed:', error.message)
}

export const samplesService = {
  async list(
    _user: User,
    q: SampleListQuery,
  ): Promise<{ rows: SampleWithRefs[]; total: number }> {
    // Xem mở cho mọi NV đã đăng nhập — mẫu là tài sản chung, Sales cần tra xem
    // mẫu nào đang rảnh để dẫn khách (giống thư viện SP).
    const res = await samplesRepo.list(q)
    if (!q.overdue) return res
    const today = new Date().toISOString().slice(0, 10)
    const rows = res.rows.filter((r) => r.open_loan?.due_at && r.open_loan.due_at < today)
    return { rows, total: rows.length }
  },

  async get(_user: User, id: string): Promise<SampleWithRefs> {
    const s = await samplesRepo.findById(id)
    if (!s) throw NotFound('Không tìm thấy mẫu')
    return s
  },

  async stats(): Promise<Record<string, number>> {
    const [byStatus, overdue] = await Promise.all([
      samplesRepo.countsByStatus(),
      loansRepo.countOverdue(new Date().toISOString().slice(0, 10)),
    ])
    const total = Object.values(byStatus).reduce((a, b) => a + b, 0)
    return { ...byStatus, total, overdue }
  },

  /**
   * Tạo `quantity` hiện vật — 3 ghế giống nhau = 3 mẫu, 3 mã riêng.
   * `kind='product'` gắn SP trong thư viện; loại khác đứng độc lập với tên riêng.
   */
  async create(user: User, input: SampleCreateInput): Promise<{ codes: string[] }> {
    await assertTechnical(user)

    // Chỉ mẫu gắn SP mới cần product_id; loại độc lập bỏ trống (khớp 0062).
    const productId = input.kind === 'product' ? (input.product_id ?? null) : null
    if (input.kind === 'product') {
      const { data: product } = await db()
        .from('technical_products')
        .select('id')
        .eq('id', productId!)
        .maybeSingle()
      if (!product) throw NotFound('Không tìm thấy sản phẩm')
    }

    const codes: string[] = []
    for (let i = 0; i < input.quantity; i++) {
      const code = await samplesRepo.nextCode()
      const row = await samplesRepo.insert({
        code,
        kind: input.kind,
        product_id: productId,
        // Mẫu gắn SP lấy tên từ thư viện → để null; mẫu độc lập giữ tên riêng.
        name: input.kind === 'product' ? null : (input.name ?? null),
        category: input.kind === 'product' ? null : (input.category ?? null),
        source: input.kind === 'product' ? null : (input.source ?? null),
        condition: input.condition,
        location: input.location ?? null,
        acquired_at: input.acquired_at ?? null,
        note: input.note ?? null,
        created_by: user.id,
      })
      await samplesRepo.logEvent({
        sample_id: row.id,
        actor_id: user.id,
        action: 'created',
        after: { condition: row.condition, location: row.location },
      })
      codes.push(code)
    }
    if (productId) await syncProductFlag(productId)
    return { codes }
  },

  async update(user: User, id: string, input: SampleUpdateInput): Promise<void> {
    await assertTechnical(user)
    const before = await samplesRepo.findById(id)
    if (!before) throw NotFound('Không tìm thấy mẫu')

    // Tên/nhóm/nguồn chỉ sửa cho mẫu độc lập — mẫu gắn SP lấy từ thư viện, để nguyên.
    const ownFields =
      before.kind === 'product'
        ? {}
        : {
            name: input.name ?? before.name,
            category: input.category ?? null,
            source: input.source ?? null,
          }
    await samplesRepo.patch(id, {
      ...ownFields,
      location: input.location ?? null,
      acquired_at: input.acquired_at ?? null,
      note: input.note ?? null,
    })
    if (before.location !== (input.location ?? null)) {
      await samplesRepo.logEvent({
        sample_id: id,
        actor_id: user.id,
        action: 'location_changed',
        before: { location: before.location },
        after: { location: input.location ?? null },
      })
    }
  },

  async changeCondition(
    user: User,
    id: string,
    condition: SampleCondition,
    note: string | null,
  ): Promise<void> {
    await assertTechnical(user)
    const before = await samplesRepo.findById(id)
    if (!before) throw NotFound('Không tìm thấy mẫu')
    if (before.condition === condition) return

    await samplesRepo.patch(id, { condition })
    await samplesRepo.logEvent({
      sample_id: id,
      actor_id: user.id,
      action: 'condition_changed',
      before: { condition: before.condition },
      after: { condition },
      note,
    })
  },

  async changeStatus(
    user: User,
    id: string,
    to: SampleStatus,
    note: string | null,
  ): Promise<void> {
    await assertTechnical(user)
    const before = await samplesRepo.findById(id)
    if (!before) throw NotFound('Không tìm thấy mẫu')
    if (before.status === to) return

    if (!canTransition(before.status, to)) {
      throw BadRequest(
        `Không thể chuyển từ "${SAMPLE_STATUS_LABEL[before.status]}" sang "${SAMPLE_STATUS_LABEL[to]}"`,
      )
    }
    // Rời khỏi on_loan bằng đường này chỉ có thể là báo mất — đóng luôn phiếu
    // mượn, nếu không sổ sẽ mãi treo một lượt "chưa trả" cho mẫu đã mất.
    if (before.status === 'on_loan' && to === 'lost') {
      const open = await loansRepo.findOpenBySample(id)
      if (open) {
        await loansRepo.patch(open.id, {
          returned_at: new Date().toISOString(),
          returned_condition: 'damaged',
          received_by: user.id,
          note: [open.note, '[Báo mất khi đang cho mượn]'].filter(Boolean).join(' — '),
        })
      }
    }

    await samplesRepo.patch(id, { status: to })
    await samplesRepo.logEvent({
      sample_id: id,
      actor_id: user.id,
      action: to === 'disposed' ? 'disposed' : 'status_changed',
      before: { status: before.status },
      after: { status: to },
      note,
    })
    if (to === 'disposed' && before.product_id) await syncProductFlag(before.product_id)
  },

  async events(_user: User, id: string) {
    return samplesRepo.listEvents(id)
  },
}
