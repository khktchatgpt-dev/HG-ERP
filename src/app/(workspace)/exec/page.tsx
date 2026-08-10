import { authService } from '@/modules/core/auth/auth.service'
import { execService } from '@/modules/core/exec/exec.service'
import { ExecDashboard } from './ExecDashboard'

/**
 * Trang chủ khu Ban Giám đốc = BẢNG TIN ĐIỀU HÀNH (09/08/2026, chủ dự án chốt
 * "phần của giám đốc giới hạn ở thông tin trọng yếu của Sale và Cung ứng").
 *
 * Trước đây trang này redirect thẳng sang Tháp điều hành (COO — sơ đồ xưởng);
 * xưởng chưa lên hệ thống nên màn đó rỗng hoàn toàn, đã rút khỏi điều hướng.
 */
export default async function ExecHome() {
  const user = await authService.requirePageUser()
  const data = await execService.dashboard(user)
  return <ExecDashboard data={data} />
}
