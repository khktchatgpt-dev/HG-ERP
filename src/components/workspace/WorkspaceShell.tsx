import { WorkspaceSidebar } from './WorkspaceSidebar'
import { WorkspaceTopbar } from './WorkspaceTopbar'
import { CommandPalette } from '@/components/erp/CommandPalette'
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
    <div className="flex min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <WorkspaceSidebar workspace={workspace} />
      <div className="flex min-w-0 flex-1 flex-col">
        <WorkspaceTopbar
          workspace={workspace}
          title={title}
          subtitle={subtitle}
          actions={actions}
        />
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6">
          {children}
        </main>
      </div>
      <CommandPalette />
    </div>
  )
}
