import { productionRepo, type ProductionOrder } from './production.repo'
import { ordersRepo } from '@/modules/dept/sales/orders.repo'
import type { User } from '@/modules/core/users/users.repo'
import { BadRequest, Conflict, Forbidden, NotFound } from '@/server/http'

/** Phát LSX cần Giám đốc/Ban QL xác nhận (FR-SAL-06). */
function canIssue(user: User): boolean {
  return user.role === 'admin' || user.role === 'manager'
}

/** GĐ1: cập nhật tiến độ do quản lý thao tác (xưởng chi tiết là GĐ3). */
function canUpdateStage(user: User): boolean {
  return user.role === 'admin' || user.role === 'manager'
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
   * Phát LSX từ đơn (FR-SAL-06, BR-01/02/07):
   * - BR-01: DB unique chặn LSX thứ 2 → Conflict.
   * - BR-02: LSX dùng chung dòng SP của đơn (không nhân bản).
   * - BR-07: KHÔNG chặn khi thiếu BOM — UI đã cảnh báo, GĐ quyết.
   */
  async issue(
    user: User,
    input: {
      order_id: string
      ship_date?: string | null
      container_summary?: string | null
      note?: string | null
    },
  ): Promise<ProductionOrder> {
    if (!canIssue(user)) throw Forbidden('Phát LSX cần Giám đốc/Ban quản lý xác nhận')
    const order = await ordersRepo.findById(input.order_id)
    if (!order) throw NotFound('Đơn hàng không tồn tại')
    if (order.status === 'cancelled' || order.status === 'delivered') {
      throw BadRequest('Đơn đã giao/huỷ — không phát LSX được')
    }

    const code = await productionRepo.nextCode()
    const { order: lsx, duplicate } = await productionRepo.insert({
      code,
      sales_order_id: input.order_id,
      ship_date: input.ship_date ?? null,
      container_summary: input.container_summary ?? null,
      issued_by: user.id,
      issued_at: new Date().toISOString(),
      note: input.note ?? null,
    })
    if (duplicate || !lsx) {
      throw Conflict('Đơn này đã có LSX (BR-01: 1 đơn = 1 LSX)', 'LSX_EXISTS')
    }

    await ordersRepo.patch(input.order_id, { status: 'lsx_issued' })
    await ordersRepo.insertChange({
      order_id: input.order_id,
      changed_by: user.id,
      change: {
        type: 'lsx_issued',
        fields: { status: { from: order.status, to: 'lsx_issued' } },
        lsx_code: code,
      },
      note: null,
    })
    return lsx
  },

  /**
   * Cập nhật giai đoạn (FR-PROD-01, FR-SUP-08): ghi log + set current_stage.
   * Lần đầu chuyển giai đoạn → LSX in_progress + đơn in_production.
   */
  async updateStage(
    user: User,
    id: string,
    input: { stage: string; action: 'start' | 'done'; note?: string | null },
  ): Promise<ProductionOrder> {
    if (!canUpdateStage(user)) throw Forbidden()
    const lsx = await productionRepo.findById(id)
    if (!lsx) throw NotFound('LSX không tồn tại')
    if (lsx.status === 'completed') throw BadRequest('LSX đã hoàn thành')

    await productionRepo.insertProgress({
      production_order_id: id,
      stage: input.stage,
      action: input.action,
      note: input.note ?? null,
      updated_by: user.id,
    })

    const patch: Partial<ProductionOrder> = { current_stage: input.stage }
    if (lsx.status === 'issued') {
      patch.status = 'in_progress'
      await ordersRepo.patch(lsx.sales_order_id, { status: 'in_production' })
    }
    return productionRepo.patch(id, patch)
  },

  /** Báo hoàn thành để chuyển giao hàng (FR-PROD-03). */
  async complete(user: User, id: string, note?: string | null): Promise<ProductionOrder> {
    if (!canUpdateStage(user)) throw Forbidden()
    const lsx = await productionRepo.findById(id)
    if (!lsx) throw NotFound('LSX không tồn tại')
    if (lsx.status === 'completed') return lsx as ProductionOrder

    await productionRepo.insertProgress({
      production_order_id: id,
      stage: lsx.current_stage ?? 'hoan_thien',
      action: 'done',
      note: note ?? 'Báo hoàn thành LSX',
      updated_by: user.id,
    })
    const updated = await productionRepo.patch(id, { status: 'completed' })
    await ordersRepo.patch(lsx.sales_order_id, { status: 'completed' })
    return updated
  },
}
