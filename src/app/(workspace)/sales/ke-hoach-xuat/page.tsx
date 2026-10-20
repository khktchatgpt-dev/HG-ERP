import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { shipPlanService } from '@/modules/dept/sales/ship-plan.service'
import { todayVn } from '@/lib/date-vn'
import { KeHoachXuatScreen } from './KeHoachXuatScreen'

export const metadata = { title: 'Bán hàng · Kế hoạch xuất hàng' }
export const dynamic = 'force-dynamic'

/**
 * KẾ HOẠCH XUẤT HÀNG — "tháng này và các tháng tới xuất cho khách nào, bao
 * nhiêu, đợt nào có nguy cơ trễ?" (06/10/2026). Khung chính THEO LỆNH — Sale lên kế hoạch
 * xuất cho từng lệnh: đợt (PO khách) × SP — xem `lib/ke-hoach-xuat.ts`.
 */
export default async function Page() {
  const user = await authService.requirePageUser()
  const [{ lenhs, dots }, canEdit] = await Promise.all([
    shipPlanService.plan(user),
    canAction(user, 'sales.order.manage'),
  ])
  return (
    <KeHoachXuatScreen lenhs={lenhs} dots={dots} today={todayVn()} canEdit={canEdit} />
  )
}
