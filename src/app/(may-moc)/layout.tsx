import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { assetsMeta } from '@/modules/core/assets/assets.service'
import { resolveDefaultWorkspace } from '@/workspaces/resolveWorkspace'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { WORKSPACES } from '@/workspaces/workspaces.config'
import { AreaNav } from './may-moc/_ui/area-nav'

/**
 * KHU MÁY MÓC & BẢO TRÌ (0270) — trang DÙNG CHUNG như /products, /cat-phoi:
 * chỉ gác đăng nhập. Tem QR dán trên máy dẫn thẳng tới hồ sơ máy, ai quét cũng
 * phải mở được và báo hỏng được; quyền LÀM (nhận việc, duyệt, giao dụng cụ)
 * do service gác theo `assets.*`, màn chỉ ẩn nút theo cờ `meta`.
 *
 * Nhóm route riêng thay vì nằm trong `(shared)`: màn kit cần vỏ `bare` (không
 * đệm, `min-h-0`) để `ScreenFrame` tự cuộn bảng — layout `(shared)` bọc vỏ có
 * đệm. Sidebar vẫn theo phòng NHÀ của người xem (cùng cách `(shared)`).
 */
export default async function MayMocLayout({ children }: { children: React.ReactNode }) {
  const user = await authService.currentUser()
  if (!user) redirect('/login')
  const [workspace, meta] = await Promise.all([
    resolveDefaultWorkspace(user),
    assetsMeta(user),
  ])
  return (
    <WorkspaceShell workspace={workspace ?? WORKSPACES.production} bare compactTop>
      <div className="kit kit-dense flex h-full min-h-0 flex-col">
        <AreaNav showCost={meta.can_cost} />
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </WorkspaceShell>
  )
}
