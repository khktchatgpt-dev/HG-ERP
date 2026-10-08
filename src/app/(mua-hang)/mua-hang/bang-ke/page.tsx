import { authService } from '@/modules/core/auth/auth.service'
import { listLsxForBangKe } from '@/modules/dept/supply/lsx-bang-ke-list.service'
import { todayVn } from '@/lib/date-vn'
import { BangKeDanhSachScreen } from './BangKeDanhSachScreen'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Mua hàng · Bảng kê vật tư' }

/**
 * BẢNG KÊ VẬT TƯ — trang menu (08/10/2026): chọn lệnh để mở bảng kê "còn phải
 * mua gì". Danh sách xếp lệnh đã có định mức gắn mã lên trước, vì chỉ lệnh đó
 * mới tính ra số cần.
 */
export default async function Page() {
  await authService.requirePageUser()
  const rows = await listLsxForBangKe()
  return <BangKeDanhSachScreen rows={rows} today={todayVn()} />
}
