import { authService } from '@/modules/core/auth/auth.service'
import { chamCongService } from '@/modules/dept/hr/cham-cong/cham-cong.service'
import { todayVn } from '@/lib/date-vn'
import { NhanVienScreen } from '../cham-cong/nhan-vien-screen'

/**
 * NHÂN SỰ › HỒ SƠ NHÂN VIÊN — ai là ai, bộ phận, ca thường làm, mã trên máy, Không
 * chấm công (tách trang 17/10/2026; trước là bước ② của trang Kỳ công).
 */
export default async function NhanVienPage() {
  const user = await authService.requirePageUser()
  const nv = await chamCongService.nhanVien(user, todayVn())
  return <NhanVienScreen nv={nv} />
}
