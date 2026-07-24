import { authService } from '@/modules/core/auth/auth.service'
import { jobsService } from '@/modules/dept/production/jobs.service'
import { lsxService } from '@/modules/dept/production/lsx.service'
import { OverviewScreen, type WaitingDeliveryRow } from './OverviewScreen'

export const dynamic = 'force-dynamic'

/**
 * CỬA VÀO workspace Sản xuất — TÁCH UI THEO VAI (chỉ giao diện, không tách
 * quyền — user chốt): thành viên xưởng (tổ trưởng/thống kê) rơi thẳng vào
 * "Việc của tổ" — màn tác nghiệp của họ; các mục khác (Sổ, Định hình) nằm
 * ngay trên menu. Quản đốc/GĐ (admin·manager), Kế hoạch, Cung ứng và người
 * xem chéo thấy TOÀN CẢNH tại đây. Menu "Toàn cảnh" ẩn với thành viên xưởng
 * nhưng vào bằng URL vẫn xem được (không chặn quyền).
 */
export default async function ProductionEntryPage() {
  const user = (await authService.currentUser())!

  const [{ rows, workload, stages }, tracking] = await Promise.all([
    jobsService.overview(user),
    lsxService.tracking(),
  ])

  // Khép chuỗi: LSX đã hoàn thành, đơn chưa giao → dải "Chờ giao hàng".
  const waiting: WaitingDeliveryRow[] = tracking
    .filter((r) => r.lsx_status === 'completed' && r.status === 'completed')
    .map((r) => ({
      order_id: r.id,
      order_code: r.code,
      lsx_code: r.lsx_code ?? '?',
      customer_name: r.customer_name,
      ship_date: r.ship_date,
    }))

  const canOperate = user.role === 'admin' || user.role === 'manager'

  return (
    <OverviewScreen
      rows={rows}
      workload={workload}
      stages={stages}
      waiting={waiting}
      canOperate={canOperate}
    />
  )
}
