import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { BoardScreen } from './BoardScreen'

/**
 * Bảng tổng trong workspace SẢN XUẤT — phần riêng của Giám đốc/Ban quản lý
 * (user chốt 07/2026: giao diện GĐ duy nhất). Kế hoạch/Cung ứng dùng bản
 * /planning/board (guard riêng); NV khác bị đẩy về trang chủ xưởng.
 */
export default async function ProductionBoardPage() {
  const user = (await authService.currentUser())!
  if (user.role !== 'admin' && user.role !== 'manager') redirect('/production')
  return <BoardScreen />
}
