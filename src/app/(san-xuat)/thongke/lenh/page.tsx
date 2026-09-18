import { authService } from '@/modules/core/auth/auth.service'
import { jobsService } from '@/modules/dept/production/jobs.service'
import { isProductionStaff } from '@/modules/dept/production/perms'
import { LenhScreen } from './LenhScreen'
import { resolveView } from './views'

export const dynamic = 'force-dynamic'

/**
 * M2 — LỆNH SẢN XUẤT (Khuôn C, danh sách).
 *
 * Trả lời: "trong các lệnh đang chạy, cái nào cần tôi động vào?".
 *
 * GỘP hai màn từng hỏi cùng một câu bằng hai bộ số khác nhau: `/thongke/lenh`
 * cũ (thẻ, đếm theo VIỆC GHI SỔ) và `/kehoach-sx/lenh` (bảng, đếm theo JOB kế
 * hoạch). Người dùng mở cả hai rồi tự đối chiếu — đúng lối mòn "một câu hỏi
 * hai màn" mà docs/san-xuat-thiet-ke-giao-dien.md §3 đo được.
 *
 * Nguồn số: `jobsService.overview` — CÙNG hàm mà màn Toàn cảnh xưởng dùng, nên
 * hai màn không bao giờ nói hai con số khác nhau về cùng một lệnh.
 */
export default async function LenhPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const user = await authService.requirePageUser()
  const sp = await searchParams
  const [{ rows, stages }, canRecord] = await Promise.all([
    jobsService.overview(user),
    (async () => user.role === 'admin' || (await isProductionStaff(user)))(),
  ])

  // Ô việc ở màn Tình hình xưởng dẫn sang đây KÈM khung nhìn đã lọc — đó là
  // cách con số trên ô giữ lời hứa: bấm vào ra đúng chừng ấy dòng. Khung nhìn
  // lạ thì rơi về "Tất cả", không nổ.
  const view = resolveView(sp.view)

  return (
    <LenhScreen rows={rows} stages={stages} canRecord={canRecord} initialView={view} />
  )
}
