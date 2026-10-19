import { db } from '@/server/db'
import type { NvGoc, TkGoc } from '@/lib/nhan-vien-tai-khoan'

/** Đọc hai danh sách người cho màn Admin › Nhân viên & tài khoản (0252). */
export const nhanVienTaiKhoanRepo = {
  /** Mọi nhân viên (cả đã nghỉ) kèm tên tổ và phòng gợi ý theo tổ. */
  async nhanVien(): Promise<(NvGoc & { phongGoiY: string | null })[]> {
    const { data, error } = await db()
      .from('hr_employees')
      .select(
        'id, code, full_name, team, team_id, active, attendance_exempt, hr_teams(name, department_id)',
      )
      .order('code')
    if (error) throw new Error(error.message)
    return (data ?? []).map((e) => {
      const t = e.hr_teams as { name: string; department_id: string | null } | null
      return {
        id: e.id,
        ma: e.code,
        ten: e.full_name,
        to: t?.name ?? e.team,
        toId: e.team_id,
        dangLam: e.active,
        khongCham: e.attendance_exempt,
        phongGoiY: t?.department_id ?? null,
      }
    })
  },

  async motNhanVien(id: string) {
    const { data } = await db()
      .from('hr_employees')
      .select('id, code, full_name, active, hr_teams(department_id)')
      .eq('id', id)
      .maybeSingle()
    return data
  },

  /** Mọi tài khoản (cả đã khoá, đã xoá). */
  async taiKhoan(): Promise<TkGoc[]> {
    const { data, error } = await db()
      .from('users')
      .select(
        'id, email, name, role, department_id, title, is_active, deleted_at, employee_id, account_kind, shared_holder, last_login_at, must_change_password',
      )
      .order('name')
    if (error) throw new Error(error.message)
    return (data ?? []).map((u) => ({
      id: u.id,
      email: u.email,
      ten: u.name,
      role: u.role,
      phongId: u.department_id,
      title: u.title,
      dangMo: u.is_active,
      xoaLuc: u.deleted_at,
      nvId: u.employee_id,
      dungChung: u.account_kind === 'shared',
      nguoiCam: u.shared_holder,
      dangNhap: u.last_login_at,
      doiMk: u.must_change_password,
    }))
  },

  async taiKhoanCuaNhanVien(employeeId: string) {
    const { data } = await db()
      .from('users')
      .select('id, email')
      .eq('employee_id', employeeId)
      .maybeSingle()
    return data
  },
}
