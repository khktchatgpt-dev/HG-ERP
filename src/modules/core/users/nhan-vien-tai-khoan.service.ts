/**
 * Admin › Nhân viên & tài khoản (0247 · bản vẽ duyệt 19/10/2026, Q1–Q5 theo đề xuất).
 *
 * Nhân viên (`hr_employees`, Nhân sự quản) là gốc; tài khoản ERP (`users`, Admin quản)
 * gắn vào. Admin KHÔNG thêm nhân viên (Q3) — chỉ cấp, gắn, khoá tài khoản. Tài khoản
 * dùng chung giữ nguyên, ghi ai đang cầm (Q1). Nhân viên nghỉ việc → trigger DB tự khoá.
 */
import { hashPassword } from '@/modules/core/auth/password'
import { usersRepo, userAuditRepo, type User, type UserRole } from './users.repo'
import { nhanVienTaiKhoanRepo } from './nhan-vien-tai-khoan.repo'
import { assertCan } from '@/server/permissions'
import { safeSyncUserRoles } from '@/modules/core/rbac/rbac.sync'
import { BadRequest, Conflict, NotFound } from '@/server/http'
import { ghepDong, goiYGan, type DongNvTk, type GoiYGan } from '@/lib/nhan-vien-tai-khoan'

/**
 * Trigger 0247 chặn mở/gắn tài khoản vào người đã nghỉ bằng một câu tiếng Việt đã nói
 * cách gỡ; repo ném Error thường → dịch sang 409 để câu đó tới tay người dùng thay vì
 * "Internal server error". Trùng `users_employee_id_uidx` cũng vậy.
 */
export async function dichLoiGan<T>(f: () => Promise<T>): Promise<T> {
  try {
    return await f()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('đã nghỉ việc')) throw Conflict(msg, 'EMPLOYEE_INACTIVE')
    if (msg.includes('users_employee_id_uidx'))
      throw Conflict(
        'Nhân viên này đã có tài khoản khác — gỡ tài khoản kia trước',
        'EMPLOYEE_TAKEN',
      )
    throw e
  }
}

export type NhanVienTaiKhoanData = {
  dong: DongNvTk[]
  goiY: GoiYGan[]
  /** Phòng gợi ý theo tổ của nhân viên (hr_teams.department_id). */
  phongGoiY: Record<string, string>
}

type CapInput = {
  employee_id: string
  email: string
  password: string
  role: UserRole
  department_id: string | null
  title?: string | null
}

export const nhanVienTaiKhoanService = {
  async danhSach(actor: User): Promise<NhanVienTaiKhoanData> {
    assertCan(actor, 'user.manage')
    const [nv, tk] = await Promise.all([
      nhanVienTaiKhoanRepo.nhanVien(),
      nhanVienTaiKhoanRepo.taiKhoan(),
    ])
    const phongGoiY: Record<string, string> = {}
    for (const n of nv) if (n.phongGoiY) phongGoiY[n.id] = n.phongGoiY
    const nvs = nv.map(({ phongGoiY: _p, ...n }) => n)
    return { dong: ghepDong(nvs, tk), goiY: goiYGan(nvs, tk), phongGoiY }
  },

  /** Cấp tài khoản cá nhân từ dòng nhân viên — họ tên lấy từ hồ sơ nhân viên. */
  async capTuNhanVien(actor: User, input: CapInput): Promise<User> {
    assertCan(actor, 'user.manage')
    const nv = await nhanVienTaiKhoanRepo.motNhanVien(input.employee_id)
    if (!nv) throw NotFound('Không tìm thấy nhân viên')
    if (!nv.active)
      throw Conflict(
        `Nhân viên ${nv.code} · ${nv.full_name} đã nghỉ việc — Nhân sự đánh dấu đi làm lại trước khi cấp tài khoản`,
        'EMPLOYEE_INACTIVE',
      )
    const co = await nhanVienTaiKhoanRepo.taiKhoanCuaNhanVien(nv.id)
    if (co)
      throw Conflict(`${nv.full_name} đã có tài khoản ${co.email}`, 'EMPLOYEE_TAKEN')
    if (await usersRepo.existsByEmail(input.email))
      throw Conflict('Email đã có tài khoản khác dùng', 'EMAIL_TAKEN')
    const user = await dichLoiGan(async () =>
      usersRepo.insert({
        email: input.email,
        password_hash: await hashPassword(input.password),
        name: nv.full_name,
        role: input.role,
        department_id: input.department_id,
        title: input.title ?? null,
        employee_id: nv.id,
        employee_code: nv.code,
        account_kind: 'person',
      }),
    )
    await userAuditRepo.insert({
      target_user_id: user.id,
      actor_id: actor.id,
      action: 'create',
      after: {
        email: user.email,
        role: user.role,
        department_id: user.department_id,
        employee_id: nv.id,
        employee_code: nv.code,
      },
    })
    await safeSyncUserRoles(user.id)
    return user
  },

  /**
   * Gắn tài khoản vào một nhân viên (`employeeId`), hoặc gỡ (`null`). Gắn thì tài khoản
   * thành cá nhân. KHÔNG chép họ tên nhân viên đè lên tài khoản: nhiều hồ sơ còn mang tên
   * máy chấm công ("nguyen anh thi") — màn Admin đã hiện tên theo nhân viên rồi.
   */
  async gan(actor: User, userId: string, employeeId: string | null, reason?: string) {
    assertCan(actor, 'user.manage')
    const before = await usersRepo.findById(userId)
    if (!before) throw NotFound('Không tìm thấy tài khoản')
    if (before.deleted_at) throw BadRequest('Tài khoản đã xoá — khôi phục trước khi gắn')
    let patch: Parameters<typeof usersRepo.update>[1]
    if (employeeId) {
      const nv = await nhanVienTaiKhoanRepo.motNhanVien(employeeId)
      if (!nv) throw NotFound('Không tìm thấy nhân viên')
      const co = await nhanVienTaiKhoanRepo.taiKhoanCuaNhanVien(nv.id)
      if (co && co.id !== userId)
        throw Conflict(`${nv.full_name} đã có tài khoản ${co.email}`, 'EMPLOYEE_TAKEN')
      patch = {
        employee_id: nv.id,
        account_kind: 'person',
        shared_holder: null,
        employee_code: nv.code,
      }
    } else {
      patch = { employee_id: null, employee_code: null }
    }
    const user = await dichLoiGan(() => usersRepo.update(userId, patch))
    await userAuditRepo.insert({
      target_user_id: userId,
      actor_id: actor.id,
      action: 'link',
      before: {
        employee_id: before.employee_id,
        account_kind: before.account_kind,
        name: before.name,
      },
      after: {
        employee_id: user.employee_id,
        account_kind: user.account_kind,
        name: user.name,
      },
      reason,
    })
    return user
  },

  /** Gắn một loạt theo danh sách gợi ý đã soát. Lỗi từng dòng không chặn dòng khác. */
  async ganLoat(actor: User, cap: { user_id: string; employee_id: string }[]) {
    assertCan(actor, 'user.manage')
    const loi: { user_id: string; message: string }[] = []
    let xong = 0
    for (const c of cap) {
      try {
        await this.gan(actor, c.user_id, c.employee_id, 'Gắn theo gợi ý khớp họ tên')
        xong++
      } catch (e) {
        loi.push({
          user_id: c.user_id,
          message: e instanceof Error ? e.message : String(e),
        })
      }
    }
    return { xong, loi }
  },

  /** Đánh dấu tài khoản dùng chung (không gắn người) + ghi ai đang cầm. */
  async dungChung(actor: User, userId: string, holder: string | null) {
    assertCan(actor, 'user.manage')
    const before = await usersRepo.findById(userId)
    if (!before) throw NotFound('Không tìm thấy tài khoản')
    if (before.deleted_at) throw BadRequest('Tài khoản đã xoá — khôi phục trước')
    const user = await usersRepo.update(userId, {
      account_kind: 'shared',
      employee_id: null,
      employee_code: null,
      shared_holder: holder,
    })
    await userAuditRepo.insert({
      target_user_id: userId,
      actor_id: actor.id,
      action: 'link',
      before: {
        employee_id: before.employee_id,
        account_kind: before.account_kind,
        shared_holder: before.shared_holder,
      },
      after: { employee_id: null, account_kind: 'shared', shared_holder: holder },
    })
    return user
  },
}
