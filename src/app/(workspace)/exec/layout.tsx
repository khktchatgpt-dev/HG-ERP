import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canEnterWorkspace } from '@/workspaces/access'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { WORKSPACES } from '@/workspaces/workspaces.config'

/**
 * Workspace Ban Giám đốc — manager/admin, hoặc nhân sự phòng gán workspace
 * 'exec' (FR-ADM-03, luật ở workspaces/access.ts). KHÔNG openView.
 */
export default async function ExecLayout({ children }: { children: React.ReactNode }) {
  const user = await authService.currentUser()
  if (!user) redirect('/login')
  if (!(await canEnterWorkspace(user, 'exec'))) redirect('/')

  return <WorkspaceShell workspace={WORKSPACES.exec}>{children}</WorkspaceShell>
}
