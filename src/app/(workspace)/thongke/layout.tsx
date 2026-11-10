import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canEnterWorkspace } from '@/workspaces/access'
import { khuChoTrangChung } from '@/workspaces/resolveWorkspace'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { WORKSPACES, type WorkspaceConfig } from '@/workspaces/workspaces.config'

/**
 * Layout các trang `/thongke/*` còn ở vỏ có đệm (Sổ ngày & chốt sổ…). URL giữ
 * nguyên từ 18/09/2026; từ 10/11/2026 các trang này thuộc khu `thongke` (tách
 * khỏi Sản xuất) nhưng Sản xuất vẫn mở được — sidebar theo khu người xem đang
 * đứng, gate dùng chung quyền của gia đình SX.
 */
const GIA_DINH = (ws: WorkspaceConfig) => ws.id === 'production' || ws.id === 'thongke'

export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await authService.currentUser()
  if (!user) redirect('/login')
  if (!(await canEnterWorkspace(user, 'production'))) redirect('/')
  const dang = await khuChoTrangChung(user, GIA_DINH)
  const ws = dang && GIA_DINH(dang) ? dang : WORKSPACES.thongke

  return <WorkspaceShell workspace={ws}>{children}</WorkspaceShell>
}
