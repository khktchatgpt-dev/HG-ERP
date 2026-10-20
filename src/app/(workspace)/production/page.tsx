import { authService } from '@/modules/core/auth/auth.service'
import { jobsService } from '@/modules/dept/production/jobs.service'
import { isProductionStaff } from '@/modules/dept/production/perms'
import { TinhHinhScreen } from './TinhHinhScreen'

export const dynamic = 'force-dynamic'

/**
 * M1 — TÌNH HÌNH XƯỞNG (Khuôn A). Cửa vào khu Sản xuất.
 *
 * Thay `OverviewScreen` cũ (theme v3, gom mọi khối vào một trang: dải KPI,
 * bảng lệnh đầy đủ, tải tổ, chờ giao hàng). Chủ dự án đã chốt 05/09 rằng tổng
 * quan chỉ giữ KPI + vài dòng nổi bật + đường dẫn — bảng lệnh đầy đủ nay là
 * một màn riêng (M2, `/thongke/lenh`) và mỗi ô việc ở đây dẫn thẳng sang đó
 * với khung nhìn đã lọc sẵn.
 *
 * Khối "Chờ giao hàng" CỐ Ý bỏ: nó hỏi câu của Bán hàng ("đơn nào xong mà chưa
 * giao"), không phải câu của quản đốc xưởng. Một màn một câu hỏi.
 */
export default async function ProductionEntryPage() {
  const user = await authService.requirePageUser()

  const [{ rows, workload, pulse }, canRecord] = await Promise.all([
    jobsService.overview(user),
    (async () => user.role === 'admin' || (await isProductionStaff(user)))(),
  ])

  return (
    <TinhHinhScreen rows={rows} workload={workload} pulse={pulse} canRecord={canRecord} />
  )
}
