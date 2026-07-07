import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { isSupplyStaff } from '@/modules/dept/supply/suppliers.service'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { WORKSPACES } from '@/workspaces/workspaces.config'

/**
 * Layout workspace Kế hoạch - Cung ứng. Shell ở layout (chuẩn CLAUDE.md).
 * Quyền: admin/manager xem mọi workspace; ngoài ra chỉ phòng
 * "Kế Hoạch Sản Xuất-cung ứng".
 */
export default async function PlanningLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await authService.currentUser()
  if (!user) redirect('/login')
  const allowed =
    user.role === 'admin' || user.role === 'manager' || (await isSupplyStaff(user))
  if (!allowed) redirect('/')

  return <WorkspaceShell workspace={WORKSPACES.planning}>{children}</WorkspaceShell>
}
