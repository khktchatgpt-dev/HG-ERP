import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { WORKSPACES } from '@/workspaces/workspaces.config'

/**
 * HỒ SƠ NHÂN VIÊN — nhóm Nhân sự trên menu (tách trang 17/10/2026; trước là bước ②
 * của trang Kỳ công). Cùng quyền xem với nhóm Chấm công vì cùng dữ liệu (mã máy,
 * ca, cờ Không chấm công). Gắn vỏ app `bare` + lớp token `.kit` như nhóm Chấm công.
 */
export default async function NhanVienLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await authService.requirePageUser()
  if (!(await canAction(user, 'hr.attendance.view'))) redirect('/hr')
  return (
    <WorkspaceShell workspace={WORKSPACES.hr} bare compactTop>
      <div className="kit kit-dense flex h-full flex-col">{children}</div>
    </WorkspaceShell>
  )
}
