import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { isTechnicalStaff } from '@/modules/dept/technical/technical.service'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { WORKSPACES } from '@/workspaces/workspaces.config'

/**
 * Layout workspace Kỹ thuật. Shell (sidebar + topbar sky) đặt ở đây nên
 * giữ nguyên khi điều hướng — chỉ nội dung thay bằng loading.tsx.
 *
 * Quyền: admin xem mọi workspace; ngoài ra chỉ nhân sự phòng Kỹ thuật.
 */
export default async function TechnicalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await authService.currentUser()
  if (!user) redirect('/login')
  if (!(await isTechnicalStaff(user))) redirect('/')

  return <WorkspaceShell workspace={WORKSPACES.technical}>{children}</WorkspaceShell>
}
