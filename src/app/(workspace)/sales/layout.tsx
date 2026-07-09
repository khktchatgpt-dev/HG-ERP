import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { isSalesUser } from '@/modules/dept/sales/sales.service'
import { isSupplyStaff } from '@/modules/dept/supply/suppliers.service'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { WORKSPACES } from '@/workspaces/workspaces.config'

/**
 * Layout workspace Sales. Shell (sidebar + topbar) đặt ở đây — page trả nội
 * dung trực tiếp (chuẩn CLAUDE.md). Quyền: admin/manager xem mọi workspace;
 * nhân sự Kinh Doanh; và phòng Kế hoạch - Cung ứng (cần trang "Theo dõi đơn
 * hàng" /sales/tracking ở sidebar Cung ứng). Ghi vẫn bị service chặn theo phòng.
 */
export default async function SalesLayout({ children }: { children: React.ReactNode }) {
  const user = await authService.currentUser()
  if (!user) redirect('/login')
  const allowed =
    user.role === 'admin' ||
    user.role === 'manager' ||
    (await isSalesUser(user)) ||
    (await isSupplyStaff(user))
  if (!allowed) redirect('/')

  return <WorkspaceShell workspace={WORKSPACES.sales}>{children}</WorkspaceShell>
}
