'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import { PageHeader } from '@/components/erp/PageHeader'
import { Toolbar, ToolbarSelect } from '@/components/erp/Toolbar'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'
import { downloadCsv } from '@/lib/csv'
import { useToast } from '@/components/ui/Toast'

type Entry = {
  id: string
  target_user: string
  target_user_id: string
  actor: string
  actor_id: string | null
  action: string
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  reason: string | null
  created_at: string
}

type UserOpt = { id: string; label: string }

const ACTION_LABEL: Record<string, string> = {
  create: 'Tạo',
  update: 'Cập nhật',
  password_reset: 'Reset PW',
  soft_delete: 'Xoá',
  restore: 'Khôi phục',
  bulk_import: 'Import',
}

const ACTIONS = Object.keys(ACTION_LABEL)

export function AuditLogView({
  entries,
  users,
  currentFilter,
}: {
  entries: Entry[]
  users: UserOpt[]
  currentFilter: { action: string; actor: string; target: string; limit: number }
}) {
  const router = useRouter()
  const sp = useSearchParams()
  const toast = useToast()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function setParam(key: string, value: string) {
    const p = new URLSearchParams(sp.toString())
    if (value && value !== 'all') p.set(key, value)
    else p.delete(key)
    startTransition(() => router.push(`?${p.toString()}`))
  }

  function exportCsv() {
    downloadCsv(`audit-${new Date().toISOString().slice(0, 10)}.csv`, entries, [
      { key: 'created_at', header: 'Thời gian', get: (e) => new Date(e.created_at).toLocaleString('vi-VN') },
      { key: 'action', header: 'Hành động', get: (e) => ACTION_LABEL[e.action] ?? e.action },
      { key: 'target_user', header: 'Mục tiêu' },
      { key: 'actor', header: 'Bởi' },
      { key: 'reason', header: 'Ghi chú' },
      { key: 'before', header: 'Trước', get: (e) => (e.before ? JSON.stringify(e.before) : '') },
      { key: 'after', header: 'Sau', get: (e) => (e.after ? JSON.stringify(e.after) : '') },
    ])
    toast.success(`Đã xuất ${entries.length} dòng CSV`)
  }

  const actionOptions = [
    { value: 'all', label: 'Mọi hành động' },
    ...ACTIONS.map((a) => ({ value: a, label: ACTION_LABEL[a] })),
  ]
  const userOptions = [
    { value: 'all', label: 'Mọi người' },
    ...users.map((u) => ({ value: u.id, label: u.label })),
  ]
  const targetOptions = [
    { value: 'all', label: 'Mọi mục tiêu' },
    ...users.map((u) => ({ value: u.id, label: u.label })),
  ]
  const limitOptions = [50, 100, 200, 500].map((n) => ({
    value: String(n),
    label: `Lấy ${n} dòng`,
  }))

  const hasFilter =
    currentFilter.action !== 'all' ||
    currentFilter.actor !== 'all' ||
    currentFilter.target !== 'all'

  return (
    <div className="flex flex-col gap-4">
      <TopProgressBar active={pending} />
      <PageHeader
        breadcrumbs={[
          { label: 'Quản trị', href: '/admin' },
          { label: 'Nhật ký thao tác' },
        ]}
        title="Nhật ký thao tác"
        description={`${entries.length} dòng, mới nhất trên cùng.`}
        actions={
          <button
            onClick={exportCsv}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:bg-zinc-900"
          >
            Export CSV
          </button>
        }
      />

      <div>
        <Toolbar
          left={
            <>
              <ToolbarSelect
                value={currentFilter.action}
                onChange={(v) => setParam('action', v)}
                options={actionOptions}
              />
              <ToolbarSelect
                value={currentFilter.actor}
                onChange={(v) => setParam('actor', v)}
                options={userOptions}
              />
              <ToolbarSelect
                value={currentFilter.target}
                onChange={(v) => setParam('target', v)}
                options={targetOptions}
              />
              <ToolbarSelect
                value={String(currentFilter.limit)}
                onChange={(v) => setParam('limit', v)}
                options={limitOptions}
              />
              {hasFilter && (
                <button
                  onClick={() => router.push('?')}
                  className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                >
                  Xoá lọc
                </button>
              )}
            </>
          }
        />

        <div className="overflow-x-auto rounded-b-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900/50">
            <tr>
              <th className="px-3 py-2">Thời gian</th>
              <th className="px-3 py-2">Hành động</th>
              <th className="px-3 py-2">Mục tiêu</th>
              <th className="px-3 py-2">Bởi</th>
              <th className="px-3 py-2">Ghi chú</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {entries.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-12 text-center text-sm text-zinc-500">
                  Không có thao tác nào khớp bộ lọc.
                </td>
              </tr>
            )}
            {entries.map((e) => {
              const hasDetail = !!(e.before || e.after)
              const isExpanded = expanded === e.id
              return (
                <>
                  <tr key={e.id}>
                    <td className="px-3 py-2 text-xs text-zinc-500">
                      {new Date(e.created_at).toLocaleString('vi-VN')}
                    </td>
                    <td className="px-3 py-2 font-medium">
                      {ACTION_LABEL[e.action] ?? e.action}
                    </td>
                    <td className="px-3 py-2">{e.target_user}</td>
                    <td className="px-3 py-2 text-zinc-500">{e.actor}</td>
                    <td className="px-3 py-2 text-xs text-zinc-500">{e.reason ?? '—'}</td>
                    <td className="px-3 py-2 text-right">
                      {hasDetail && (
                        <button
                          onClick={() => setExpanded(isExpanded ? null : e.id)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          {isExpanded ? 'Ẩn' : 'Chi tiết'}
                        </button>
                      )}
                    </td>
                  </tr>
                  {isExpanded && hasDetail && (
                    <tr key={`${e.id}-detail`} className="bg-zinc-50 dark:bg-zinc-900/40">
                      <td colSpan={6} className="px-3 py-2 text-xs">
                        {e.before && (
                          <div>
                            <span className="font-medium text-zinc-500">Trước:</span>{' '}
                            <code className="text-red-600">{JSON.stringify(e.before)}</code>
                          </div>
                        )}
                        {e.after && (
                          <div>
                            <span className="font-medium text-zinc-500">Sau:</span>{' '}
                            <code className="text-green-600">{JSON.stringify(e.after)}</code>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}
