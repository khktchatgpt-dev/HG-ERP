import type { User } from '@/modules/core/users/users.repo'
import { hasPermission } from '@/modules/core/rbac/rbac.service'

// Phase 2 RBAC: guard đọc thẳng permission (bỏ hardcode tên phòng).
export async function isPlannerStaff(user: User): Promise<boolean> {
  return hasPermission(user, 'planner.member')
}

/**
 * Quyền ĐỊNH HÌNH sản xuất (bảng chi tiết + lộ trình giai đoạn): permission
 * production.components.edit (seed gán director/manager + planner). Tách file
 * riêng để components.service và routes.service validate chéo mà không vòng import.
 */
export async function canEditComponents(user: User): Promise<boolean> {
  return hasPermission(user, 'production.components.edit')
}
