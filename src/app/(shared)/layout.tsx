import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { khuChoTrangChung } from '@/workspaces/resolveWorkspace'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { WORKSPACES } from '@/workspaces/workspaces.config'

/**
 * Khu DÙNG CHUNG — trang không thuộc phòng nào, mọi người đã đăng nhập đều xem
 * được (hiện có: thư viện + hồ sơ sản phẩm ở `/products`).
 *
 * Khác các layout `(workspace)/<ws>`: KHÔNG gác `canEnterWorkspace`, chỉ gác
 * đăng nhập — quyền SỬA vẫn do service quyết theo `technical.edit` /
 * `technical.bom.edit`, và mỗi tab đã nhận cờ `canEdit` để ẩn nút.
 *
 * Shell lấy theo workspace người xem VỪA ĐỨNG (cookie `ws_dang` do proxy ghi), không có
 * thì workspace NHÀ, nên NV Kho mở hồ sơ SP vẫn ở
 * trong sidebar Kho chứ không bị quăng sang shell Kỹ thuật. User không có phòng
 * (chưa gán dept) thì mượn shell Kỹ thuật — chủ quản của thư viện SP.
 */
export default async function SharedLayout({ children }: { children: React.ReactNode }) {
  const user = await authService.currentUser()
  if (!user) redirect('/login')

  // Giữ khu người dùng vừa đứng (21/10/2026); không vào được khu đó thì về khu nhà.
  const workspace = (await khuChoTrangChung(user)) ?? WORKSPACES.technical
  return <WorkspaceShell workspace={workspace}>{children}</WorkspaceShell>
}
