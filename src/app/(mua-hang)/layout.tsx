import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canEnterWorkspace } from '@/workspaces/access'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { WORKSPACES } from '@/workspaces/workspaces.config'
import { KitFrame } from './_shell/KitFrame'

/**
 * MODULE MUA HÀNG — các màn dựng theo sổ thiết kế `/design-lab`.
 *
 * VỎ DÙNG CHUNG VỚI CẢ APP (16/09/2026). Khu này từng có vỏ riêng: rail 52px
 * thu gọn được, cây menu riêng, thanh trên riêng. Nó giải đúng một vấn đề thật
 * (sidebar 240px ăn 15% bề ngang của bảng), nhưng đổi lại phòng Cung ứng phải
 * sống với HAI thanh điều hướng cùng lúc — sidebar cũ ở `/planning/*`, rail
 * mới ở `/mua-hang/*` — với hai cây menu khác nhau. Chủ dự án gọi đúng tên:
 * "lẫn lộn", và chốt giữ sidebar cũ.
 *
 * Nên giờ chỉ còn MỘT cây menu, khai ở `workspaces.config.ts` (phòng
 * `planning`), và khu này chỉ đóng góp tầng nội dung. Đường lùi là `git
 * revert`, không phải một lớp CSS.
 *
 * `bare`: vùng nội dung không đệm, không chặn bề ngang, có `min-h-0` — màn kit
 * tự lo mép và tự chốt chiều cao bằng `ScreenFrame`.
 *
 * Quyền vào: dùng lại `canEnterWorkspace(user, 'planning')` — CÙNG một luật
 * với khu cũ. Khai một tập quyền thứ hai cho cùng một phòng là cách chắc chắn
 * để hai bên lệch nhau về ai được vào.
 *
 * KHÔNG viết service mới trong khu này. Cần gì thì gọi đúng route
 * `/api/dept/supply/*`; thiếu API thì bổ sung vào `src/modules/dept/supply/`.
 */
export default async function MuaHangLayout({ children }: { children: React.ReactNode }) {
  const user = await authService.currentUser()
  if (!user) redirect('/login')
  if (!(await canEnterWorkspace(user, 'planning'))) redirect('/')

  return (
    <WorkspaceShell workspace={WORKSPACES.planning} bare>
      <KitFrame>{children}</KitFrame>
    </WorkspaceShell>
  )
}
