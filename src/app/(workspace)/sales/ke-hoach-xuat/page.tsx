import { authService } from '@/modules/core/auth/auth.service'
import { shipPlanService } from '@/modules/dept/sales/ship-plan.service'
import { todayVn } from '@/lib/date-vn'
import { KeHoachXuatScreen } from './KeHoachXuatScreen'

export const metadata = { title: 'Bán hàng · Kế hoạch xuất hàng' }
export const dynamic = 'force-dynamic'

/**
 * KẾ HOẠCH XUẤT HÀNG — "tháng này và các tháng tới xuất cho khách nào, bao
 * nhiêu, đợt nào có nguy cơ trễ?" (bản vẽ duyệt 06/10/2026). Đơn vị là ĐỢT
 * (nhóm lệnh), không phải lệnh — xem `lib/ke-hoach-xuat.ts`.
 */
export default async function Page() {
  const user = await authService.requirePageUser()
  const dots = await shipPlanService.board(user)
  return <KeHoachXuatScreen dots={dots} today={todayVn()} />
}
