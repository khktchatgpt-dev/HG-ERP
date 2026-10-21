import type { User } from '@/modules/core/users/users.repo'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { Forbidden } from '@/server/http'

/**
 * Ai thấy LƯƠNG (20/10/2026). Quyền lương là quyền MẬT (0253): chỉ vai "Quản lý lương" (chị
 * Phụng) SỬA, tính, chi. Cùng ngày chủ dự án mở thêm: QUẢN TRỊ VIÊN được XEM — chỉ đọc (hồ sơ
 * lương, bảng lương, Excel, số tài khoản, lương trên HĐ), không sửa / tính / gửi / chi. Mọi lần
 * xem vẫn ghi nhật ký `hr_private_access_log` như người quản lý lương.
 *
 * Không làm bằng cách bỏ cờ `mat` ở actions.ts: bỏ thì quản trị viên có luôn quyền SỬA vì quản
 * trị bỏ qua mọi kiểm quyền thường.
 */
export const QUYEN_SUA_LUONG = 'hr.payroll.profile'

/** Sửa hồ sơ lương / lương trên HĐ — chỉ người quản lý lương. */
export function suaLuong(user: User): Promise<boolean> {
  return canAction(user, QUYEN_SUA_LUONG)
}

/** Xem lương — người quản lý lương, hoặc quản trị viên (chỉ đọc). */
export async function xemLuong(user: User): Promise<boolean> {
  return user.role === 'admin' || (await suaLuong(user))
}

export async function assertXemLuong(user: User): Promise<void> {
  if (!(await xemLuong(user)))
    throw Forbidden('Lương chỉ người quản lý lương và quản trị viên xem được')
}
