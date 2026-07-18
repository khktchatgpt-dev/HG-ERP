import { authService } from '@/modules/core/auth/auth.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { productionService } from '@/modules/dept/production/production.service'
import { TrackingManager } from './TrackingManager'

/**
 * Bảng trạng thái tổng hợp đơn hàng (FR-SAL-07) — dùng chung 3 shell (Sales /
 * Kế hoạch - Cung ứng / Ban GĐ). `lsxBase` giữ link chi tiết LSX ở đúng shell
 * đang đứng (mỗi bộ phận một màn riêng, user chốt 07/2026).
 */
export async function TrackingScreen({ lsxBase }: { lsxBase: string }) {
  const user = (await authService.currentUser())!
  const canManage = user.role === 'admin' || user.role === 'manager'

  const [rows, stages] = await Promise.all([
    productionService.tracking(),
    productionRepo.listStages(),
  ])

  return (
    <TrackingManager
      rows={rows}
      stages={stages}
      canManage={canManage}
      lsxBase={lsxBase}
    />
  )
}
