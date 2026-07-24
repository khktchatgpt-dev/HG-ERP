import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canEnterWorkspace } from '@/workspaces/access'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { WORKSPACES } from '@/workspaces/workspaces.config'

/**
 * Layout workspace Thống kê xưởng — sổ số liệu tập trung + định hình + gia công (nhãn 0087).
 * Gate: canEnterWorkspace('stat') (gia đình SX — access.ts).
 */
export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await authService.currentUser()
  if (!user) redirect('/login')
  if (!(await canEnterWorkspace(user, 'stat'))) redirect('/')

  return <WorkspaceShell workspace={WORKSPACES.stat}>{children}</WorkspaceShell>
}
