import Link from 'next/link'
import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { teamService } from '@/modules/workflow/team/team.service'
import { AppShell } from '@/components/AppShell'
import { Avatar } from '@/components/Avatar'
import { Badge } from '@/components/Badge'
import { Forbidden } from '@/server/http'

const STATUS_TONE: Record<string, Parameters<typeof Badge>[0]['tone']> = {
  todo: 'gray',
  in_progress: 'blue',
  submitted: 'amber',
  done: 'green',
  rejected: 'red',
  cancelled: 'gray',
  on_hold: 'purple',
}

const STATUS_LABEL: Record<string, string> = {
  todo: 'Chưa làm',
  in_progress: 'Đang làm',
  submitted: 'Chờ duyệt',
  done: 'Hoàn thành',
  rejected: 'Bị trả lại',
  cancelled: 'Đã huỷ',
  on_hold: 'Tạm hoãn',
}

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ dept?: string }>
}) {
  const user = await authService.currentUser()
  if (!user) redirect('/login')

  const sp = await searchParams
  let data
  try {
    data = await teamService.dashboard(user, sp.dept)
  } catch (e) {
    if (e instanceof Error && e.message.includes('Trưởng phòng ban')) {
      return (
        <AppShell title="Đội nhóm">
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
            Trang này chỉ dành cho <strong>Trưởng phòng ban</strong> và quản trị
            viên. Admin có thể gán bạn làm trưởng BP từ{' '}
            <Link href="/admin/departments" className="underline">
              Quản trị → Phòng ban
            </Link>
            .
          </p>
        </AppShell>
      )
    }
    throw e
  }

  const { department, members, totals, recent } = data

  return (
    <AppShell
      title={`Đội nhóm — ${department.name}`}
      subtitle={`${members.length} thành viên đang hoạt động`}
      actions={
        <Link
          href="/tasks/new"
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
        >
          + Giao việc
        </Link>
      }
    >
      <div>

        {/* Totals */}
        <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Chưa làm', value: totals.todo, tone: 'gray' as const },
            { label: 'Đang làm', value: totals.in_progress, tone: 'blue' as const },
            { label: 'Chờ duyệt', value: totals.submitted, tone: 'amber' as const },
            { label: 'Quá hạn', value: totals.overdue, tone: 'red' as const },
          ].map((c) => (
            <div
              key={c.label}
              className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div className="text-3xl font-semibold tabular-nums">{c.value}</div>
              <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                <Badge tone={c.tone}>•</Badge>
                {c.label}
              </div>
            </div>
          ))}
        </section>

        {/* Members WIP */}
        <section className="mb-8">
          <h2 className="mb-2 text-sm font-semibold uppercase text-zinc-500">
            Khối lượng công việc theo thành viên
          </h2>
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
                <tr>
                  <th className="px-4 py-2.5">Thành viên</th>
                  <th className="px-4 py-2.5 text-right">Chưa làm</th>
                  <th className="px-4 py-2.5 text-right">Đang làm</th>
                  <th className="px-4 py-2.5 text-right">Chờ duyệt</th>
                  <th className="px-4 py-2.5 text-right">Quá hạn</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {members.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                      Chưa có thành viên nào trong phòng ban.
                    </td>
                  </tr>
                )}
                {members.map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={m.name} email={m.email} size="sm" />
                        <div>
                          <div className="font-medium">{m.name ?? '—'}</div>
                          <div className="text-xs text-zinc-500">
                            {m.title ?? m.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {m.counts.todo}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {m.counts.in_progress}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {m.counts.submitted}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {m.counts.overdue > 0 ? (
                        <span className="font-medium text-red-600">
                          {m.counts.overdue}
                        </span>
                      ) : (
                        '0'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Recent dept tasks */}
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase text-zinc-500">
            10 công việc gần nhất của phòng ban
          </h2>
          {recent.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
              Chưa có công việc nào.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {recent.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/tasks/${t.id}`}
                    className="block px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm">
                          <span className="mr-2 font-mono text-xs text-zinc-400">
                            {t.task_code}
                          </span>
                          <span className="font-medium">{t.title}</span>
                        </div>
                        <div className="mt-0.5 text-xs text-zinc-500">
                          {t.assigner_name ?? t.assigner_email} →{' '}
                          {t.assignee_name ?? t.assignee_email}
                        </div>
                      </div>
                      <Badge tone={STATUS_TONE[t.status] ?? 'gray'}>
                        {STATUS_LABEL[t.status] ?? t.status}
                      </Badge>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  )
}
