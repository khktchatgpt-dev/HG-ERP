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
    <div className="flex min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar title={title} subtitle={subtitle} actions={actions} />
        {subnav && (
          <div className="border-b border-zinc-200 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-950 sm:px-6">
            {subnav}
          </div>
        )}
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
