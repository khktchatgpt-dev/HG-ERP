import { authService } from '@/modules/core/auth/auth.service'
import { salesHomeService } from '@/modules/dept/sales/sales-home.service'
import { todayVn } from '@/lib/date-vn'
import { TrangChuSaleScreen } from './TrangChuSaleScreen'

export const metadata = { title: 'Bán hàng · Hôm nay' }
export const dynamic = 'force-dynamic'

/**
 * TRANG CHỦ SALE — "hôm nay tôi phải làm gì?" (06/10/2026). Thay bản cũ 8 ô KPI
 * + danh sách việc theo hạn đơn (chỉ 44/53 đơn có hạn). Các loại việc tính ở
 * `salesHomeService.home`, CÙNG nguồn với trang đích — xem `lib/viec-sale.ts`.
 * Hiện việc của CẢ PHÒNG (chưa lọc theo người phụ trách khách).
 */
export default async function SalesHomePage() {
  const user = await authService.requirePageUser()
  const home = await salesHomeService.home(user, todayVn())
  return <TrangChuSaleScreen home={home} userName={user.name ?? user.email} />
}
