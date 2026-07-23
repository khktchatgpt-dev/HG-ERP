'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { initials } from './shared'
import type { PersonListItem } from '@/modules/core/rbac/rbac.service'

export function PeopleList({
  people,
  selectedId,
}: {
  people: PersonListItem[]
  selectedId?: string
}) {
  const [q, setQ] = useState('')
  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    if (!ql) return people
    return people.filter((u) =>
      `${u.name ?? ''} ${u.email} ${u.department ?? ''}`.toLowerCase().includes(ql),
    )
  }, [people, q])

  return (
    <div className="flex flex-col rounded-lg border border-zinc-200 dark:border-zinc-800">
      <div className="border-b border-zinc-200 p-2 dark:border-zinc-800">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm tên, email, phòng…"
          className="w-full rounded-md border border-zinc-200 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-sky-400 dark:border-zinc-700"
        />
      </div>
      <div className="max-h-[70vh] overflow-y-auto">
        {filtered.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-zinc-400">Không tìm thấy.</p>
        )}
        {filtered.map((u) => {
          const on = u.id === selectedId
          return (
            <Link
              key={u.id}
              href={`/admin/permissions/people?u=${u.id}`}
              scroll={false}
              className={`flex w-full items-center gap-3 border-b border-zinc-100 px-3 py-2 text-left last:border-0 dark:border-zinc-900 ${
                on
                  ? 'bg-sky-50 dark:bg-sky-950/40'
                  : 'hover:bg-zinc-50 dark:hover:bg-zinc-900'
              }`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                  on
                    ? 'bg-sky-600 text-white'
                    : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-200'
                }`}
              >
                {initials(u.name, u.email)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">
                  {u.name ?? u.email}
                </span>
                <span className="block truncate text-xs text-zinc-400">
                  {u.department ?? 'Chưa gán phòng'}
                </span>
              </span>
              {u.role === 'admin' ? (
                <span className="shrink-0 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                  ADMIN
                </span>
              ) : (
                <span className="shrink-0 text-xs text-zinc-400">{u.roleCount} vai</span>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
