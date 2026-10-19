import { authService } from '@/modules/core/auth/auth.service'
import { chamCongService } from '@/modules/dept/hr/cham-cong/cham-cong.service'
import { todayVn } from '@/lib/date-vn'
import { NhanVienScreen } from '../nhan-vien-screen'

export const metadata = { title: 'Mã trên máy & ca' }

/**
 * CHẤM CÔNG › MÃ TRÊN MÁY & CA — dọn mã máy, ca thường làm, mã chưa ghép, Không
 * chấm công (tách trang 17/10/2026; trước là bước ② của trang Kỳ công).
 */
export default async function MaMayPage() {
  const user = await authService.requirePageUser()
  const nv = await chamCongService.nhanVien(user, todayVn())
  return <NhanVienScreen nv={nv} />
}
