import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { resolveDefaultWorkspace } from '@/workspaces/resolveWorkspace'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { WORKSPACES } from '@/workspaces/workspaces.config'
import { Empty } from '@/components/kit'

/**
 * KHU LƯƠNG — trang DÙNG CHUNG giữa Nhân sự và Kế toán (B4, 18/10/2026). Kế toán không vào
 * được workspace Nhân sự, nên hồ sơ lương không nằm dưới `/hr`: mỗi người giữ sidebar phòng
 * mình (giống `(shared)`), mục menu chỉ hiện với năng lực `hr.payroll`.
 *
 * Gác quyền `hr.payroll.profile` NGAY ở layout: người không có quyền mở thẳng đường dẫn thì
 * thấy lý do + việc tiếp, không thấy một byte lương nào (service cũng gác lần nữa).
 */
export default async function LuongLayout({ children }: { children: React.ReactNode }) {
  const user = await authService.currentUser()
  if (!user) redirect('/login')
  const workspace = (await resolveDefaultWorkspace(user)) ?? WORKSPACES.hr
  const duoc = await canAction(user, 'hr.payroll.profile')
  return (
    <WorkspaceShell workspace={workspace} bare compactTop>
      <div className="kit kit-dense flex h-full flex-col">
        {duoc ? (
          children
        ) : (
          <Empty
            headline="Hồ sơ lương chỉ Kế toán, Trưởng phòng Nhân sự và Giám đốc xem được"
            reason="Lương và số tài khoản là thông tin riêng của từng người."
            next="Cần xem thì nhờ Kế toán, hoặc xin quyền ở màn Phân quyền."
          />
        )}
      </div>
    </WorkspaceShell>
  )
}
