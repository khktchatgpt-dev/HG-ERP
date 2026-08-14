import { authService } from '@/modules/core/auth/auth.service'
import { execService } from '@/modules/core/exec/exec.service'
import { SignBoxScreen } from './SignBoxScreen'

/**
 * Trang chủ khu Ban Giám đốc = HỘP KÝ (14/08/2026).
 *
 * Lịch sử: trang này từng redirect sang Tháp điều hành (sơ đồ xưởng), rồi thành
 * Bảng tin điều hành nhiều thẻ (09/08). Chủ dự án chốt lại: việc DUY NHẤT của
 * Giám đốc trên hệ thống là ký phiếu — nên trang chủ là hộp phiếu chờ ký, ký
 * được ngay tại chỗ. Xem docs/exec-v2-ky-duyet-plan.md §5B.
 *
 * `ExecDashboard.tsx` còn trong repo nhưng KHÔNG còn nơi gọi — xoá cùng đợt dọn
 * /exec/orders + /exec/purchasing khi chốt §8.6.
 */
export default async function ExecHome() {
  const user = await authService.requirePageUser()
  const box = await execService.signBox(user)
  return <SignBoxScreen box={box} />
}
