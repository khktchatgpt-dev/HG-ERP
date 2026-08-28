import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canEnterWorkspace } from '@/workspaces/access'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { WORKSPACES } from '@/workspaces/workspaces.config'

/**
 * Layout workspace Thống kê xưởng — dựng lại 26/08/2026 theo khung 5 bước.
 * Gate: canEnterWorkspace('stat') (gia đình SX — xem workspaces/access.ts).
 */
export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await authService.currentUser()
  if (!user) redirect('/login')
  if (!(await canEnterWorkspace(user, 'stat'))) redirect('/')

  return <WorkspaceShell workspace={WORKSPACES.stat}>{children}</WorkspaceShell>
}
