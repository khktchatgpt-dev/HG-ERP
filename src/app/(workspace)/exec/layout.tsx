import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { WORKSPACES } from '@/workspaces/workspaces.config'

/** Workspace Ban Giám đốc — chỉ manager/admin (FR-ADM-03). */
export default async function ExecLayout({ children }: { children: React.ReactNode }) {
  const user = await authService.currentUser()
  if (!user) redirect('/login')
  if (user.role !== 'admin' && user.role !== 'manager') redirect('/')

  return <WorkspaceShell workspace={WORKSPACES.exec}>{children}</WorkspaceShell>
}
