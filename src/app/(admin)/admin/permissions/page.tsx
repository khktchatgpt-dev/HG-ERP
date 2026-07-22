import { authService } from '@/modules/core/auth/auth.service'
import { rbacService } from '@/modules/core/rbac/rbac.service'
import { PermissionsManager } from './PermissionsManager'

/**
 * Ma trận phân quyền (RBAC 0073) — CHỈ ĐỌC ở Phase 0. Cho IT nhìn toàn cảnh
 * "vai nào làm được gì" + "ai thuộc vai nào". Ghi (tạo vai, gán quyền) mở ở
 * Phase 3.
 */
export default async function AdminPermissionsPage() {
  const user = (await authService.currentUser())!
  const matrix = await rbacService.matrix(user)
  return <PermissionsManager {...matrix} />
}
