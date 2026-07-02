import Link from 'next/link'
import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { tasksService } from '@/modules/workflow/tasks/tasks.service'
import { AppShell } from '@/components/AppShell'
import { resolveDefaultWorkspace } from '@/workspaces/resolveWorkspace'

export default async function Home() {
  const user = await authService.currentUser()
  if (!user) redirect('/login')

  // Nếu user thuộc workspace đã ready → chuyển vào workspace của họ.
  // Bao gồm admin (System workspace) — vào thẳng /admin/ không xem home cũ.
  // Workspace chưa build (ready=false) → fallback ở lại đây.
  const ws = await resolveDefaultWorkspace(user)
  if (ws && ws.ready) {
    redirect(`${ws.route}/`)
  }

  const stats = await tasksService.dashboard(user)

  type Card = { label: string; value: number; tone?: 'red' | 'amber' }
  const cards: Card[] = [
    { label: 'Cần làm', value: stats.mine.todo + stats.mine.in_progress + stats.mine.rejected },
    { label: 'Đang chờ duyệt', value: stats.mine.submitted },
    { label: 'Hoàn thành', value: stats.mine.done },
    { label: 'Quá hạn', value: stats.overdue, tone: 'red' },
  ]
  if (user.role === 'manager' || user.role === 'admin') {
    cards.push({
      label: 'Tôi giao chờ duyệt',
      value: stats.assigned_by_me.submitted,
      tone: 'amber',
    })
  }

  // Admin: organization-wide overview + pending approvals.
  const isAdmin = user.role === 'admin'
  const org = isAdmin ? await tasksService.orgStats(user) : null
  const pending = isAdmin
    ? await tasksService.list(user, {
        scope: 'all',
        status: 'submitted',
        page: 1,
        page_size: 5,
      })
    : null

  return (
    <AppShell
      title={`Xin chào, ${user.name ?? user.email}`}
      subtitle="Tổng quan công việc cá nhân"
    >
      <div className="flex flex-col gap-8">
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase text-zinc-500">
            Công việc của tôi
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {cards.map((c) => (
              <div
                key={c.label}
                className={`rounded-lg border p-4 ${
                  c.tone === 'red'
                    ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30'
                    : c.tone === 'amber'
                      ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30'
                      : 'border-zinc-200 dark:border-zinc-800'
                }`}
              >
                <div className="text-xs uppercase text-zinc-500">{c.label}</div>
                <div className="mt-1 text-3xl font-semibold">{c.value}</div>
              </div>
            ))}
          </div>
        </section>

        {isAdmin && org && (
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase text-zinc-500">
              Toàn hệ thống
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                <div className="text-xs uppercase text-zinc-500">Tổng công việc</div>
                <div className="mt-1 text-3xl font-semibold">{org.total}</div>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
                <div className="text-xs uppercase text-zinc-500">Chờ duyệt</div>
                <div className="mt-1 text-3xl font-semibold">{org.pending_approvals}</div>
              </div>
              <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
                <div className="text-xs uppercase text-zinc-500">Hoàn thành</div>
                <div className="mt-1 text-3xl font-semibold">{org.by_status.done}</div>
              </div>
              <Link
                href="/admin/users"
                className="rounded-lg border border-zinc-200 p-4 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
              >
                <div className="text-xs uppercase text-zinc-500">Nhân viên</div>
                <div className="mt-1 text-3xl font-semibold">{org.users}</div>
              </Link>
              <Link
                href="/admin/departments"
                className="rounded-lg border border-zinc-200 p-4 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
              >
                <div className="text-xs uppercase text-zinc-500">Phòng ban</div>
                <div className="mt-1 text-3xl font-semibold">{org.departments}</div>
              </Link>
            </div>
          </section>
        )}

        {isAdmin && pending && pending.rows.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase text-zinc-500">
              Việc chờ duyệt gần đây
            </h2>
            <ul className="divide-y divide-zinc-200 rounded border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {pending.rows.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/tasks/${t.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  >
                    <span className="truncate font-medium">{t.title}</span>
                    <span className="shrink-0 text-xs text-zinc-500">
                      {t.assignee_name ?? t.assignee_email}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </AppShell>
  )
}
