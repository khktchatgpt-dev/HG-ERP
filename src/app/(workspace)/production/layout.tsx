import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canEnterWorkspace } from '@/workspaces/access'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { WORKSPACES } from '@/workspaces/workspaces.config'

/**
 * Layout workspace Sản xuất (xưởng) — plan-production-workspace P1.
 * Quyền vào: theo `canEnterWorkspace` — từ 0086 xem chéo phải có quyền tường
 * minh `workspace.view.production` (openView đã bỏ); quyền này được seed cho
 * Kế hoạch & Cung ứng để giám sát tiến độ (SX-P5).
 * Ghi (tiến độ/sản lượng) vẫn do service guard.
 */
export default async function ProductionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await authService.currentUser()
  if (!user) redirect('/login')
  if (!(await canEnterWorkspace(user, 'production'))) redirect('/')

  return <WorkspaceShell workspace={WORKSPACES.production}>{children}</WorkspaceShell>
}
