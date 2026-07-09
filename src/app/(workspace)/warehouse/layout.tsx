import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { isWarehouseUser } from '@/modules/dept/warehouse/warehouse.service'
import { isSupplyStaff } from '@/modules/dept/supply/suppliers.service'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { WORKSPACES } from '@/workspaces/workspaces.config'

/**
 * Layout workspace Kho. Shell (sidebar + topbar) đặt ở đây nên giữ nguyên khi
 * điều hướng. Quyền: admin xem mọi workspace; ngoài ra chỉ nhân sự phòng Kho.
 */
export default async function WarehouseLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await authService.currentUser()
  if (!user) redirect('/login')
  // FR-ADM-02: manager xem chéo read-only; ghi vẫn bị service chặn theo phòng Kho.
  // Phòng Kế hoạch - Cung ứng cũng cần xem phiếu kho (link "Phiếu kho" ở sidebar).
  const allowed =
    user.role === 'admin' ||
    user.role === 'manager' ||
    (await isWarehouseUser(user)) ||
    (await isSupplyStaff(user))
  if (!allowed) redirect('/')

  return <WorkspaceShell workspace={WORKSPACES.warehouse}>{children}</WorkspaceShell>
}
