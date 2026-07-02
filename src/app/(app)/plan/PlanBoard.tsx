'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/Badge'
import { DeadlinePill } from '@/components/DeadlinePill'

type TaskRow = {
  id: string
  task_code: string
  title: string
  status: string
  kind: string
  priority: string
  planned_date: string | null
  due_date: string | null
  completed_at: string | null
  category: string | null
  tags: string[]
  estimate_hours: number | null
  actual_hours: number | null
  progress_percent: number
}

type Initial = {
  today: TaskRow[]
  week: TaskRow[]
  overdue: TaskRow[]
  upcoming: TaskRow[]
}

const STATUS_LABEL: Record<string, string> = {
  todo: 'Chưa làm',
  in_progress: 'Đang làm',
  submitted: 'Chờ duyệt',
  done: 'Hoàn thành',
  rejected: 'Trả lại',
  cancelled: 'Đã huỷ',
  on_hold: 'Tạm hoãn',
}

const STATUS_TONE: Record<string, Parameters<typeof Badge>[0]['tone']> = {
  todo: 'gray',
  in_progress: 'blue',
  submitted: 'amber',
  done: 'green',
  rejected: 'red',
  cancelled: 'gray',
  on_hold: 'purple',
}

const PRIORITY_TONE: Record<string, Parameters<typeof Badge>[0]['tone']> = {
  low: 'gray',
  normal: 'gray',
  high: 'amber',
  urgent: 'red',
}

const TABS: Array<{ id: keyof Initial; label: string }> = [
  { id: 'overdue', label: 'Quá hạn' },
  { id: 'today', label: 'Hôm nay' },
  { id: 'week', label: 'Tuần này' },
  { id: 'upcoming', label: 'Sắp tới' },
]

function todayYMD() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function PlanBoard({
  initial,
  currentUserId,
}: {
  initial: Initial
  currentUserId: string
}) {
  const router = useRouter()
  const [tab, setTab] = useState<keyof Initial>('today')
  const [busy, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [quickTitle, setQuickTitle] = useState('')
  const [quickDate, setQuickDate] = useState(todayYMD())

  const tasks = initial[tab]

  async function quickAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!quickTitle.trim()) return
    setError(null)
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: quickTitle.trim(),
        assignee_id: currentUserId,
        planned_date: quickDate,
        priority: 'normal',
      }),
    })
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: 'Tạo thất bại' }))
      setError(error)
      return
    }
    setQuickTitle('')
    startTransition(() => router.refresh())
  }

  async function setStatus(id: string, status: string) {
    const res = await fetch(`/api/tasks/${id}/status`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: 'Lỗi' }))
      setError(error)
      return
    }
    startTransition(() => router.refresh())
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Quick add */}
      <form
        onSubmit={quickAdd}
        className="flex flex-wrap gap-2 rounded-lg border border-zinc-200 p-2 dark:border-zinc-800"
      >
        <input
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          placeholder="+ Thêm việc nhanh… (Enter để tạo)"
          className="min-w-48 flex-1 rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
        />
        <input
          type="date"
          value={quickDate}
          onChange={(e) => setQuickDate(e.target.value)}
          className="rounded-md border border-zinc-200 px-2 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
        />
        <button
          disabled={busy || !quickTitle.trim()}
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          Thêm
        </button>
      </form>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-200 text-sm dark:border-zinc-800">
        {TABS.map((t) => {
          const count = initial[t.id].length
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`-mb-px border-b-2 px-3 py-2 ${
                tab === t.id
                  ? 'border-black dark:border-white'
                  : 'border-transparent text-zinc-500'
              }`}
            >
              {t.label}{' '}
              <span
                className={`ml-1 rounded-full px-1.5 py-0.5 text-xs ${
                  t.id === 'overdue' && count > 0
                    ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                    : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                }`}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {error && (
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      )}

      {tasks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-12 text-center text-sm text-zinc-500 dark:border-zinc-700">
          {tab === 'overdue'
            ? 'Tuyệt vời — không có việc nào quá hạn.'
            : tab === 'today'
              ? 'Chưa có việc cho hôm nay. Dùng ô bên trên để thêm nhanh.'
              : 'Trống.'}
        </div>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {tasks.map((t) => (
            <li
              key={t.id}
              className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900"
            >
              <input
                type="checkbox"
                checked={t.status === 'done'}
                disabled={busy}
                onChange={(e) =>
                  setStatus(t.id, e.target.checked ? 'done' : 'todo')
                }
                className="h-4 w-4 shrink-0 rounded border-zinc-300"
              />
              <div className="min-w-0 flex-1">
                <Link
                  href={`/tasks/${t.id}`}
                  className={`block truncate text-sm ${
                    t.status === 'done'
                      ? 'text-zinc-400 line-through'
                      : 'font-medium'
                  }`}
                >
                  <span className="mr-2 font-mono text-xs text-zinc-400">
                    {t.task_code}
                  </span>
                  {t.title}
                </Link>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
                  {t.kind === 'self' ? (
                    <Badge tone="purple">Cá nhân</Badge>
                  ) : (
                    <Badge tone="blue">Được giao</Badge>
                  )}
                  {t.priority !== 'normal' && (
                    <Badge tone={PRIORITY_TONE[t.priority]}>{t.priority}</Badge>
                  )}
                  {t.planned_date && (
                    <span>
                      Plan: {new Date(t.planned_date).toLocaleDateString('vi-VN')}
                    </span>
                  )}
                  {t.progress_percent > 0 && t.progress_percent < 100 && (
                    <span>{t.progress_percent}%</span>
                  )}
                  {t.category && <Badge>{t.category}</Badge>}
                  {t.tags.map((tag) => (
                    <Badge key={tag}>#{tag}</Badge>
                  ))}
                </div>
              </div>
              <DeadlinePill
                dueDate={t.due_date}
                status={t.status}
                completedAt={t.completed_at}
              />
              <Badge tone={STATUS_TONE[t.status] ?? 'gray'}>
                {STATUS_LABEL[t.status] ?? t.status}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
