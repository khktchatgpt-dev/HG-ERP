import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canEnterWorkspace } from '@/workspaces/access'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { WORKSPACES } from '@/workspaces/workspaces.config'

/**
 * Layout workspace Sales. Shell (sidebar + topbar) đặt ở đây — page trả nội
 * dung trực tiếp (chuẩn CLAUDE.md). Quyền vào: theo `canEnterWorkspace`
 * (openView — mọi NV xem chéo được). Ghi vẫn bị service chặn theo phòng Sales.
 * Lưu ý: Cung ứng theo dõi đơn nên dùng route riêng /planning/tracking
 * (re-export) để giữ menu Cung ứng thay vì nhảy shell.
 */
export default async function SalesLayout({ children }: { children: React.ReactNode }) {
  const user = await authService.currentUser()
  if (!user) redirect('/login')
  if (!(await canEnterWorkspace(user, 'sales'))) redirect('/')

  return <WorkspaceShell workspace={WORKSPACES.sales}>{children}</WorkspaceShell>
}
