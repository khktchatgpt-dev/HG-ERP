import {
  productionRepo,
  saveLsxLineSpecs,
  type LsxLineSpecRow,
  type ProductionOrder,
} from './production.repo'
import { ordersRepo } from '@/modules/dept/sales/orders.repo'
import { isSalesStaff } from '@/modules/dept/sales/quotes.service'
import { isSupplyStaff } from '@/modules/dept/supply/suppliers.service'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { usersRepo, type User } from '@/modules/core/users/users.repo'
import { emit } from '@/events/bus'
import { BadRequest, Conflict, Forbidden, NotFound } from '@/server/http'

const SUPPLY_DEPT = 'Kế Hoạch Sản Xuất-cung ứng'
const TECH_DEPT = 'Kỹ Thuật'

/** Phát LSX: Sales (FR-SAL-06 — Sales lập, GĐ duyệt). Admin luôn được. */
async function canIssue(user: User): Promise<boolean> {
  return user.role === 'admin' || (await isSalesStaff(user))
}

/** Duyệt LSX: Giám đốc/Ban quản lý. */
function canApprove(user: User): boolean {
  return user.role === 'admin' || user.role === 'manager'
}

/** Cập nhật tiến độ + báo hoàn thành: GĐ/BQL hoặc phòng KH-Cung ứng (FR-SUP-08). */
async function canTrackProgress(user: User): Promise<boolean> {
  return canApprove(user) || (await isSupplyStaff(user))
}

/** ID Giám đốc/Ban QL để báo duyệt (trừ chính người phát). */
async function approverIds(excludeId: string): Promise<string[]> {
  const users = await usersRepo.list()
  return users
    .filter((u) => (u.role === 'admin' || u.role === 'manager') && u.id !== excludeId)
    .map((u) => u.id)
}

/** ID nhân sự Cung ứng + Kỹ thuật để báo khi LSX được duyệt. */
async function supplyTechIds(): Promise<string[]> {
  const [depts, users] = await Promise.all([departmentsRepo.list(), usersRepo.list()])
  const target = new Set(
    depts.filter((d) => d.name === SUPPLY_DEPT || d.name === TECH_DEPT).map((d) => d.id),
  )
  return users
    .filter((u) => u.department_id && target.has(u.department_id))
    .map((u) => u.id)
}

export const productionService = {
  async list(_user: User, opts: Parameters<typeof productionRepo.list>[0]) {
    return productionRepo.list(opts)
  },

  async detail(_user: User, id: string) {
    const lsx = await productionRepo.findById(id)
    if (!lsx) throw NotFound('LSX không tồn tại')
    const progress = await productionRepo.listProgress(id)
    return { lsx, progress }
  },

  /** Bảng theo dõi đơn (FR-SAL-07) — mọi NV đã đăng nhập xem được. */
  async tracking() {
    return productionRepo.listTracking()
  },

  /**
   * Sales PHÁT LSX từ đơn (FR-SAL-06, BR-01/02/07): tạo ở trạng thái chờ GĐ duyệt.
   * - BR-01: DB unique chặn LSX thứ 2.
   * - BR-02: LSX dùng chung dòng SP của đơn.
   * - BR-07: KHÔNG chặn khi thiếu BOM — chỉ cảnh báo.
   */
  async issue(
    user: User,
    input: {
      code: string
      order_id: string
      ship_date?: string | null
      received_date?: string | null
      container_summary?: string | null
      note?: string | null
    },
  ): Promise<ProductionOrder> {
    if (!(await canIssue(user))) throw Forbidden('Chỉ Kinh doanh phát được LSX')
    const order = await ordersRepo.findById(input.order_id)
    if (!order) throw NotFound('Đơn hàng không tồn tại')
    if (order.status !== 'confirmed') {
      throw BadRequest('Chỉ phát LSX cho đơn đã xác nhận (chưa phát LSX)')
    }
    if (await productionRepo.existsByCode(input.code)) {
      throw Conflict(`Số LSX "${input.code}" đã tồn tại`, 'CODE_TAKEN')
    }

    const { order: lsx, duplicate } = await productionRepo.insert({
      code: input.code,
      sales_order_id: input.order_id,
      ship_date: input.ship_date ?? null,
      received_date: input.received_date ?? null,
      container_summary: input.container_summary ?? null,
      issued_by: user.id,
      issued_at: new Date().toISOString(),
      note: input.note ?? null,
    })
    if (duplicate || !lsx) {
      throw Conflict('Đơn này đã có LSX (BR-01: 1 đơn = 1 LSX)', 'LSX_EXISTS')
    }

    // Đơn sang trạng thái "đã phát LSX, chờ duyệt".
    await ordersRepo.patch(input.order_id, { status: 'lsx_pending' })
    await ordersRepo.insertChange({
      order_id: input.order_id,
      changed_by: user.id,
      change: {
        type: 'lsx_submitted',
        fields: { status: { from: order.status, to: 'lsx_pending' } },
        lsx_code: input.code,
      },
      note: null,
    })

    const lines = await ordersRepo.listLines(input.order_id)
    await emit({
      name: 'lsx.submitted',
      production_order_id: lsx.id,
      code: lsx.code,
      order_code: order.code,
      customer_name: order.customer_name,
      lines_bom_pending: lines.filter((l) => l.bom_status !== 'done').length,
      submitted_by: user.id,
      approver_ids: await approverIds(user.id),
    })
    return lsx
  },

  /** GĐ DUYỆT LSX: pending_approval → approved; đơn → lsx_issued; báo Cung ứng + Kỹ thuật. */
  async approve(user: User, id: string): Promise<ProductionOrder> {
    if (!canApprove(user)) throw Forbidden('Chỉ Giám đốc/Ban quản lý duyệt LSX')
    const lsx = await productionRepo.findById(id)
    if (!lsx) throw NotFound('LSX không tồn tại')
    if (lsx.status !== 'pending_approval')
      throw BadRequest('LSX không ở trạng thái chờ duyệt')

    const updated = await productionRepo.patch(id, {
      status: 'approved',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    await ordersRepo.patch(lsx.sales_order_id, { status: 'lsx_issued' })
    await ordersRepo.insertChange({
      order_id: lsx.sales_order_id,
      changed_by: user.id,
      change: { type: 'lsx_approved', lsx_code: lsx.code },
      note: null,
    })
    await emit({
      name: 'lsx.decided',
      production_order_id: id,
      code: lsx.code,
      decision: 'approved',
      decided_by: user.id,
      issued_by: lsx.issued_by,
      notify_ids: await supplyTechIds(),
    })
    return updated
  },

  /** GĐ TỪ CHỐI LSX: pending_approval → rejected; đơn về confirmed; báo người phát. */
  async reject(user: User, id: string, reason: string): Promise<ProductionOrder> {
    if (!canApprove(user)) throw Forbidden('Chỉ Giám đốc/Ban quản lý duyệt LSX')
    const lsx = await productionRepo.findById(id)
    if (!lsx) throw NotFound('LSX không tồn tại')
    if (lsx.status !== 'pending_approval')
      throw BadRequest('LSX không ở trạng thái chờ duyệt')

    const updated = await productionRepo.patch(id, {
      status: 'rejected',
      rejected_reason: reason,
    })
    await ordersRepo.patch(lsx.sales_order_id, { status: 'confirmed' })
    await ordersRepo.insertChange({
      order_id: lsx.sales_order_id,
      changed_by: user.id,
      change: { type: 'lsx_rejected', lsx_code: lsx.code },
      note: reason,
    })
    await emit({
      name: 'lsx.decided',
      production_order_id: id,
      code: lsx.code,
      decision: 'rejected',
      decided_by: user.id,
      issued_by: lsx.issued_by,
      reason,
      notify_ids: lsx.issued_by ? [lsx.issued_by] : [],
    })
    return updated
  },

  /** Sales nhập/tinh chỉnh spec sản xuất per dòng (OI-11) — override tech_spec SP. */
  async saveSpecs(user: User, id: string, lines: LsxLineSpecRow[]): Promise<void> {
    if (!(await canIssue(user))) throw Forbidden('Chỉ Kinh doanh nhập spec LSX')
    const lsx = await productionRepo.findById(id)
    if (!lsx) throw NotFound('LSX không tồn tại')
    await saveLsxLineSpecs(id, lines)
  },

  /**
   * Cập nhật giai đoạn (FR-PROD-01, FR-SUP-08): chỉ khi LSX đã duyệt. Lần đầu →
   * in_progress + đơn in_production.
   */
  async updateStage(
    user: User,
    id: string,
    input: { stage: string; action: 'start' | 'done'; note?: string | null },
  ): Promise<ProductionOrder> {
    if (!(await canTrackProgress(user))) {
      throw Forbidden('Chỉ GĐ/Ban quản lý hoặc Kế hoạch - Cung ứng cập nhật tiến độ')
    }
    const lsx = await productionRepo.findById(id)
    if (!lsx) throw NotFound('LSX không tồn tại')
    if (lsx.status === 'pending_approval' || lsx.status === 'rejected') {
      throw BadRequest('LSX chưa được duyệt')
    }
    if (lsx.status === 'completed') throw BadRequest('LSX đã hoàn thành')

    await productionRepo.insertProgress({
      production_order_id: id,
      stage: input.stage,
      action: input.action,
      note: input.note ?? null,
      updated_by: user.id,
    })

    const patch: Partial<ProductionOrder> = { current_stage: input.stage }
    if (lsx.status === 'approved') {
      patch.status = 'in_progress'
      await ordersRepo.patch(lsx.sales_order_id, { status: 'in_production' })
    }
    return productionRepo.patch(id, patch)
  },

  /**
   * Xác nhận đã nhận vật tư xuất kho theo LSX (FR-PROD-02, gap G-3) — CHỈ ghi
   * log tiến độ (action 'received'), không đổi giai đoạn/trạng thái.
   */
  async confirmMaterialsReceived(
    user: User,
    id: string,
    note?: string | null,
  ): Promise<void> {
    if (!(await canTrackProgress(user))) {
      throw Forbidden('Chỉ GĐ/Ban quản lý hoặc Kế hoạch - Cung ứng xác nhận nhận vật tư')
    }
    const lsx = await productionRepo.findById(id)
    if (!lsx) throw NotFound('LSX không tồn tại')
    if (lsx.status === 'pending_approval' || lsx.status === 'rejected') {
      throw BadRequest('LSX chưa được duyệt')
    }
    await productionRepo.insertProgress({
      production_order_id: id,
      stage: lsx.current_stage ?? 'vat_tu',
      action: 'received',
      note: note ?? null,
      updated_by: user.id,
    })
  },

  /** Báo hoàn thành để chuyển giao hàng (FR-PROD-03). */
  async complete(user: User, id: string, note?: string | null): Promise<ProductionOrder> {
    if (!(await canTrackProgress(user))) {
      throw Forbidden('Chỉ GĐ/Ban quản lý hoặc Kế hoạch - Cung ứng báo hoàn thành')
    }
    const lsx = await productionRepo.findById(id)
    if (!lsx) throw NotFound('LSX không tồn tại')
    if (lsx.status === 'completed') return lsx as ProductionOrder
    if (lsx.status === 'pending_approval' || lsx.status === 'rejected') {
      throw BadRequest('LSX chưa được duyệt')
    }

    await productionRepo.insertProgress({
      production_order_id: id,
      stage: lsx.current_stage ?? 'hoan_thien',
      action: 'done',
      note: note ?? 'Báo hoàn thành LSX',
      updated_by: user.id,
    })
    const updated = await productionRepo.patch(id, {
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    await ordersRepo.patch(lsx.sales_order_id, { status: 'completed' })
    return updated
  },
}
