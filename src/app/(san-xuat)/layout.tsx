import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canEnterWorkspace } from '@/workspaces/access'
import { khuChoTrangChung } from '@/workspaces/resolveWorkspace'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { WORKSPACES, type WorkspaceConfig } from '@/workspaces/workspaces.config'
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
 * Nhóm route KHÔNG đổi URL: `/thongke/ghi` vẫn là `/thongke/ghi`.
 *
 * HAI KHU DÙNG CHUNG CÁC TRANG NÀY (10/11/2026, tách khu Thống kê khỏi Sản
 * xuất): Ghi sản lượng / Giao nhận là của khu `thongke`, còn Lệnh, Hồ sơ lệnh,
 * Lộ trình, Báo cáo thì cả hai khu đều mở. Sidebar đi theo khu người xem đang
 * đứng (`khuChoTrangChung`, cookie proxy ghi), không theo URL — thống kê mở
 * Hồ sơ lệnh vẫn giữ menu Thống kê, quản đốc mở vẫn giữ menu Sản xuất.
 *
 * Quyền vào: `canEnterWorkspace(user, 'production')` — cả gia đình SX dùng
 * chung một quyền xem chéo (access.ts).
 */
const GIA_DINH = (ws: WorkspaceConfig) => ws.id === 'production' || ws.id === 'thongke'

export default async function SanXuatLayout({ children }: { children: React.ReactNode }) {
  const user = await authService.currentUser()
  if (!user) redirect('/login')
  if (!(await canEnterWorkspace(user, 'production'))) redirect('/')
  const dang = await khuChoTrangChung(user, GIA_DINH)
  const ws = dang && GIA_DINH(dang) ? dang : WORKSPACES.production

  return (
    <WorkspaceShell workspace={ws} bare>
      <KitFrame>{children}</KitFrame>
    </WorkspaceShell>
  )
}
