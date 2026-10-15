import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { WORKSPACES } from '@/workspaces/workspaces.config'

/**
 * KHU CHẤM CÔNG — nhiều trang, mỗi trang một câu hỏi (chủ dự án 12/10/2026: "nên
 * làm nhiều trang thay vì tập trung một trang"). Bản vẽ vòng 2: Tổng quan · Lấy
 * dữ liệu · Nhân viên & ca · Cần xử lý · Bảng công · Ca & cách tính · Máy chấm công.
 *
 * Layout gác quyền xem một lần cho cả khu, gắn vỏ app (bare: màn kit tự lo mép +
 * chiều cao bằng `ScreenFrame`) và lớp token `.kit`.
 */
export default async function ChamCongLayout({
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
