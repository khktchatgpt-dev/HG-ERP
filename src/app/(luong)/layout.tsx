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
          // Lương là quyền MẬT (0253): chỉ người có vai "Quản lý lương" — quản trị viên,
          // Kế toán, Nhân sự, Giám đốc đều không xem được; màn Phân quyền không cấp được.
          <Empty
            headline="Lương chỉ người quản lý lương xem được"
            reason="Lương và số tài khoản là thông tin mật: chỉ một người phụ trách lương ở Phòng Kế toán xem và tính, kể cả quản trị viên cũng không xem được."
            next="Có thắc mắc về lương của mình thì hỏi trực tiếp người quản lý lương."
          />
        )}
      </div>
    </WorkspaceShell>
  )
}
