import Link from 'next/link'

export type Crumb = { label: string; href?: string }

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-zinc-500">
      {items.map((c, i) => {
        const last = i === items.length - 1
        return (
          <span key={i} className="flex items-center gap-1.5">
            {c.href && !last ? (
              <Link href={c.href} className="hover:text-zinc-900 hover:underline dark:hover:text-white">
                {c.label}
              </Link>
            ) : (
              <span className={last ? 'text-zinc-900 dark:text-white' : ''}>{c.label}</span>
            )}
            {!last && <span className="text-zinc-400">/</span>}
          </span>
        )
      })}
    </nav>
  )
}
