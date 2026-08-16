import { Sidebar } from '@/components/Sidebar'
import { Topbar } from '@/components/Topbar'

export async function AppShell({
  title,
  subtitle,
  actions,
  children,
  /** Inline secondary nav (e.g. admin sub-tabs) rendered under topbar */
  subnav,
}: {
  title?: string
  subtitle?: string
  actions?: React.ReactNode
  subnav?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    // Shell cổ (trang cá nhân /tasks, /team, /reports) — phủ theme-v3 để cùng
    // bộ mặt với WorkspaceShell (15/08/2026).
    <div className="theme-v3 bg-background text-foreground flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar title={title} subtitle={subtitle} actions={actions} />
        {subnav && <div className="bg-card border-b px-4 sm:px-6">{subnav}</div>}
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  )
}
