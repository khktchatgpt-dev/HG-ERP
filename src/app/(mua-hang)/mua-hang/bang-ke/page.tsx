import { authService } from '@/modules/core/auth/auth.service'
import { listLsxForBangKe } from '@/modules/dept/supply/lsx-bang-ke-list.service'
import { todayVn } from '@/lib/date-vn'
import { BangKeDanhSachScreen } from './BangKeDanhSachScreen'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Mua hàng · Kế hoạch mua' }

/**
 * KẾ HOẠCH MUA — trang menu: chọn lệnh để mở "còn phải mua gì". Danh sách xếp
 * lệnh đã có định mức gắn mã lên trước, vì chỉ lệnh đó mới tính ra số cần.
 * Lệnh nào ĐỔI từ lần soát trước thì xem ở trang riêng `/mua-hang/soat` (T1,
 * 02/11/2026) — màn này không nói chuyện thay đổi nữa.
 */
export default async function Page() {
  await authService.requirePageUser()
  const rows = await listLsxForBangKe()
  return <BangKeDanhSachScreen rows={rows} today={todayVn()} />
}
