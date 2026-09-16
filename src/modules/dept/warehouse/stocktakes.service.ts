import { BadRequest, Conflict, Forbidden, NotFound } from '@/server/http'
import type { User } from '@/modules/core/users/users.repo'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import { docsRepo, insertMovements, warehousesRepo } from './stock.repo'
import {
  bookQtyAt,
  materialsInScope,
  stocktakesRepo,
  type Stocktake,
  type StocktakeScope,
  type TakeLine,
} from './stocktakes.repo'

/**
 * ĐỢT KIỂM KÊ (0199/0200) — Đợt 3 §2.2 của `docs/thiet-ke-kho.md`.
 *
 * Vòng đời: Mở → Đang đếm → Đối chiếu → Đã duyệt (hoặc Huỷ).
 *
 * Ba thứ làm nên giá trị của nó, và cả ba đều dễ làm sai theo cách không ai
 * phát hiện:
 *
 *   ① PHẠM VI chốt lúc mở, lưu vào chứng từ. Không có đường "cả danh mục".
 *   ② SỔ ĐÓNG BĂNG tại `freeze_at`, và chênh tính so với số đóng băng đó.
 *   ③ ĐẾM MÙ: số sổ không rời server khi đợt đang đếm.
 */

/** Ai cũng xem được nếu xem được kho; sửa thì cần quyền ghi. */
async function assertWrite(user: User): Promise<void> {
  await assertAction(user, 'warehouse.stock.write')
}

function scopeOf(t: Stocktake): StocktakeScope {
  const ref = t.scope_ref as Record<string, unknown>
  if (t.scope_kind === 'group') {
    return { kind: 'group', groups: (ref.groups as string[]) ?? [] }
  }
  if (t.scope_kind === 'list') {
    return { kind: 'list', material_ids: (ref.material_ids as string[]) ?? [] }
  }
  return { kind: 'bin', bin_ids: (ref.bin_ids as string[]) ?? [] }
}

/**
 * ĐẾM MÙ ĐƯỢC THỰC THI Ở SERVER, không ở CSS.
 *
 * Giấu cột bằng giao diện là giấu với người nhìn màn hình, không giấu với
 * người mở tab mạng của trình duyệt — và người đếm muốn xem số sổ thì đó đúng
 * là người sẽ mở. Số chỉ được gửi đi khi đợt đã qua bước đếm, hoặc khi đợt
 * khai rõ là đếm mở.
 */
function maskBook(t: Stocktake, lines: TakeLine[]): TakeLine[] {
  const hide = t.blind_count && (t.status === 'open' || t.status === 'counting')
  if (!hide) return lines
  return lines.map((l) => ({ ...l, book_qty_frozen: null }))
}

export const stocktakesService = {
  async list(
    user: User,
    opts: { status?: Stocktake['status']; page: number; page_size: number },
  ) {
    await assertAction(user, 'warehouse.stock.read')
    return stocktakesRepo.list(opts)
  },

  async detail(user: User, id: string) {
    await assertAction(user, 'warehouse.stock.read')
    const take = await stocktakesRepo.findById(id)
    if (!take) throw NotFound('Đợt kiểm kê không tồn tại')
    const lines = await stocktakesRepo.listLines(id)
    const counted = lines.filter((l) => l.counted_qty != null).length
    return {
      take,
      lines: maskBook(take, lines),
      progress: {
        total: lines.length,
        counted,
        remaining: lines.length - counted,
        /*
         * Số dòng LỆCH chỉ có nghĩa sau khi chốt sổ, và chỉ được bày khi
         * không còn đếm mù — nếu không thì nó là một kênh rò rỉ số sổ: người
         * đếm gõ thử một số, thấy "0 dòng lệch", là biết sổ ghi bao nhiêu.
         */
        diff_count:
          take.blind_count && (take.status === 'open' || take.status === 'counting')
            ? null
            : lines.filter(
                (l) =>
                  l.counted_qty != null &&
                  Math.abs(l.counted_qty - (l.book_qty_frozen ?? 0)) > 1e-9,
              ).length,
      },
    }
  },

  /**
   * MỞ ĐỢT — chốt phạm vi, chưa chốt sổ.
   *
   * Tách "mở" khỏi "chốt sổ" có chủ ý: quản lý kho lập đợt chiều hôm trước,
   * người đếm bắt đầu sáng hôm sau. Chốt sổ lúc lập là đóng băng một con số
   * cách lúc đếm 14 tiếng, rồi mọi phiếu trong đêm thành chênh lệch giả.
   */
  async open(
    user: User,
    input: {
      scope: StocktakeScope
      blind_count?: boolean
      assigned_to?: string | null
      note?: string | null
    },
  ): Promise<{ id: string; code: string; scope_count: number }> {
    await assertWrite(user)

    const ids = await materialsInScope(input.scope)
    if (ids.length === 0) {
      throw BadRequest(
        'Phạm vi này không có mã nào — chọn khu khác, nhóm khác, hoặc thêm mã vào danh sách',
      )
    }

    const code = await docsRepo.nextCode('KK')
    const { id } = await stocktakesRepo.insert({
      code,
      scope_kind: input.scope.kind,
      scope_ref:
        input.scope.kind === 'bin'
          ? { bin_ids: input.scope.bin_ids }
          : input.scope.kind === 'group'
            ? { groups: input.scope.groups }
            : { material_ids: input.scope.material_ids },
      scope_count: ids.length,
      blind_count: input.blind_count ?? true,
      assigned_to: input.assigned_to ?? null,
      note: input.note ?? null,
      created_by: user.id,
    })
    return { id, code, scope_count: ids.length }
  },

  /**
   * CHỐT SỔ và bắt đầu đếm. Đây là bước sinh dòng đếm.
   *
   * `freeze_at` lấy giờ server, KHÔNG nhận từ client: một mốc chốt sổ do
   * trình duyệt gửi lên là một mốc người dùng sửa được, và toàn bộ chênh lệch
   * của đợt treo trên nó.
   */
  async startCounting(user: User, id: string): Promise<{ lines: number }> {
    await assertWrite(user)
    const take = await stocktakesRepo.findById(id)
    if (!take) throw NotFound('Đợt kiểm kê không tồn tại')
    if (take.status !== 'open') {
      throw Conflict(
        `Đợt đang ở trạng thái "${take.status}" — chỉ đợt mới mở mới chốt sổ được`,
      )
    }

    const ids = await materialsInScope(scopeOf(take))
    if (ids.length === 0) throw BadRequest('Phạm vi rỗng — không có gì để đếm')

    const freezeAt = new Date().toISOString()
    const book = await bookQtyAt(freezeAt, ids)

    await stocktakesRepo.insertLines(
      ids.map((materialId) => {
        const qty = book.get(materialId) ?? 0
        return {
          stocktake_id: id,
          material_id: materialId,
          // `system_qty` (cột 0077) giữ nguyên nghĩa cũ để biên bản in ra
          // không đổi cách đọc; với đợt thì hai cột bằng nhau lúc chốt.
          system_qty: qty,
          book_qty_frozen: qty,
        }
      }),
    )
    await stocktakesRepo.patch(id, { status: 'counting', freeze_at: freezeAt })
    return { lines: ids.length }
  },

  /**
   * GHI SỐ ĐẾM. Nhận nhiều dòng một lượt (lưới đếm lưu dở được).
   *
   * `diff` TÍNH LẠI Ở SERVER so với `book_qty_frozen`, không nhận từ client —
   * và đây là chỗ đếm mù có ý nghĩa thật: client không biết số sổ thì cũng
   * không tính nổi chênh lệch, nên chênh chỉ có một nguồn.
   */
  async saveCounts(
    user: User,
    id: string,
    counts: { line_id: string; counted_qty: number; note?: string | null }[],
  ): Promise<{ saved: number }> {
    await assertWrite(user)
    const take = await stocktakesRepo.findById(id)
    if (!take) throw NotFound('Đợt kiểm kê không tồn tại')
    if (take.status !== 'counting') {
      throw Conflict(
        take.status === 'open'
          ? 'Đợt chưa chốt sổ — bấm "Bắt đầu đếm" trước'
          : `Đợt đang ở "${take.status}" — không ghi thêm số đếm được`,
      )
    }

    const byId = new Map((await stocktakesRepo.listLines(id)).map((l) => [l.id, l]))
    let saved = 0
    for (const c of counts) {
      const line = byId.get(c.line_id)
      if (!line) continue // dòng không thuộc đợt này — bỏ qua, không ném
      if (c.counted_qty < 0) throw BadRequest('Số đếm không âm được')
      await stocktakesRepo.patchLine(c.line_id, {
        counted_qty: c.counted_qty,
        diff: c.counted_qty - (line.book_qty_frozen ?? 0),
        counted_by: user.id,
        note: c.note ?? line.note,
      })
      saved += 1
    }
    return { saved }
  },

  /** Gửi ĐỐI CHIẾU — chốt việc đếm, mở số sổ ra cho người duyệt xem. */
  async submitReview(user: User, id: string): Promise<void> {
    await assertWrite(user)
    const take = await stocktakesRepo.findById(id)
    if (!take) throw NotFound('Đợt kiểm kê không tồn tại')
    if (take.status !== 'counting') {
      throw Conflict(
        `Đợt đang ở "${take.status}" — chỉ đợt đang đếm mới gửi đối chiếu được`,
      )
    }
    const lines = await stocktakesRepo.listLines(id)
    const chuaDem = lines.filter((l) => l.counted_qty == null)
    if (chuaDem.length > 0) {
      /*
       * KHÔNG cho gửi khi còn mã chưa đếm, và nói RÕ còn bao nhiêu.
       *
       * Coi "chưa đếm" như "đếm được 0" là biến một chỗ bỏ sót thành một bút
       * toán xoá sạch tồn của mã đó — đúng hạng lỗi mà kiểm kê phải chống,
       * chứ không phải tạo ra.
       */
      throw BadRequest(
        `Còn ${chuaDem.length}/${lines.length} mã chưa đếm. Đếm nốt, hoặc ghi 0 cho mã thật sự không còn hàng — bỏ trống không phải là số không.`,
      )
    }
    await stocktakesRepo.patch(id, { status: 'review' })
  },

  /**
   * DUYỆT — sinh phiếu KK và bút toán điều chỉnh.
   *
   * CHÊNH ÁP LÀ DELTA so với sổ đóng băng, KHÔNG phải "đặt tồn = số đếm".
   *
   * Khác hẳn `approveStocktake` đời cũ (0157) vốn áp theo tồn LÚC DUYỆT. Ở đó
   * đúng, vì không có mốc chốt sổ nên số đếm được hiểu là "tồn bây giờ". Ở
   * đây số đếm là tồn TẠI freeze_at — đặt tồn = số đếm sẽ xoá sạch mọi phiếu
   * nhập/xuất phát sinh sau lúc chốt, mà đó lại chính là quãng thời gian
   * người ta đang đếm.
   *
   * Ví dụ: sổ chốt 100, đếm được 95 (thiếu 5), trong lúc đếm nhập thêm 20 nên
   * tồn hiện 120. Áp delta −5 → 115, đúng. Đặt tồn = 95 → mất 20 cây vừa nhập.
   */
  async approve(user: User, id: string): Promise<{ doc_code: string; applied: number }> {
    await assertWrite(user)
    const take = await stocktakesRepo.findById(id)
    if (!take) throw NotFound('Đợt kiểm kê không tồn tại')
    if (take.status !== 'review') {
      throw Conflict(`Đợt đang ở "${take.status}" — chỉ đợt chờ đối chiếu mới duyệt được`)
    }

    const lines = await stocktakesRepo.listLines(id)
    const adjusts = lines
      .map((l) => ({ l, delta: (l.counted_qty ?? 0) - (l.book_qty_frozen ?? 0) }))
      .filter((x) => Math.abs(x.delta) > 1e-9)

    const [code, warehouseId] = await Promise.all([
      docsRepo.nextCode('KK'),
      warehousesRepo.mainId(),
    ])
    const doc = await docsRepo.insert({
      code,
      kind: 'stocktake',
      reason: `Duyệt đợt kiểm kê ${take.code}`,
      note: take.note,
      created_by: user.id,
    })

    if (adjusts.length > 0) {
      await insertMovements(
        adjusts.map(({ l, delta }) => ({
          material_id: l.material_id,
          direction: delta > 0 ? ('in' as const) : ('out' as const),
          qty: Math.abs(delta),
          ref_type: 'adjust',
          // N4 thừa / X5 thiếu — hai mã duy nhất của kiểm kê (0197).
          reason_code: delta > 0 ? 'N4' : 'X5',
          note: `Đợt ${take.code}: đếm ${l.counted_qty}, sổ chốt ${l.book_qty_frozen ?? 0}`,
          created_by: user.id,
          doc_id: doc.id,
          warehouse_id: warehouseId,
        })),
      )
    }

    await stocktakesRepo.attachDoc(id, doc.id)
    await stocktakesRepo.patch(id, {
      status: 'approved',
      doc_id: doc.id,
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    return { doc_code: doc.code, applied: adjusts.length }
  },

  async reject(user: User, id: string, reason: string): Promise<void> {
    await assertWrite(user)
    if (!reason.trim()) throw BadRequest('Từ chối phải kèm lý do')
    const take = await stocktakesRepo.findById(id)
    if (!take) throw NotFound('Đợt kiểm kê không tồn tại')
    if (take.status !== 'review') {
      throw Conflict(
        `Đợt đang ở "${take.status}" — chỉ đợt chờ đối chiếu mới từ chối được`,
      )
    }
    // Quay về ĐANG ĐẾM chứ không đóng đợt: từ chối nghĩa là "đếm lại chỗ này",
    // và bắt lập đợt mới là bắt đếm lại từ đầu cả phạm vi.
    await stocktakesRepo.patch(id, { status: 'counting', reject_reason: reason.trim() })
  },

  async cancel(user: User, id: string, reason: string): Promise<void> {
    await assertWrite(user)
    const take = await stocktakesRepo.findById(id)
    if (!take) throw NotFound('Đợt kiểm kê không tồn tại')
    if (take.status === 'approved') {
      throw Conflict(
        'Đợt đã duyệt — tồn đã đổi theo. Sai thì đảo phiếu KK, không huỷ đợt.',
      )
    }
    if (user.role !== 'admin' && take.created_by !== user.id) {
      throw Forbidden('Chỉ người mở đợt hoặc quản trị viên huỷ được')
    }
    await stocktakesRepo.patch(id, {
      status: 'cancelled',
      reject_reason: reason.trim() || null,
    })
  },
}
