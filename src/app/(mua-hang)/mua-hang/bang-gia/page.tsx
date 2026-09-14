import { authService } from '@/modules/core/auth/auth.service'
import { isSupplyStaff } from '@/modules/dept/supply/suppliers.service'
import { loadPriceBook } from '@/modules/dept/supply/pos.repo'
import { BangGiaScreen } from './BangGiaScreen'

export const metadata = { title: 'Mua hàng · Bảng giá' }
export const dynamic = 'force-dynamic'

/**
 * BẢNG GIÁ — Khuôn C, dựng bằng kit (Đợt 3, 15/09/2026). Thay trang tạm.
 *
 * Câu trang trả lời: "Ai chào giá bao nhiêu, còn hiệu lực không?"
 *
 * NGUỒN LÀ LỊCH SỬ ĐƠN, KHÔNG PHẢI BẢNG GIÁ KHAI TAY. Đo 15/09/2026:
 * `supply_supplier_prices` mới có **10 dòng**, trong khi dòng đơn đã gửi NCC
 * có giá là **192**. Dựng trên bảng khai tay thì ra một trang gần như trống,
 * còn giá THẬT thì nằm ngay trong đơn — và nó là giá đã ký, không phải giá
 * chào suông. Khi nào phòng khai bảng giá tử tế thì trộn thêm nguồn đó vào,
 * không phải dựng lại màn.
 *
 * Một dòng = MỘT VẬT TƯ MUA CỦA MỘT NCC, giữ giá lần gần nhất + giá lần trước
 * để nói được "8.200 → 8.500".
 */
export default async function Page() {
  const user = await authService.requirePageUser()
  const [rows, supplyStaff] = await Promise.all([loadPriceBook(), isSupplyStaff(user)])
  return (
    <BangGiaScreen rows={rows} canEdit={user.role === 'admin' || supplyStaff} />
  )
}
