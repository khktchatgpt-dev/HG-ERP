import Link from 'next/link'
import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { tasksService } from '@/modules/workflow/tasks/tasks.service'
import { AppShell } from '@/components/AppShell'
import { DeadlinePill } from '@/components/DeadlinePill'
import { TASK_STATUSES } from '@/modules/workflow/tasks/tasks.schema'
import type { TaskStatus } from '@/modules/workflow/tasks/tasks.repo'

const SCOPES = [
  { id: 'mine', label: 'Của tôi' },
  { id: 'assigned_by_me', label: 'Tôi giao' },
  { id: 'department', label: 'Phòng ban' },
] as const

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'Chưa làm',
  in_progress: 'Đang làm',
  submitted: 'Chờ duyệt',
  done: 'Hoàn thành',
  rejected: 'Bị trả lại',
  cancelled: 'Đã huỷ',
  on_hold: 'Tạm hoãn',
}

const STATUS_COLOR: Record<TaskStatus, string> = {
  todo: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  submitted: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  done: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  cancelled: 'bg-zinc-100 text-zinc-500 line-through dark:bg-zinc-800',
  on_hold: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; status?: string; q?: string; page?: string }>
}) {
  const user = await authService.currentUser()
  if (!user) redirect('/login')

  const sp = await searchParams
  const scope = (SCOPES.find((s) => s.id === sp.scope)?.id ?? 'mine') as
    (typeof SCOPES)[number]['id']
  const status = TASK_STATUSES.includes(sp.status as TaskStatus)
    ? (sp.status as TaskStatus)
    : undefined
  const q = sp.q?.trim() || undefined
  const page = Math.max(1, Number(sp.page) || 1)

  const { rows, total } = await tasksService.list(user, {
    scope,
    status,
    q,
    page,
    page_size: 20,
  })

  const qs = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams()
    const cur = { scope, status, q, page: String(page), ...overrides }
    for (const [k, v] of Object.entries(cur)) if (v) params.set(k, v)
    return `?${params.toString()}`
  }

  const canCreate = user.role === 'manager' || user.role === 'admin'

  return (
    <AppShell
      title="Công việc"
      subtitle={`${SCOPES.find((s) => s.id === scope)?.label ?? ''} • ${total} công việc`}
      actions={
        canCreate && (
          <Link
            href="/tasks/new"
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
          >
            + Giao việc
          </Link>
        )
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex gap-2 border-b border-zinc-200 text-sm dark:border-zinc-800">
          {SCOPES.map((s) => (
            <Link
              key={s.id}
              href={qs({ scope: s.id, page: undefined })}
              className={`-mb-px border-b-2 px-3 py-2 ${
                scope === s.id
                  ? 'border-black dark:border-white'
                  : 'border-transparent text-zinc-500'
              }`}
            >
              {s.label}
            </Link>
          ))}
        </div>

        <form className="flex gap-2 text-sm">
          <input type="hidden" name="scope" value={scope} />
          <input
            name="q"
            defaultValue={q ?? ''}
            placeholder="Tìm theo tiêu đề hoặc mã CV…"
            className="flex-1 rounded border border-zinc-300 px-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <select
            name="status"
            defaultValue={status ?? ''}
            className="rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">Mọi trạng thái</option>
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <button className="rounded border border-zinc-300 px-3 dark:border-zinc-700">
            Lọc
          </button>
        </form>

        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-12 text-center text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950">
            Không có công việc nào.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
            {rows.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/tasks/${t.id}`}
                  className="block px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">
                        <span className="mr-2 font-mono text-xs text-zinc-400">
                          {t.task_code}
                        </span>
                        <span className="font-medium">{t.title}</span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
                        <span>
                          {t.assigner_name ?? t.assigner_email} →{' '}
                          {t.assignee_name ?? t.assignee_email}
                        </span>
                        {t.due_date && (
                          <span>
                            • Hạn: {new Date(t.due_date).toLocaleDateString('vi-VN')}
                          </span>
                        )}
                        {t.progress_percent > 0 && t.progress_percent < 100 && (
                          <span>• {t.progress_percent}%</span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <DeadlinePill
                        dueDate={t.due_date}
                        status={t.status}
                        completedAt={t.completed_at}
                      />
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLOR[t.status]}`}
                      >
                        {STATUS_LABEL[t.status]}
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between text-sm text-zinc-500">
          <span>Tổng: {total}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={qs({ page: String(page - 1) })} className="underline">
                ← Trước
              </Link>
            )}
            {page * 20 < total && (
              <Link href={qs({ page: String(page + 1) })} className="underline">
                Sau →
              </Link>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
