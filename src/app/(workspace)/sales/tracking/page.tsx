import { authService } from '@/modules/core/auth/auth.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { productionService } from '@/modules/dept/production/production.service'
import { TrackingManager } from './TrackingManager'

/** Bảng trạng thái tổng hợp đơn hàng (FR-SAL-07) — trả lời khách + điều phối. */
export default async function SalesTrackingPage() {
  const user = (await authService.currentUser())!
  const canManage = user.role === 'admin' || user.role === 'manager'

  const [rows, stages] = await Promise.all([
    productionService.tracking(),
    productionRepo.listStages(),
  ])

  return <TrackingManager rows={rows} stages={stages} canManage={canManage} />
}
