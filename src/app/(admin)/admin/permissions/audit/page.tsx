import { authService } from '@/modules/core/auth/auth.service'
import { rbacService } from '@/modules/core/rbac/rbac.service'
import { AuditTable } from '../_components/AuditTable'

/** Nhật ký audit thao tác phân quyền. */
export default async function AuditPage() {
  const user = (await authService.currentUser())!
  const entries = await rbacService.audit(user)
  return <AuditTable entries={entries} />
}
