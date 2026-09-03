import { WorkspaceSidebar } from './WorkspaceSidebar'
import { WorkspaceTopbar } from './WorkspaceTopbar'
import { CommandPalette } from '@/components/erp/CommandPalette'
import { NumberWheelGuard } from './NumberWheelGuard'
import type { WorkspaceConfig } from '@/workspaces/workspaces.config'

/**
 * Khung workspace: sidebar + topbar + vùng nội dung.
 *
 * Đặt trong LAYOUT (không phải từng page) để sidebar/topbar giữ nguyên khi
 * điều hướng — chỉ vùng `children` được thay bằng loading.tsx skeleton.
 * Sidebar tự highlight theo pathname (NavLink), nên không cần prop `current`.
 */
export async function WorkspaceShell({
  workspace,
  title,
  subtitle,
  actions,
  children,
}: {
  workspace: WorkspaceConfig
  title?: string
  subtitle?: string
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    // `theme-v3` "HG Ledger" đặt ở GỐC shell (duyệt 15/08/2026, thay theme-v2
    // stone/emerald): token xám-xanh + royal cobalt phủ cả sidebar + topbar +
    // nội dung. Kit dùng chung đã ăn token nên mọi màn tự khớp; trang cũ còn
    // gọi zinc trực tiếp vẫn đọc được (zinc ~ xám-xanh v3).
    <div className="theme-v3 bg-background text-foreground flex min-h-screen">
      <WorkspaceSidebar workspace={workspace} />
      <div className="flex min-w-0 flex-1 flex-col">
        <WorkspaceTopbar
          workspace={workspace}
          title={title}
          subtitle={subtitle}
          actions={actions}
        />
        <main className="mx-auto w-full max-w-[1600px] flex-1 p-4 sm:px-6 sm:py-6">
          {children}
        </main>
      </div>
      <CommandPalette />
      <NumberWheelGuard />
    </div>
  )
}
