import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { planCostService } from '@/modules/dept/technical/plan-cost.service'
import { GiaThanhScreen } from './GiaThanhScreen'

export const metadata = { title: 'Bán hàng · Giá thành kế hoạch' }
export const dynamic = 'force-dynamic'

/**
 * GIÁ THÀNH KẾ HOẠCH THEO SẢN PHẨM (0220) — bốn số từ bảng tính giá của Sale.
 *
 * Câu hỏi của màn: *"SP đang chạy nào chưa có giá thành kế hoạch, và số đó
 * lấy từ bản báo giá nào?"* Khuôn F: dán từ Excel, xem lại, lưu một lần — cùng
 * cách với Bảng giá đơn hàng. Shell nằm ở layout của workspace Sales.
 */
export default async function Page() {
  const user = await authService.requirePageUser()
  // Số riêng của Bán hàng: không có quyền xem thì về trang Bán hàng, không bày gì.
  if (!(await canAction(user, 'technical.plan_cost.view'))) redirect('/sales')
  const [board, canManage] = await Promise.all([
    planCostService.board(user),
    canAction(user, 'technical.plan_cost.manage'),
  ])
  return <GiaThanhScreen board={board} canManage={canManage} />
}
