import { authService } from '@/modules/core/auth/auth.service'
import { productionService } from '@/modules/dept/production/production.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { ProductionProgressManager } from './ProductionProgressManager'

/** Tiến độ sản xuất theo LSX (FR-SUP-08) — cụm Kế hoạch SX của phòng KH-Cung ứng. */
export default async function PlanningProductionPage() {
  const user = (await authService.currentUser())!

  const [{ rows }, stages] = await Promise.all([
    productionService.list(user, { page: 1, page_size: 500 }),
    productionRepo.listStages(),
  ])

  return (
    <ProductionProgressManager
      rows={rows.map((r) => ({
        id: r.id,
        code: r.code,
        order_code: r.order_code,
        customer_name: r.customer_name,
        status: r.status,
        current_stage: r.current_stage,
        ship_date: r.ship_date,
        completed_at: r.completed_at,
      }))}
      stages={stages}
    />
  )
}
