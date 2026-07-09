'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

type AuditEntry = {
  id: string
  target_user_id: string
  actor_id: string | null
  action: string
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  reason: string | null
  created_at: string
}

const ACTION_LABEL: Record<string, string> = {
  create: 'Tạo',
  update: 'Cập nhật',
  password_reset: 'Đặt lại mật khẩu',
  soft_delete: 'Xoá (soft)',
  restore: 'Khôi phục',
  bulk_import: 'Import',
}

export function AuditHistoryPanel({
  targetUserId,
  userLabel,
}: {
  targetUserId: string
  userLabel: string
}) {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // loading khởi tạo true; panel remount theo từng user (modal) nên không cần
  // set lại trong effect — tránh setState đồng bộ trong effect.
  useEffect(() => {
    let alive = true
    api<{ entries: AuditEntry[] }>(
      `/api/users/audit?target_user_id=${targetUserId}&limit=100`,
    )
      .then((res) => {
        if (alive) setEntries(res.entries)
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : 'Không tải được lịch sử')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [targetUserId])

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-zinc-500">
        Lịch sử thao tác trên <b>{userLabel}</b> — mới nhất trên cùng.
      </p>
      {loading && <p className="text-sm text-zinc-500">Đang tải…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && !error && entries.length === 0 && (
        <p className="text-sm text-zinc-500">Chưa có thao tác nào được ghi.</p>
      )}
      {entries.length > 0 && (
        <div className="max-h-96 overflow-auto rounded-md border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <th className="px-2 py-1.5">Thời gian</th>
                <th className="px-2 py-1.5">Hành động</th>
                <th className="px-2 py-1.5">Chi tiết</th>
                <th className="px-2 py-1.5">Ghi chú</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="px-2 py-1 whitespace-nowrap text-zinc-500">
                    {new Date(e.created_at).toLocaleString('vi-VN')}
                  </td>
                  <td className="px-2 py-1 font-medium">
                    {ACTION_LABEL[e.action] ?? e.action}
                  </td>
                  <td className="px-2 py-1">
                    {e.after
                      ? Object.entries(e.after)
                          .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
                          .join(', ')
                      : '—'}
                  </td>
                  <td className="px-2 py-1 text-zinc-500">{e.reason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
