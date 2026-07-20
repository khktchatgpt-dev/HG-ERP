import { authService } from '@/modules/core/auth/auth.service'
import {
  productionService,
  isProductionStaff,
} from '@/modules/dept/production/production.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { componentsRepo } from '@/modules/dept/production/components.repo'
import { routesRepo } from '@/modules/dept/production/routes.repo'
import { teamService } from '@/modules/dept/production/team.service'
import { incidentsService } from '@/modules/dept/production/incidents.service'
import { ProductionProgressManager } from './ProductionProgressManager'

/**
 * Tiến độ sản xuất theo LSX — bảng ĐIỀU PHỐI: tiến độ + nguy cơ trễ + tình
 * trạng vật tư/BOM từng lệnh, thao tác nhanh tại chỗ (GĐ/BQL + Xưởng).
 */
export default async function ProductionProgressPage() {
  const user = (await authService.currentUser())!

  const [
    { rows },
    stages,
    tracking,
    componentCounts,
    routeUnions,
    routeCounts,
    workload,
    openIncidents,
  ] = await Promise.all([
    productionService.list(user, { page: 1, page_size: 500 }),
    productionRepo.listStages(),
    productionService.tracking(),
    componentsRepo.countsByLsx(),
    routesRepo.stageUnionsByLsx(),
    routesRepo.countsByLsx(),
    teamService.workloadByTeam(),
    incidentsService.list(user, { status: 'open' }),
  ])
  const lineCounts = await productionRepo.linesCountByOrder(
    rows.map((r) => r.sales_order_id),
  )
  // Ghép thông tin đơn (hạn giao, BOM pending, PO mở) theo LSX — nguồn v_order_tracking.
  const byLsx = new Map(
    tracking.filter((t) => t.production_order_id).map((t) => [t.production_order_id, t]),
  )
  // Nút thao tác khớp canTrackProgress (service): GĐ/BQL hoặc nhân sự Xưởng.
  // Cung ứng hết quyền thao tác tiến độ (user siết 07/2026) — chỉ xem.
  const canManage =
    user.role === 'admin' || user.role === 'manager' || (await isProductionStaff(user))

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
          // Chỉ lọc select giai đoạn khi TẤT CẢ SP của lệnh đã chốt lộ trình —
          // định hình dở dang thì SP chưa chốt vẫn có thể cần giai đoạn khác.
          route_stages:
            (lineCounts.get(r.sales_order_id) ?? 0) > 0 &&
            (routeCounts.get(r.id) ?? 0) >= (lineCounts.get(r.sales_order_id) ?? 0) &&
            routeUnions.has(r.id)
              ? [...routeUnions.get(r.id)!]
              : null,
        }
      })}
      stages={stages}
      canManage={canManage}
      workload={workload}
      incidents={openIncidents.map((i) => ({
        id: i.id,
        lsx_code: i.lsx_code,
        stage: i.stage,
        department_name: i.department_name,
        reported_by_name: i.reported_by_name,
        message: i.message,
        created_at: i.created_at,
      }))}
    />
  )
}
