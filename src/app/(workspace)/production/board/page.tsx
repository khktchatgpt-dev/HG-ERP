import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { isPlannerStaff } from '@/modules/dept/production/perms'
import { isSupplyStaff } from '@/modules/dept/supply/suppliers.service'
import { BoardScreen } from './BoardScreen'

/**
 * BẢNG TỔNG tiến độ (chỉ xem) trong workspace SẢN XUẤT — nơi DUY NHẤT của bảng
 * này (user chốt: tiến độ nằm bên Sản xuất). Xem được: Giám đốc/QL + Kế hoạch +
 * Cung ứng — họ vào ws Sản xuất xem tại đây (giống Định hình). NV tổ bị đẩy về
 * trang chủ xưởng. /planning/board redirect về đây.
 */
export default async function ProductionBoardPage() {
  const user = (await authService.currentUser())!
  const allowed =
    user.role === 'admin' ||
    user.role === 'manager' ||
    (await isPlannerStaff(user)) ||
    (await isSupplyStaff(user))
  if (!allowed) redirect('/production')
  return <BoardScreen />
}
