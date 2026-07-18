import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canEnterWorkspace } from '@/workspaces/access'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { WORKSPACES } from '@/workspaces/workspaces.config'

/**
 * Layout workspace Kỹ thuật. Shell (sidebar + topbar sky) đặt ở đây nên
 * giữ nguyên khi điều hướng — chỉ nội dung thay bằng loading.tsx.
 *
 * Quyền vào: theo `canEnterWorkspace` (openView — mọi NV xem chéo được, xem
 * workspaces/access.ts). Ghi vẫn bị service chặn theo phòng Kỹ thuật.
 */
export default async function TechnicalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await authService.currentUser()
  if (!user) redirect('/login')
  if (!(await canEnterWorkspace(user, 'technical'))) redirect('/')

  return <WorkspaceShell workspace={WORKSPACES.technical}>{children}</WorkspaceShell>
}
