'use client'

import { useMemo, useState } from 'react'
import { ACTIONS, type Action } from '@/modules/core/rbac/actions'
import { DOMAIN_LABEL, ruleText } from './shared'

/** Sổ tay thao tác — luật authz đọc được. Data tĩnh (~60 mục) nên lọc phía client. */
export function ActionCatalog({ permLabels }: { permLabels: Record<string, string> }) {
  const [q, setQ] = useState('')
  const permLabel = (k: string) => permLabels[k] ?? k

  const groups = useMemo(() => {
    const ql = q.trim().toLowerCase()
    const items = ql
      ? ACTIONS.filter((a) =>
          `${a.label} ${a.key} ${DOMAIN_LABEL[a.domain] ?? a.domain}`
            .toLowerCase()
            .includes(ql),
        )
      : ACTIONS
    const m = new Map<string, Action[]>()
    for (const a of items) {
      const arr = m.get(a.domain) ?? []
      arr.push(a)
      m.set(a.domain, arr)
    }
    return [...m.entries()]
  }, [q])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm thao tác…"
          className="w-72 rounded-md border border-zinc-200 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-sky-400 dark:border-zinc-700"
        />
        <p className="text-xs text-zinc-400">
          {
            '«VÀ» = cần đủ mọi quyền · «HOẶC» = chỉ cần một · «Mọi nhân viên» = xem mở. Admin bỏ qua tất cả.'
          }
        </p>
      </div>
      {groups.map(([domain, items]) => (
        <div key={domain}>
          <div className="mb-1 text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
            {DOMAIN_LABEL[domain] ?? domain}
          </div>
          <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
            {items.map((a, i) => (
              <div
                key={a.key}
                className={`px-3 py-2 ${i > 0 ? 'border-t border-zinc-100 dark:border-zinc-900' : ''}`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <span className="font-medium text-zinc-800 dark:text-zinc-100">
                    {a.label}
                  </span>
                  <span className="text-sm text-zinc-500">
                    Cần:{' '}
                    <span className="font-medium text-zinc-700 dark:text-zinc-200">
                      {ruleText(a.rule, permLabel)}
                    </span>
                  </span>
                </div>
                {a.rowLevel && (
                  <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
                    ⚑ {a.rowLevel}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
