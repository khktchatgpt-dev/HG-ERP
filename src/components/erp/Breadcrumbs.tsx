import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export type Crumb = { label: string; href?: string }

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="text-muted-foreground flex items-center gap-1.5 text-xs"
    >
      {items.map((c, i) => {
        const last = i === items.length - 1
        return (
          <span key={i} className="flex items-center gap-1.5">
            {c.href && !last ? (
              <Link
                href={c.href}
                className="hover:text-foreground transition-colors hover:underline"
              >
                {c.label}
              </Link>
            ) : (
              <span className={last ? 'text-foreground font-medium' : ''}>{c.label}</span>
            )}
            {!last && <ChevronRight className="size-3 shrink-0 opacity-60" />}
          </span>
        )
      })}
    </nav>
  )
}
