import { authService } from '@/modules/core/auth/auth.service'
import { ordersService } from '@/modules/dept/sales/orders.service'
import { DienGiaScreen } from './DienGiaScreen'

export const metadata = { title: 'Bán hàng · Điền đơn giá' }

/**
 * ĐIỀN ĐƠN GIÁ HÀNG LOẠT (/sales/orders/gia).
 *
 * Lý do tồn tại: toàn bộ dòng đơn đang có đơn giá 0, nên doanh số, giá trị đơn,
 * top khách hàng và cả bảng tin Giám đốc đều ra 0. Sửa qua màn sửa đơn thì phải
 * mở từng đơn một. Xem docs/exec-v2-ky-duyet-plan.md §6.
 *
 * Quyền: `pricingBoard` gác `sales.order.manage`; từng dòng còn gác theo CHỦ đơn
 * (canMutateOwned) và trả cờ `editable` để UI khoá dòng của người khác.
 */
export default async function OrderPricingPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>
}) {
  const user = await authService.requirePageUser()
  const [board, sp] = await Promise.all([ordersService.pricingBoard(user), searchParams])
  // ?order= — lối vào "Sửa giá" từ chi tiết đơn đã xuất đủ: lọc sẵn đúng đơn đó.
  const order =
    sp.order && board.lines.some((l) => l.order_id === sp.order) ? sp.order : null
  return <DienGiaScreen board={board} initialOrder={order} />
}
