import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { isWarehouseUser } from '@/modules/dept/warehouse/warehouse.service'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { WORKSPACES } from '@/workspaces/workspaces.config'

/**
 * Layout workspace Kho. Shell (sidebar + topbar) đặt ở đây nên giữ nguyên khi
 * điều hướng. Quyền: admin xem mọi workspace; ngoài ra chỉ nhân sự phòng Kho.
 */
export default async function WarehouseLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await authService.currentUser()
  if (!user) redirect('/login')
  if (!(await isWarehouseUser(user))) redirect('/')

  return <WorkspaceShell workspace={WORKSPACES.warehouse}>{children}</WorkspaceShell>
}
