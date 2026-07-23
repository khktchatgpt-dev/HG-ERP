'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { seg: 'people', label: 'Nhân viên' },
  { seg: 'roles', label: 'Vai trò' },
  { seg: 'actions', label: 'Thao tác' },
  { seg: 'matrix', label: 'Ma trận' },
  { seg: 'audit', label: 'Nhật ký' },
]

const BASE = '/admin/permissions'

export function SubNav() {
  const pathname = usePathname()
  return (
    <div className="-mx-1 flex gap-0.5 overflow-x-auto rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-800">
      {TABS.map((t) => {
        const href = `${BASE}/${t.seg}`
        const active = pathname === href || pathname.startsWith(`${href}/`)
        return (
          <Link
            key={t.seg}
            href={href}
            className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition ${
              active
                ? 'bg-sky-600 text-white'
                : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
            }`}
          >
            {t.label}
          </Link>
        )
      })}
    </div>
  )
}
