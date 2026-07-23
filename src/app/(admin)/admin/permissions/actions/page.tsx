import { authService } from '@/modules/core/auth/auth.service'
import { rbacService } from '@/modules/core/rbac/rbac.service'
import { ActionCatalog } from '../_components/ActionCatalog'

/** Sổ tay thao tác: mỗi thao tác + luật authz đọc được (nguồn: registry actions). */
export default async function ActionsPage() {
  const user = (await authService.currentUser())!
  const permissions = await rbacService.catalog(user)
  const permLabels = Object.fromEntries(permissions.map((p) => [p.key, p.label]))
  return <ActionCatalog permLabels={permLabels} />
}
