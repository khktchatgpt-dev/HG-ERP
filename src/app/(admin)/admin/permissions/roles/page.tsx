import { authService } from '@/modules/core/auth/auth.service'
import { rbacService } from '@/modules/core/rbac/rbac.service'
import { RolesPanel } from '../_components/RolesPanel'

/** Vai trò: danh sách + sửa quyền/vai; chọn vai vào `?r=<roleId>` (deep-link). */
export default async function RolesPage({
  searchParams,
}: {
  searchParams: Promise<{ r?: string }>
}) {
  const user = (await authService.currentUser())!
  const { r } = await searchParams
  const data = await rbacService.rolesData(user)
  return <RolesPanel {...data} initialRoleId={r} />
}
