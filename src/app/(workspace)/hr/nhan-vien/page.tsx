import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { hoSoNvService } from '@/modules/dept/hr/cham-cong/ho-so-nv.service'
import { todayVn } from '@/lib/date-vn'
import { NhanVienDsScreen } from './NhanVienDsScreen'

export const metadata = { title: 'Hồ sơ nhân viên' }

/**
 * NHÂN SỰ › HỒ SƠ NHÂN VIÊN — danh sách (B2a, bản vẽ lượt 2). Bấm dòng mở
 * /hr/nhan-vien/[mã]. Dọn mã máy ở /hr/cham-cong/ma-may.
 */
export default async function NhanVienPage() {
  const user = await authService.requirePageUser()
  const homNay = todayVn()
  const [nv, sua] = await Promise.all([
    hoSoNvService.danhSach(user, homNay),
    canAction(user, 'hr.attendance.employee_edit'),
  ])
  return <NhanVienDsScreen h={{ nv, sua, homNay }} />
}
