import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { WORKSPACES } from '@/workspaces/workspaces.config'

/**
 * NHÓM CHẤM CÔNG — nhiều trang, mỗi trang một việc (chủ dự án 17/10/2026: "dồn hết
 * vào 1 trang không ổn"; menu 3 nhóm cha Nhân sự · Chấm công · Tính công): Tổng quan ·
 * Lấy dữ liệu · Lượt quẹt · Có mặt theo tổ · Một người. Nhóm Tính công (Bảng công,
 * Cần xử lý, Ca & cách tính, Chốt kỳ) ẩn tới khi chốt luật tính công.
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
