import { authService } from '@/modules/core/auth/auth.service'
import { listLsxForBangKe } from '@/modules/dept/supply/lsx-bang-ke-list.service'
import {
  trangThaiChoSoat,
  type TrangThaiLenhDoi,
} from '@/modules/dept/supply/lenh-doi.service'
import { todayVn } from '@/lib/date-vn'
import { BangKeDanhSachScreen } from './BangKeDanhSachScreen'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Mua hàng · Kế hoạch mua' }

/**
 * KẾ HOẠCH MUA — trang menu: chọn lệnh để mở "còn phải mua gì". Từ 02/11/2026
 * (B2, bản vẽ RL9ToGvjouLFkhNVeruAbS) lệnh có định mức / lệnh ĐỔI từ lần soát
 * trước lên đầu, cùng nguồn với số trên menu (`trangThaiChoSoat`).
 *
 * Tình trạng chờ soát hỏng thì danh sách vẫn phải mở được — nói ra, không giấu.
 */
export default async function Page() {
  await authService.requirePageUser()
  const [rows, tt] = await Promise.all([
    listLsxForBangKe(),
    trangThaiChoSoat().then(
      (m) => ({
        data: Object.fromEntries(m) as Record<string, TrangThaiLenhDoi>,
        loi: null,
      }),
      (e: unknown) => ({ data: {}, loi: e instanceof Error ? e.message : String(e) }),
    ),
  ])
  return (
    <BangKeDanhSachScreen
      rows={rows}
      trangThai={tt.data}
      loiTrangThai={tt.loi}
      today={todayVn()}
    />
  )
}
