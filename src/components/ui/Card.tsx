type Props = {
  title?: string
  description?: string
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
  padded?: boolean
}

/** Generic content card with optional title/description/actions header. */
export function Card({
  title,
  description,
  actions,
  children,
  className = '',
  padded = true,
}: Props) {
  return (
    <section
      className={`rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 ${className}`}
    >
      {(title || actions) && (
        <header
          className={`flex items-center justify-between gap-3 ${
            padded ? 'border-b border-zinc-200 px-5 py-3 dark:border-zinc-800' : ''
          }`}
        >
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold">{title}</h2>}
            {description && (
              <p className="text-xs text-zinc-500">{description}</p>
            )}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </header>
      )}
      <div className={padded ? 'p-5' : ''}>{children}</div>
    </section>
  )
}
