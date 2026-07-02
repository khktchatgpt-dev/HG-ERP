import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { WORKSPACES } from '@/workspaces/workspaces.config'

/**
 * Layout của khu quản trị (System workspace).
 * Shell (sidebar + topbar) đặt ở đây nên giữ nguyên khi điều hướng —
 * chỉ vùng nội dung được thay bằng loading.tsx khi chuyển trang.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await authService.currentUser()
  if (!user) redirect('/login')
  if (user.role !== 'admin') redirect('/')

  return <WorkspaceShell workspace={WORKSPACES.system}>{children}</WorkspaceShell>
}
