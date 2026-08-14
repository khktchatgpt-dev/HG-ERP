import { authService } from '@/modules/core/auth/auth.service'
import { settingsService } from '@/modules/core/settings/settings.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { ThresholdsScreen } from './ThresholdsScreen'

/**
 * LUẬT KÝ (/exec/luat-ky) — ngưỡng "giá trị lớn" theo từng tiền tệ.
 *
 * Phiếu đạt/vượt ngưỡng thì không được ký nhanh hàng loạt trong Hộp ký, phải mở
 * ra đọc rồi ký riêng. Trước 14/08 con số này cứng 50 triệu trong mã nguồn và
 * so với MỌI tiền tệ — xem docs/exec-v2-ky-duyet-plan.md §5F.
 */
export default async function ThresholdsPage() {
  const user = await authService.requirePageUser()
  const [thresholds, canEdit] = await Promise.all([
    settingsService.approvalThresholds(),
    canAction(user, 'exec.threshold.manage'),
  ])
  return <ThresholdsScreen thresholds={thresholds} canEdit={canEdit} />
}
