import Link from 'next/link'

export type TabItem = {
  id: string
  label: string
  href: string
  count?: number
  tone?: 'default' | 'red' | 'amber'
}

/** Server-rendered tab strip backed by URL (each tab is a Link). */
export function Tabs({
  items,
  active,
  className = '',
}: {
  items: TabItem[]
  active: string
  className?: string
}) {
  return (
    <div className={`flex gap-1 border-b border-zinc-200 text-sm dark:border-zinc-800 ${className}`}>
      {items.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-2 transition ${
            active === t.id
              ? 'border-slate-900 text-zinc-900 dark:border-white dark:text-white'
              : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          {t.label}
          {typeof t.count === 'number' && (
            <span
              className={`rounded-full px-1.5 py-0.5 text-xs ${
                t.tone === 'red' && t.count > 0
                  ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                  : t.tone === 'amber' && t.count > 0
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
              }`}
            >
              {t.count}
            </span>
          )}
        </Link>
      ))}
    </div>
  )
}
