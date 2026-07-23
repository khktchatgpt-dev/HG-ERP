import { EmptyState } from '@/components/erp/EmptyState'
import type { RbacAuditEntry } from '@/modules/core/rbac/rbac.repo'
import { AUDIT_ACTION_LABEL, auditDetail } from './shared'

/** Nhật ký audit phân quyền — SERVER component (đọc). */
export function AuditTable({ entries }: { entries: RbacAuditEntry[] }) {
  if (entries.length === 0)
    return (
      <EmptyState
        icon="🗒"
        title="Chưa có thao tác nào"
        description="Nhật ký sẽ hiện ở đây."
      />
    )

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:border-zinc-800 dark:bg-zinc-900/50">
            <th className="px-3 py-2">Thời gian</th>
            <th className="px-3 py-2">Thao tác</th>
            <th className="px-3 py-2">Đối tượng</th>
            <th className="px-3 py-2">Chi tiết</th>
            <th className="px-3 py-2">Người làm</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr
              key={e.id}
              className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
            >
              <td className="px-3 py-2 whitespace-nowrap text-zinc-500">
                {new Date(e.created_at).toLocaleString('vi-VN')}
              </td>
              <td className="px-3 py-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    e.action === 'role.revoked'
                      ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                  }`}
                >
                  {AUDIT_ACTION_LABEL[e.action] ?? e.action}
                </span>
              </td>
              <td className="px-3 py-2 font-medium">{e.target_label ?? '—'}</td>
              <td className="px-3 py-2 text-xs text-zinc-500">{auditDetail(e)}</td>
              <td className="px-3 py-2 whitespace-nowrap">{e.actor_name ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
