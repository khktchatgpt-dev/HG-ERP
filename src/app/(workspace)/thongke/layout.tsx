import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canEnterWorkspace } from '@/workspaces/access'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { WORKSPACES } from '@/workspaces/workspaces.config'

/**
 * Layout các trang GHI SỔ của Sản xuất. Đường dẫn `/thongke/*` giữ nguyên
 * nhưng từ 18/09/2026 chúng thuộc khu `production` (gộp ba khu — xem
 * `altRoutes` ở workspaces.config.ts), nên shell và gate đều dùng workspace đó.
 */
export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await authService.currentUser()
  if (!user) redirect('/login')
  if (!(await canEnterWorkspace(user, 'production'))) redirect('/')

  return <WorkspaceShell workspace={WORKSPACES.production}>{children}</WorkspaceShell>
}
