import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canEnterWorkspace } from '@/workspaces/access'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { WORKSPACES } from '@/workspaces/workspaces.config'

/**
 * Layout workspace Kế hoạch - Cung ứng. Shell ở layout (chuẩn CLAUDE.md).
 * Quyền vào: theo `canEnterWorkspace` (openView — mọi NV xem chéo được).
 * Ghi vẫn bị service chặn theo phòng "Kế Hoạch Sản Xuất-cung ứng".
 */
export default async function PlanningLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await authService.currentUser()
  if (!user) redirect('/login')
  if (!(await canEnterWorkspace(user, 'planning'))) redirect('/')

  return <WorkspaceShell workspace={WORKSPACES.planning}>{children}</WorkspaceShell>
}
