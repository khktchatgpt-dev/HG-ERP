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
  // FR-ADM-02: admin/manager xem chéo read-only (GĐ theo dõi Kỹ thuật); ghi vẫn
  // bị service chặn theo phòng Kỹ thuật. Ngoài ra chỉ nhân sự phòng Kỹ thuật.
  const allowed =
    user.role === 'admin' || user.role === 'manager' || (await isTechnicalStaff(user))
  if (!allowed) redirect('/')

  return <WorkspaceShell workspace={WORKSPACES.technical}>{children}</WorkspaceShell>
}
