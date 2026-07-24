import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canEnterWorkspace } from '@/workspaces/access'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { WORKSPACES } from '@/workspaces/workspaces.config'

/**
 * Layout workspace Kế hoạch sản xuất — planner lên lộ trình + giao tổ + hạn + ưu tiên.
 * Gate: canEnterWorkspace('prodplan') (gia đình SX — access.ts).
 */
export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await authService.currentUser()
  if (!user) redirect('/login')
  if (!(await canEnterWorkspace(user, 'prodplan'))) redirect('/')

  return <WorkspaceShell workspace={WORKSPACES.prodplan}>{children}</WorkspaceShell>
}
