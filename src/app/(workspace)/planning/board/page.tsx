import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { isPlannerStaff } from '@/modules/dept/production/perms'
import { isSupplyStaff } from '@/modules/dept/supply/suppliers.service'
import { BoardScreen } from '../../production/board/BoardScreen'

/**
 * Bảng tổng trong shell KẾ HOẠCH - CUNG ỨNG: Kế hoạch/Cung ứng cần toàn cảnh
 * chi tiết × công đoạn để lập kế hoạch mua/đặt vật tư. NV khác bị đẩy về
 * trang chủ planning (màn điều hành /production/board là phần riêng của GĐ —
 * tách vai 07/2026).
 */
export default async function PlanningBoardPage() {
  const user = (await authService.currentUser())!
  const allowed =
    user.role === 'admin' ||
    user.role === 'manager' ||
    (await isPlannerStaff(user)) ||
    (await isSupplyStaff(user))
  if (!allowed) redirect('/planning')
  return <BoardScreen />
}
