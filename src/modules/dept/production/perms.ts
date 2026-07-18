import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import type { User } from '@/modules/core/users/users.repo'

/**
 * Vai KẾ HOẠCH SẢN XUẤT (định hình: bảng chi tiết + lộ trình). Tách vai 07/2026:
 * - 'Kế Hoạch Sản Xuất'            — phòng mới, CHỈ vai kế hoạch.
 * - 'Kế Hoạch Sản Xuất-cung ứng'   — phòng gộp cũ, giữ CẢ HAI vai (người kiêm
 *   nhiệm ở lại đây); có nhân sự mới thì IT đổi phòng ở /admin/users, không
 *   cần sửa code. Vai CUNG ỨNG (PO/NCC) xem supply/suppliers.service.ts.
 */
const PLANNER_DEPT_NAMES = new Set(['Kế Hoạch Sản Xuất-cung ứng', 'Kế Hoạch Sản Xuất'])

export async function isPlannerStaff(user: User): Promise<boolean> {
  if (user.role === 'admin') return true
  if (!user.department_id) return false
  const dept = await departmentsRepo.findById(user.department_id)
  return !!dept && PLANNER_DEPT_NAMES.has(dept.name)
}

/**
 * Quyền ĐỊNH HÌNH sản xuất (bảng chi tiết + lộ trình giai đoạn): vai Kế hoạch
 * + admin/manager. Tách file riêng để components.service và routes.service
 * validate chéo nhau mà không tạo vòng import.
 */
export async function canEditComponents(user: User): Promise<boolean> {
  return user.role === 'admin' || user.role === 'manager' || (await isPlannerStaff(user))
}
