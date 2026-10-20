import { authService } from '@/modules/core/auth/auth.service'
import { nhanVienTaiKhoanService } from '@/modules/core/users/nhan-vien-tai-khoan.service'
import { departmentsService } from '@/modules/core/departments/departments.service'
import { NhanVienTaiKhoanScreen } from './NhanVienTaiKhoanScreen'

export const metadata = { title: 'Nhân viên & tài khoản' }

/** Admin › Nhân viên & tài khoản (0252) — thay trang Người dùng cũ. */
export default async function AdminUsersPage() {
  const user = await authService.requirePageUser()
  const [data, departments] = await Promise.all([
    nhanVienTaiKhoanService.danhSach(user),
    departmentsService.list(),
  ])
  return (
    <NhanVienTaiKhoanScreen
      h={{
        ...data,
        phong: departments.map((p) => ({ id: p.id, name: p.name })),
        toi: user.id,
      }}
    />
  )
}
