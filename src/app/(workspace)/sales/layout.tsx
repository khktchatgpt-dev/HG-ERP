import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { isSalesUser } from '@/modules/dept/sales/sales.service'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { WORKSPACES } from '@/workspaces/workspaces.config'

/**
 * Layout workspace Sales. Shell (sidebar + topbar) đặt ở đây — page trả nội
 * dung trực tiếp (chuẩn CLAUDE.md). Quyền: admin/manager xem mọi workspace;
 * ngoài ra chỉ nhân sự Kinh Doanh.
 */
export default async function SalesLayout({ children }: { children: React.ReactNode }) {
  const user = await authService.currentUser()
  if (!user) redirect('/login')
  const allowed =
    user.role === 'admin' || user.role === 'manager' || (await isSalesUser(user))
  if (!allowed) redirect('/')

  return <WorkspaceShell workspace={WORKSPACES.sales}>{children}</WorkspaceShell>
}
