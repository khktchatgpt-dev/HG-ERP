import { authService } from '@/modules/core/auth/auth.service'
import { execService } from '@/modules/core/exec/exec.service'
import { ExecHomeScreen } from './ExecHomeScreen'

/**
 * Trang chủ khu Ban Giám đốc = TỔNG QUAN (15/08/2026).
 *
 * Lịch sử: Tháp điều hành → Bảng tin điều hành (09/08) → Hộp ký (14/08, "việc
 * duy nhất của GĐ là ký") → bản này. Chủ dự án đảo lại thiết kế: phê duyệt vẫn
 * là trung tâm nhưng chuyển về /exec/approvals (Trung tâm phê duyệt), còn trang
 * chủ trả lời ba câu: hôm nay tôi phải duyệt gì / công ty đang chạy thế nào /
 * có gì cần xử lý. Xem docs/exec-v3-approval-center.md.
 */
export default async function ExecHome() {
  const user = await authService.requirePageUser()
  const data = await execService.dashboard(user)
  return <ExecHomeScreen data={data} userName={user.name ?? user.email} />
}
