import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canEnterWorkspace } from '@/workspaces/access'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { WORKSPACES } from '@/workspaces/workspaces.config'

/**
 * Layout workspace Tổ sản xuất — tổ trưởng/tổ viên (nhãn 0087), mobile-first.
 * Gate: canEnterWorkspace('team') (gia đình SX — access.ts).
 */
export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await authService.currentUser()
  if (!user) redirect('/login')
  if (!(await canEnterWorkspace(user, 'team'))) redirect('/')

  return <WorkspaceShell workspace={WORKSPACES.team}>{children}</WorkspaceShell>
}
