import { authService } from '@/modules/core/auth/auth.service'
import { productionService } from '@/modules/dept/production/production.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { componentsRepo } from '@/modules/dept/production/components.repo'
import { isSupplyStaff } from '@/modules/dept/supply/suppliers.service'
import { ProductionProgressManager } from './ProductionProgressManager'

/**
 * Tiến độ sản xuất theo LSX (FR-SUP-08) — bảng ĐIỀU PHỐI của phòng KH-Cung ứng:
 * tiến độ + nguy cơ trễ + tình trạng vật tư/BOM từng lệnh, thao tác nhanh tại chỗ.
 */
export default async function PlanningProductionPage() {
  const user = (await authService.currentUser())!

  const [{ rows }, stages, tracking, componentCounts] = await Promise.all([
    productionService.list(user, { page: 1, page_size: 500 }),
    productionRepo.listStages(),
    productionService.tracking(),
    componentsRepo.countsByLsx(),
  ])
  // Ghép thông tin đơn (hạn giao, BOM pending, PO mở) theo LSX — nguồn v_order_tracking.
  const byLsx = new Map(
    tracking.filter((t) => t.production_order_id).map((t) => [t.production_order_id, t]),
  )
  // Layout /planning đã gate admin/manager/KH-CƯ; thao tác tiến độ khớp canTrackProgress.
  const canManage =
    user.role === 'admin' || user.role === 'manager' || (await isSupplyStaff(user))

  return (
    <ProductionProgressManager
      rows={rows.map((r) => {
        const t = byLsx.get(r.id)
        return {
          id: r.id,
          code: r.code,
          order_code: r.order_code,
          customer_name: r.customer_name,
          status: r.status,
          current_stage: r.current_stage,
          ship_date: r.ship_date,
          completed_at: r.completed_at,
          order_status: t?.status ?? null,
          due_date: t?.due_date ?? null,
          lines_bom_pending: t?.lines_bom_pending ?? 0,
          pos_open: t?.pos_open ?? 0,
          has_components: (componentCounts.get(r.id) ?? 0) > 0,
        }
      })}
      stages={stages}
      canManage={canManage}
    />
  )
}
