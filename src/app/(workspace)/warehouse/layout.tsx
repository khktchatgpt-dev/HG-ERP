import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canEnterWorkspace } from '@/workspaces/access'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { WORKSPACES } from '@/workspaces/workspaces.config'

/**
 * Layout workspace Kho. Shell (sidebar + topbar) đặt ở đây nên giữ nguyên khi
 * điều hướng. Quyền vào: theo `canEnterWorkspace` — từ 0086 xem chéo phải có
 * quyền tường minh `workspace.view.warehouse` (openView đã bỏ); quyền này được
 * seed cho Cung ứng để xem phiếu kho. Ghi vẫn bị service chặn theo phòng Kho.
 */
export default async function WarehouseLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await authService.currentUser()
  if (!user) redirect('/login')
  if (!(await canEnterWorkspace(user, 'warehouse'))) redirect('/')

  return <WorkspaceShell workspace={WORKSPACES.warehouse}>{children}</WorkspaceShell>
}
