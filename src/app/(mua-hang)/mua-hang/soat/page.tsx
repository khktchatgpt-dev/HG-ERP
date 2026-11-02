import { authService } from '@/modules/core/auth/auth.service'
import { listLsxForBangKe } from '@/modules/dept/supply/lsx-bang-ke-list.service'
import {
  trangThaiChoSoat,
  type TrangThaiLenhDoi,
} from '@/modules/dept/supply/lenh-doi.service'
import { todayVn } from '@/lib/date-vn'
import { SoatDanhSachScreen } from './SoatDanhSachScreen'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Mua hàng · Soát thay đổi' }

/**
 * SOÁT THAY ĐỔI — danh sách lệnh (T1, bản vẽ FgRYhTxeBoK3JWH6HcRAqE, duyệt
 * 02/11/2026). Tình trạng chờ soát cùng nguồn với số trên menu
 * (`trangThaiChoSoat`). Tính hỏng thì danh sách vẫn mở được — nói ra, không giấu.
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
    <SoatDanhSachScreen
      rows={rows}
      trangThai={tt.data}
      loiTrangThai={tt.loi}
      today={todayVn()}
    />
  )
}
