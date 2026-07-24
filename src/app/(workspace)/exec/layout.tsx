import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { canEnterWorkspace } from '@/workspaces/access'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { WORKSPACES } from '@/workspaces/workspaces.config'

/**
 * Workspace Ban Giám đốc — 0086: CHỈ phòng BGĐ (vai director) + admin.
 * 2 lớp: gate workspace (access.ts) + kiểm permission exec.tower.view tại đây
 * (defense-in-depth — các trang /exec/** không guard riêng từng trang).
 */
export default async function ExecLayout({ children }: { children: React.ReactNode }) {
  const user = await authService.currentUser()
  if (!user) redirect('/login')
  if (!(await canEnterWorkspace(user, 'exec'))) redirect('/')
  if (!(await canAction(user, 'exec.tower.view'))) redirect('/')

  return <WorkspaceShell workspace={WORKSPACES.exec}>{children}</WorkspaceShell>
}
