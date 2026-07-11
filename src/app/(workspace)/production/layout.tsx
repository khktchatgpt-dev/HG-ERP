import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { isProductionStaff } from '@/modules/dept/production/production.service'
import { isSupplyStaff } from '@/modules/dept/supply/suppliers.service'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { WORKSPACES } from '@/workspaces/workspaces.config'

/**
 * Layout workspace Sản xuất (xưởng) — plan-production-workspace P1.
 * Quyền vào: admin/manager (xem chéo), nhân sự phòng gán workspace 'production',
 * hoặc KH-Cung ứng (giám sát — cần Bảng tổng tiến độ /production/board, SX-P5).
 * Ghi (tiến độ/sản lượng) vẫn do service guard.
 */
export default async function ProductionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await authService.currentUser()
  if (!user) redirect('/login')
  const allowed =
    user.role === 'admin' ||
    user.role === 'manager' ||
    (await isProductionStaff(user)) ||
    (await isSupplyStaff(user))
  if (!allowed) redirect('/')

  return <WorkspaceShell workspace={WORKSPACES.production}>{children}</WorkspaceShell>
}
