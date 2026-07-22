import {
  productionRepo,
  saveLsxLineSpecs,
  type LsxLineSpecRow,
  type ProductionOrder,
} from './production.repo'
import '@/events/register' // Đăng ký handler event ở lần import đầu tiên (như tasks.service).
import { routesRepo } from './routes.repo'
import { nextStagesAfter } from './routes.service'
import { ordersRepo } from '@/modules/dept/sales/orders.repo'
import { isSalesStaff } from '@/modules/dept/sales/quotes.service'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { usersRepo, type User } from '@/modules/core/users/users.repo'
import { emit } from '@/events/bus'
import { resolveTeamStage } from '@/lib/stage-for-dept'
import { shadowGuard } from '@/modules/core/rbac/shadow'
import { BadRequest, Conflict, Forbidden, NotFound } from '@/server/http'

// Tách vai 07/2026: phòng gộp cũ + 2 phòng tách đều nhận báo LSX duyệt
// (Kế hoạch cần định hình, Cung ứng cần đặt vật tư).
const SUPPLY_DEPTS = new Set([
  'Kế Hoạch Sản Xuất-cung ứng',
  'Kế Hoạch Sản Xuất',
  'Cung Ứng - Mua Hàng',
])
const TECH_DEPT = 'Kỹ Thuật'

/** Phát LSX: Sales (FR-SAL-06 — Sales lập, GĐ duyệt). Admin luôn được. */
async function canIssue(user: User): Promise<boolean> {
  return user.role === 'admin' || (await isSalesStaff(user))
}

/** Duyệt LSX: Giám đốc/Ban quản lý. */
function canApprove(user: User): boolean {
  return user.role === 'admin' || user.role === 'manager'
}

/**
 * Nhân sự Xưởng: phòng gán workspace 'production' (/admin/departments).
 * Check bằng cột workspace_id — KHÔNG so tên chuỗi phòng (bug so tên đã vá 2 lần).
 */
export async function isProductionStaff(user: User): Promise<boolean> {
  if (user.role === 'admin') return true
  const dept = user.department_id
    ? await departmentsRepo.findById(user.department_id)
    : null
  const legacy = dept?.workspace_id === 'production'
  // Phase 1 RBAC: shadow-so với production.member, vẫn trả legacy.
  return shadowGuard(user, 'isProductionStaff', legacy, 'production.member')
}

/**
 * Cập nhật tiến độ + báo hoàn thành: GĐ/BQL hoặc Xưởng (workspace production —
 * FR-PROD-01/02/03). Cung ứng KHÔNG còn quyền này (user siết 07/2026: planner
 * chỉ định hình, dữ liệu thực thi là của bộ phận sản xuất — bỏ FR-SUP-08 cũ).
 */
async function canTrackProgress(user: User): Promise<boolean> {
  return canApprove(user) || (await isProductionStaff(user))
}

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
      notify_ids: await lsxApprovedNotifyIds(),
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

  /**
   * Sales GỬI DUYỆT LẠI LSX bị từ chối (plan-order-lsx-lifecycle P1): không
   * tạo bản mới (BR-01 giữ 1 đơn = 1 LSX) — sửa kèm header rồi quay về
   * pending_approval, đơn → lsx_pending, GĐ nhận thông báo duyệt lại.
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
    if (!(await canIssue(user))) throw Forbidden('Chỉ Kinh doanh gửi duyệt lại LSX')
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
      throw Forbidden('Chỉ Xưởng hoặc GĐ/Ban quản lý cập nhật tiến độ')
    }
    const lsx = await productionRepo.findById(id)
    if (!lsx) throw NotFound('LSX không tồn tại')
    if (lsx.status === 'pending_approval' || lsx.status === 'rejected') {
      throw BadRequest('LSX chưa được duyệt')
    }
    if (lsx.status === 'completed') throw BadRequest('LSX đã hoàn thành')
    if (lsx.status === 'cancelled') throw BadRequest('LSX đã huỷ theo đơn hàng')

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
    const updated = await productionRepo.patch(id, patch)

    // Bàn giao công đoạn (tách vai 07/2026): xong 1 công đoạn → báo tổ phụ
    // trách công đoạn KẾ TIẾP trên lộ trình + quản đốc. Emit ở đây (một điểm
    // ghi duy nhất) nên cả màn quản đốc lẫn Kanban tổ đều kích chuỗi bàn giao.
    if (input.action === 'done') {
      const [stages, lineRoutes, depts, users] = await Promise.all([
        productionRepo.listStages(),
        routesRepo.listByLsx(id),
        departmentsRepo.list(),
        usersRepo.list(),
      ])
      const labelOf = (code: string) => stages.find((s) => s.code === code)?.label ?? code
      const next = nextStagesAfter(
        input.stage,
        lineRoutes.map((r) => r.stages),
      )
      const nextDeptIds = new Set(
        depts
          .filter(
            (d) =>
              d.workspace_id === 'production' &&
              next.includes(resolveTeamStage(d, stages) ?? ''),
          )
          .map((d) => d.id),
      )
      await emit({
        name: 'production.stage.done',
        production_order_id: id,
        code: lsx.code,
        stage: input.stage,
        stage_label: labelOf(input.stage),
        next_stages: next,
        next_stage_labels: next.map(labelOf),
        done_by: user.id,
        notify_next_ids: users
          .filter((u) => u.department_id && nextDeptIds.has(u.department_id))
          .map((u) => u.id),
        coordinator_ids: await approverIds(user.id),
      })
    }
    return updated
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
      throw Forbidden('Chỉ Xưởng hoặc GĐ/Ban quản lý xác nhận nhận vật tư')
    }
    const lsx = await productionRepo.findById(id)
    if (!lsx) throw NotFound('LSX không tồn tại')
    if (lsx.status === 'pending_approval' || lsx.status === 'rejected') {
      throw BadRequest('LSX chưa được duyệt')
    }
    if (lsx.status === 'cancelled') throw BadRequest('LSX đã huỷ theo đơn hàng')
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
      throw Forbidden('Chỉ Xưởng hoặc GĐ/Ban quản lý báo hoàn thành')
    }
    const lsx = await productionRepo.findById(id)
    if (!lsx) throw NotFound('LSX không tồn tại')
    if (lsx.status === 'completed') return lsx as ProductionOrder
    if (lsx.status === 'pending_approval' || lsx.status === 'rejected') {
      throw BadRequest('LSX chưa được duyệt')
    }
    if (lsx.status === 'cancelled') throw BadRequest('LSX đã huỷ theo đơn hàng')

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
