import { authService } from '@/modules/core/auth/auth.service'
import { rbacService } from '@/modules/core/rbac/rbac.service'
import { PermissionsManager } from './PermissionsManager'

/**
 * Ma trận phân quyền (RBAC 0073) — IT tự phục vụ (Phase 3): xem "vai làm được
 * gì" + "ai thuộc vai nào", tạo/sửa vai, gán quyền cho vai, gán vai cho người
 * dùng (source='manual'), và xem nhật ký audit (0075).
 */
export default async function AdminPermissionsPage() {
  const user = (await authService.currentUser())!
  const matrix = await rbacService.matrix(user)
  return <PermissionsManager {...matrix} />
}
