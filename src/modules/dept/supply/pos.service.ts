import { posRepo, type Po, type PoLineInput } from './pos.repo'
import { suppliersRepo, supplyRepo } from './supply.repo'
import { isSupplyStaff } from './suppliers.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { usersRepo, type User } from '@/modules/core/users/users.repo'
import { emit } from '@/events/bus'
import { BadRequest, Forbidden, NotFound } from '@/server/http'

/** Duyệt mua vật tư: Giám đốc/Ban QL (đặc tả mục 6 — khâu duyệt quan trọng nhất). */
function canApprove(user: User): boolean {
  return user.role === 'admin' || user.role === 'manager'
}

type PoInput = {
  production_order_id: string
  supplier_id: string
  currency: string
  vat_rate?: number | null
  price_includes_vat: boolean
  expected_at?: string | null
  terms?: string | null
  note?: string | null
  lines: PoLineInput[]
}

export const posService = {
  /** Đọc: mọi NV đã đăng nhập (Kho nhận hàng, Kế toán xem phải trả…). */
  async list(_user: User, opts: Parameters<typeof posRepo.list>[0]) {
    return posRepo.list(opts)
  },

  async detail(_user: User, id: string) {
    const po = await posRepo.findById(id)
    if (!po) throw NotFound('Đơn đặt không tồn tại')
    const [lines, status_lines] = await Promise.all([
      posRepo.listLines(id),
      supplyRepo.lineStatus(id), // đặt / đã nhận / còn thiếu (BR-08, FR-SUP-05)
    ])
    return { po, lines, status_lines }
  },

  /**
   * Tạo PO (FR-SUP-02, BR-06): đúng 1 LSX + 1 NCC — DB ép NOT NULL FK,
   * service kiểm tồn tại. Sinh mã PO-YYYY-NNNN, vào thẳng 'pending_approval'
   * và notify GĐ (không có bước nháp — đặc tả 4.3).
   */
  async create(user: User, input: PoInput): Promise<Po> {
    if (!(await isSupplyStaff(user))) {
      throw Forbidden('Chỉ phòng Kế hoạch - Cung ứng tạo được đơn đặt vật tư')
    }
    const supplier = await suppliersRepo.findById(input.supplier_id)
    if (!supplier) throw NotFound('NCC không tồn tại')
    if (!supplier.is_active) throw BadRequest('NCC đã ngừng giao dịch')
    const lsx = await productionRepo.findById(input.production_order_id)
    if (!lsx) throw NotFound('LSX không tồn tại')

    const code = await posRepo.nextCode()
    const po = await posRepo.insert(
      {
        code,
        production_order_id: input.production_order_id,
        supplier_id: input.supplier_id,
        currency: input.currency,
        vat_rate: input.vat_rate ?? null,
        price_includes_vat: input.price_includes_vat,
        expected_at: input.expected_at ?? null,
        terms: input.terms ?? null,
        note: input.note ?? null,
        created_by: user.id,
      },
      input.lines,
    )

    const approvers = (await usersRepo.list()).filter(
      (u) => (u.role === 'admin' || u.role === 'manager') && u.id !== user.id,
    )
    await emit({
      name: 'po.submitted',
      po_id: po.id,
      code: po.code,
      supplier_name: supplier.name,
      lsx_code: lsx.code,
      submitted_by: user.id,
      approver_ids: approvers.map((a) => a.id),
    })
    return po
  },

  /** Chỉ PO đang chờ duyệt được sửa (sau duyệt là cam kết với GĐ/NCC). */
  async update(user: User, id: string, input: PoInput): Promise<Po> {
    if (!(await isSupplyStaff(user))) throw Forbidden()
    const before = await posRepo.findById(id)
    if (!before) throw NotFound('Đơn đặt không tồn tại')
    if (before.status !== 'pending_approval') {
      throw BadRequest('Chỉ đơn chờ duyệt mới sửa được')
    }
    const po = await posRepo.patch(id, {
      supplier_id: input.supplier_id,
      currency: input.currency,
      vat_rate: input.vat_rate ?? null,
      price_includes_vat: input.price_includes_vat,
      expected_at: input.expected_at ?? null,
      terms: input.terms ?? null,
      note: input.note ?? null,
    })
    await posRepo.replaceLines(id, input.lines)
    return po
  },

  /** GĐ duyệt / từ chối (BR-05 nửa đầu): pending_approval → approved | cancelled. */
  async decide(
    user: User,
    id: string,
    decision: 'approve' | 'reject',
    reason?: string,
  ): Promise<Po> {
    if (!canApprove(user)) throw Forbidden('Chỉ Ban quản lý/Giám đốc duyệt mua vật tư')
    const before = await posRepo.findById(id)
    if (!before) throw NotFound('Đơn đặt không tồn tại')
    if (before.status !== 'pending_approval') {
      throw BadRequest('Chỉ duyệt được đơn đang chờ duyệt')
    }
    const po = await posRepo.patch(
      id,
      decision === 'approve'
        ? {
            status: 'approved',
            approved_by: user.id,
            approved_at: new Date().toISOString(),
          }
        : { status: 'cancelled', note: reason ? `[Từ chối] ${reason}` : before.note },
    )
    await emit({
      name: 'po.decided',
      po_id: id,
      code: before.code,
      decision: decision === 'approve' ? 'approved' : 'rejected',
      decided_by: user.id,
      created_by: before.created_by,
      reason,
    })
    return po
  },

  /**
   * ⭐ BR-05 nửa sau: CHƯA DUYỆT THÌ KHÔNG GỬI ĐƯỢC CHO NCC.
   * approved → ordered (gửi NCC, đóng dấu ordered_at) → confirmed → in_transit.
   * partial/received do Kho tự cập nhật khi nhập hàng (BR-08).
   */
  async advance(
    user: User,
    id: string,
    to: 'ordered' | 'confirmed' | 'in_transit',
  ): Promise<Po> {
    if (!(await isSupplyStaff(user))) throw Forbidden()
    const before = await posRepo.findById(id)
    if (!before) throw NotFound('Đơn đặt không tồn tại')

    const allowed: Record<string, string[]> = {
      ordered: ['approved'], // ⭐ BR-05: chỉ từ approved
      confirmed: ['ordered'],
      in_transit: ['confirmed', 'ordered'],
    }
    if (!allowed[to].includes(before.status)) {
      throw BadRequest(
        to === 'ordered'
          ? 'BR-05: đơn phải được Giám đốc duyệt mới gửi được cho NCC'
          : `Không chuyển được từ "${before.status}" sang "${to}"`,
      )
    }
    return posRepo.patch(id, {
      status: to,
      ...(to === 'ordered' ? { ordered_at: new Date().toISOString() } : {}),
    })
  },

  /** Huỷ (trước khi nhận hàng) — kèm lý do. */
  async cancel(user: User, id: string, reason: string): Promise<Po> {
    if (!(await isSupplyStaff(user))) throw Forbidden()
    const before = await posRepo.findById(id)
    if (!before) throw NotFound('Đơn đặt không tồn tại')
    if (before.status === 'received' || before.status === 'cancelled') {
      throw BadRequest('Đơn đã về đủ / đã huỷ — không huỷ được')
    }
    return posRepo.patch(id, {
      status: 'cancelled',
      note: `[Huỷ] ${reason}${before.note ? ` · ${before.note}` : ''}`,
    })
  },
}
