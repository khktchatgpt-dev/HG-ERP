import { authService } from '@/modules/core/auth/auth.service'
import { rbacService } from '@/modules/core/rbac/rbac.service'
import { MatrixGrid } from '../_components/MatrixGrid'

/** Ma trận Vai×Quyền tổng quan (đọc). */
export default async function MatrixPage() {
  const user = (await authService.currentUser())!
  const data = await rbacService.matrixData(user)
  return <MatrixGrid {...data} />
}
