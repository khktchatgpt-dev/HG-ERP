'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Avatar } from '@/components/Avatar'

type Row = {
  user: { id: string; name: string | null; email: string; title: string | null }
  assigned_in_week: number
  completed_in_week: number
  in_progress: number
  overdue: number
  due_next_week: number
}

export function WeeklyReportView({
  report,
  departments,
  canPickDept,
}: {
  report: { week: { start: string; end: string }; department_id: string | null; rows: Row[] }
  departments: { id: string; name: string }[]
  canPickDept: boolean
}) {
  const router = useRouter()
  const sp = useSearchParams()

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(sp.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    router.push(`/reports/weekly?${params.toString()}`)
  }

  const totals = report.rows.reduce(
    (a, r) => ({
      assigned_in_week: a.assigned_in_week + r.assigned_in_week,
      completed_in_week: a.completed_in_week + r.completed_in_week,
      in_progress: a.in_progress + r.in_progress,
      overdue: a.overdue + r.overdue,
      due_next_week: a.due_next_week + r.due_next_week,
    }),
    { assigned_in_week: 0, completed_in_week: 0, in_progress: 0, overdue: 0, due_next_week: 0 },
  )
  const completionRate =
    totals.assigned_in_week > 0
      ? Math.round((totals.completed_in_week / totals.assigned_in_week) * 100)
      : 0

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Báo cáo tuần</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {new Date(report.week.start).toLocaleDateString('vi-VN')} —{' '}
            {new Date(report.week.end).toLocaleDateString('vi-VN')}
          </p>
        </div>
        <div className="flex gap-2">
          <input
            type="date"
            defaultValue={report.week.start}
            onChange={(e) => setParam('week_start', e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          {canPickDept && (
            <select
              defaultValue={report.department_id ?? ''}
              onChange={(e) => setParam('dept', e.target.value)}
              className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">Tất cả phòng ban</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </header>

      {/* Aggregate cards */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: 'Giao trong tuần', value: totals.assigned_in_week },
          { label: 'HT trong tuần', value: totals.completed_in_week },
          { label: 'Đang xử lý', value: totals.in_progress },
          { label: 'Quá hạn', value: totals.overdue },
          { label: 'Tỷ lệ HT', value: `${completionRate}%` },
        ].map((c) => (
          <div key={c.label} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="text-2xl font-semibold tabular-nums">{c.value}</div>
            <div className="mt-1 text-xs text-zinc-500">{c.label}</div>
          </div>
        ))}
      </section>

      {/* Per-member table */}
      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
            <tr>
              <th className="px-4 py-2.5">Nhân viên</th>
              <th className="px-4 py-2.5 text-right">Giao trong tuần</th>
              <th className="px-4 py-2.5 text-right">HT trong tuần</th>
              <th className="px-4 py-2.5 text-right">Đang xử lý</th>
              <th className="px-4 py-2.5 text-right">Quá hạn</th>
              <th className="px-4 py-2.5 text-right">Đến hạn tuần tới</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {report.rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-zinc-500">
                  Chưa có dữ liệu cho tuần này.
                </td>
              </tr>
            )}
            {report.rows.map((r) => (
              <tr key={r.user.id}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={r.user.name} email={r.user.email} size="sm" />
                    <div>
                      <div className="font-medium">{r.user.name ?? '—'}</div>
                      <div className="text-xs text-zinc-500">{r.user.title ?? r.user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{r.assigned_in_week}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.completed_in_week}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.in_progress}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {r.overdue > 0 ? (
                    <span className="font-medium text-red-600">{r.overdue}</span>
                  ) : (
                    '0'
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{r.due_next_week}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
