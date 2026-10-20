import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canEnterWorkspace } from '@/workspaces/access'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { WORKSPACES } from '@/workspaces/workspaces.config'
import { KitFrame } from './_shell/KitFrame'

/**
 * KHU SẢN XUẤT — các màn dựng theo sổ thiết kế `/design-lab`
 * (docs/san-xuat-thiet-ke-giao-dien.md).
 *
 * VÌ SAO LÀ MỘT NHÓM ROUTE RIÊNG, không nằm chung `(workspace)`:
 * `bare` là điều kiện SỐNG CÒN của màn kit, không phải tuỳ chọn thẩm mỹ. Vùng
 * nội dung mặc định của vỏ có đệm 24px, chặn bề ngang, và TỰ CUỘN — ba thứ đó
 * làm `ScreenFrame` không chốt được chiều cao, và khi đó `flex-1` của bảng
 * sập về 0 còn thanh chốt đáy bị đẩy xuống DƯỚI mép màn hình. Đo 18/09/2026
 * trên chính màn Ghi sản lượng: thanh chốt nằm ở 709px trong khung nhìn 694px
 * — không bấm nổi nút Ghi sổ.
 *
 * Nhóm route KHÔNG đổi URL: `/thongke/ghi` vẫn là `/thongke/ghi`. Các trang
 * `/thongke/*` còn lại vẫn ở `(workspace)` với vỏ có đệm cho tới khi chúng
 * được chuyển sang kit — mỗi màn dọn xong thì dời sang đây.
 *
 * Quyền vào: dùng lại `canEnterWorkspace(user, 'production')` — CÙNG một luật
 * với các trang còn lại của khu (ba khu đã gộp 18/09/2026).
 */
export default async function SanXuatLayout({ children }: { children: React.ReactNode }) {
  const user = await authService.currentUser()
  if (!user) redirect('/login')
  if (!(await canEnterWorkspace(user, 'production'))) redirect('/')

  return (
    <WorkspaceShell workspace={WORKSPACES.production} bare>
      <KitFrame>{children}</KitFrame>
    </WorkspaceShell>
  )
}
