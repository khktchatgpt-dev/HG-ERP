import {
  productionRepo,
  saveLsxLineSpecs,
  type LsxLineSpecRow,
  type ProductionOrder,
} from './production.repo'
import '@/events/register' // Đăng ký handler event ở lần import đầu tiên.
import { jobsRepo } from './jobs.repo'
import { ordersRepo } from '@/modules/dept/sales/orders.repo'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { usersRepo, type User } from '@/modules/core/users/users.repo'
import { emit } from '@/events/bus'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import { BadRequest, Conflict, Forbidden, NotFound } from '@/server/http'

/**
 * VÒNG ĐỜI lệnh sản xuất (0084 giữ luồng giáp ranh đã chạy tốt):
 * Sales phát → GĐ duyệt/từ chối (→ gửi lại) → Kế hoạch + xưởng chạy →
 * HOÀN THÀNH (gate: mọi công việc đã xong) → đơn completed → Sales giao hàng.
 */

// Tách vai 07/2026: phòng gộp cũ + 2 phòng tách đều nhận báo LSX duyệt
// (Kế hoạch cần lên kế hoạch, Cung ứng cần đặt vật tư).
const SUPPLY_DEPTS = new Set([
  'Kế Hoạch Sản Xuất-cung ứng',
  'Kế Hoạch Sản Xuất',
  'Cung Ứng - Mua Hàng',
])
const TECH_DEPT = 'Kỹ Thuật'

/** ID Giám đốc/Ban QL để báo duyệt (trừ chính người phát). */
async function approverIds(excludeId: string): Promise<string[]> {
  const users = await usersRepo.list()
  return users
    .filter((u) => (u.role === 'admin' || u.role === 'manager') && u.id !== excludeId)
    .map((u) => u.id)
}

/** ID nhân sự Cung ứng + Kỹ thuật + Xưởng — nhận báo khi LSX được duyệt. */
async function lsxApprovedNotifyIds(): Promise<string[]> {
  const [depts, users] = await Promise.all([departmentsRepo.list(), usersRepo.list()])
  const target = new Set(
    depts
      .filter(
        (d) =>
          SUPPLY_DEPTS.has(d.name) ||
          d.name === TECH_DEPT ||
          d.workspace_id === 'production',
      )
      .map((d) => d.id),
  )
  return users
    .filter((u) => u.department_id && target.has(u.department_id))
    .map((u) => u.id)
}

export const lsxService = {
  async list(_user: User, opts: Parameters<typeof productionRepo.list>[0]) {
    return productionRepo.list(opts)
  },

  async detail(_user: User, id: string) {
    const lsx = await productionRepo.findById(id)
    if (!lsx) throw NotFound('LSX không tồn tại')
    const jobs = await jobsRepo.listByLsx(id)
    return { lsx, jobs }
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
    await assertAction(user, 'production.lsx.issue')
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

  /** GĐ DUYỆT LSX: pending_approval → approved; đơn → lsx_issued; báo các bộ phận. */
  async approve(user: User, id: string): Promise<ProductionOrder> {
    await assertAction(user, 'production.lsx.approve')
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
      notify_ids: await lsxApprovedNotifyIds(),
    })
    return updated
  },

  /** GĐ TỪ CHỐI LSX: pending_approval → rejected; đơn về confirmed; báo người phát. */
  async reject(user: User, id: string, reason: string): Promise<ProductionOrder> {
    await assertAction(user, 'production.lsx.approve')
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

  /**
   * Sales GỬI DUYỆT LẠI LSX bị từ chối: không tạo bản mới (BR-01 giữ 1 đơn =
   * 1 LSX) — sửa kèm header rồi quay về pending_approval, GĐ nhận báo duyệt lại.
   */
  async resubmit(
    user: User,
    id: string,
    input: {
      ship_date?: string | null
      received_date?: string | null
      container_summary?: string | null
      note?: string | null
    },
  ): Promise<ProductionOrder> {
    await assertAction(user, 'production.lsx.issue')
    const lsx = await productionRepo.findById(id)
    if (!lsx) throw NotFound('LSX không tồn tại')
    if (lsx.status !== 'rejected') {
      throw BadRequest('Chỉ gửi duyệt lại được LSX bị từ chối')
    }
    const order = await ordersRepo.findById(lsx.sales_order_id)
    if (!order) throw NotFound('Đơn hàng không tồn tại')
    if (order.status !== 'confirmed') {
      throw BadRequest('Đơn không còn ở trạng thái Xác nhận — không gửi duyệt lại được')
    }

    const patch: Partial<ProductionOrder> = {
      status: 'pending_approval',
      rejected_reason: null,
      issued_by: user.id,
      issued_at: new Date().toISOString(),
    }
    if (input.ship_date !== undefined) patch.ship_date = input.ship_date
    if (input.received_date !== undefined) patch.received_date = input.received_date
    if (input.container_summary !== undefined)
      patch.container_summary = input.container_summary
    if (input.note !== undefined) patch.note = input.note
    const updated = await productionRepo.patch(id, patch)

    await ordersRepo.patch(lsx.sales_order_id, { status: 'lsx_pending' })
    await ordersRepo.insertChange({
      order_id: lsx.sales_order_id,
      changed_by: user.id,
      change: { type: 'lsx_resubmitted', lsx_code: lsx.code },
      note: null,
    })

    const lines = await ordersRepo.listLines(lsx.sales_order_id)
    await emit({
      name: 'lsx.submitted',
      production_order_id: id,
      code: lsx.code,
      order_code: order.code,
      customer_name: order.customer_name,
      lines_bom_pending: lines.filter((l) => l.bom_status !== 'done').length,
      submitted_by: user.id,
      approver_ids: await approverIds(user.id),
      resubmitted: true,
    })
    return updated
  },

  /** Sales nhập/tinh chỉnh spec sản xuất per dòng (OI-11) — override tech_spec SP. */
  async saveSpecs(user: User, id: string, lines: LsxLineSpecRow[]): Promise<void> {
    await assertAction(user, 'production.lsx.issue')
    const lsx = await productionRepo.findById(id)
    if (!lsx) throw NotFound('LSX không tồn tại')
    await saveLsxLineSpecs(id, lines)
  },

  /**
   * Xưởng xác nhận đã nhận vật tư xuất kho theo LSX (FR-PROD-02) — mốc 1 lần
   * trên header lệnh (0085), có thể xác nhận lại (cập nhật mốc mới).
   */
  async confirmMaterialsReceived(user: User, id: string): Promise<ProductionOrder> {
    await assertAction(user, 'production.progress.track')
    const lsx = await productionRepo.findById(id)
    if (!lsx) throw NotFound('LSX không tồn tại')
    if (lsx.status !== 'approved' && lsx.status !== 'in_progress') {
      throw BadRequest('LSX không ở trạng thái đang chạy')
    }
    return productionRepo.patch(id, {
      materials_received_at: new Date().toISOString(),
      materials_received_by: user.id,
    })
  },

  /**
   * HOÀN THÀNH LSX (quản đốc/GĐ) — GATE: mọi công việc (jobs) đã xong.
   * Chưa xong → chặn; admin/manager ép qua (override) kèm lý do. Sau đó đơn
   * → completed, Sales xác nhận giao hàng (ordersService.deliver) khép chuỗi.
   */
  async complete(
    user: User,
    id: string,
    opts: { note?: string | null; override?: boolean } = {},
  ): Promise<ProductionOrder> {
    await assertAction(user, 'production.progress.track')
    const lsx = await productionRepo.findById(id)
    if (!lsx) throw NotFound('LSX không tồn tại')
    if (lsx.status === 'completed') return lsx as ProductionOrder
    if (lsx.status === 'pending_approval' || lsx.status === 'rejected') {
      throw BadRequest('LSX chưa được duyệt')
    }
    if (lsx.status === 'cancelled') throw BadRequest('LSX đã huỷ theo đơn hàng')

    const jobs = await jobsRepo.listByLsx(id)
    const open = jobs.filter((j) => j.status !== 'done')
    const noPlan = jobs.length === 0
    if (noPlan || open.length) {
      if (!opts.override) {
        throw BadRequest(
          noPlan
            ? 'Lệnh chưa có kế hoạch sản xuất (chưa có công việc nào) — không xác nhận hoàn thành được'
            : `Còn ${open.length} công việc chưa xong — xác nhận từng công đoạn trước, hoặc Ban quản lý ép hoàn thành kèm lý do`,
          'LSX_NOT_READY',
        )
      }
      if (user.role !== 'admin' && user.role !== 'manager') {
        throw Forbidden('Chỉ Ban quản lý được ép hoàn thành khi còn việc dở')
      }
      if (!opts.note?.trim()) throw BadRequest('Ép hoàn thành phải ghi lý do')
    }

    const updated = await productionRepo.patch(id, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      note: opts.note?.trim()
        ? `${lsx.note ? `${lsx.note}\n` : ''}[hoàn thành] ${opts.note.trim()}`
        : lsx.note,
    })
    await ordersRepo.patch(lsx.sales_order_id, { status: 'completed' })
    await ordersRepo.insertChange({
      order_id: lsx.sales_order_id,
      changed_by: user.id,
      change: { type: 'production_completed', lsx_code: lsx.code },
      note: opts.note ?? null,
    })
    return updated
  },
}
