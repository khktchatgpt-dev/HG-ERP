import { Fragment } from 'react'
import type { MatrixData } from '@/modules/core/rbac/rbac.service'
import { DOMAIN_LABEL, gkey } from './shared'

/** Ma trận Vai×Quyền tổng quan — SERVER component (đọc). */
export function MatrixGrid({ roles, permissions, rolePermissions }: MatrixData) {
  const grants = new Set(rolePermissions.map((rp) => gkey(rp.role_id, rp.permission_key)))
  const gmap = new Map<string, typeof permissions>()
  for (const p of permissions) {
    const arr = gmap.get(p.domain) ?? []
    arr.push(p)
    gmap.set(p.domain, arr)
  }
  const groups = [...gmap.entries()]
  const active = roles.filter((r) => r.is_active)

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
            <th className="sticky left-0 z-10 bg-zinc-50 px-3 py-2 text-left text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:bg-zinc-900/50">
              Quyền
            </th>
            {active.map((r) => (
              <th
                key={r.id}
                className="px-2 py-2 text-center text-xs font-medium whitespace-nowrap text-zinc-600 dark:text-zinc-300"
                title={r.key}
              >
                {r.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map(([domain, items]) => (
            <Fragment key={domain}>
              <tr className="bg-zinc-100/60 dark:bg-zinc-800/40">
                <td
                  colSpan={active.length + 1}
                  className="sticky left-0 px-3 py-1 text-xs font-semibold tracking-wider text-zinc-500 uppercase"
                >
                  {DOMAIN_LABEL[domain] ?? domain}
                </td>
              </tr>
              {items.map((p) => (
                <tr
                  key={p.key}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                >
                  <td className="sticky left-0 z-10 bg-white px-3 py-1.5 dark:bg-zinc-950">
                    <div className="font-medium text-zinc-800 dark:text-zinc-100">
                      {p.label}
                    </div>
                    <div className="font-mono text-[11px] text-zinc-400">{p.key}</div>
                  </td>
                  {active.map((r) => (
                    <td key={r.id} className="px-2 py-1.5 text-center">
                      {grants.has(gkey(r.id, p.key)) || r.key === 'admin' ? (
                        <span className="text-emerald-600 dark:text-emerald-400">✓</span>
                      ) : (
                        <span className="text-zinc-300 dark:text-zinc-700">·</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
