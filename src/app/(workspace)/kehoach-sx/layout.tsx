import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canEnterWorkspace } from '@/workspaces/access'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { WORKSPACES } from '@/workspaces/workspaces.config'

/**
 * Layout các trang KẾ HOẠCH của Sản xuất (lộ trình + giao tổ + hạn + ưu tiên).
 * Đường dẫn `/kehoach-sx/*` giữ nguyên nhưng từ 18/09/2026 thuộc khu
 * `production` (gộp ba khu — xem `altRoutes` ở workspaces.config.ts).
 */
export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await authService.currentUser()
  if (!user) redirect('/login')
  if (!(await canEnterWorkspace(user, 'production'))) redirect('/')

  return <WorkspaceShell workspace={WORKSPACES.production}>{children}</WorkspaceShell>
}
