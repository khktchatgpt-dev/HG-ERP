export function Skeleton({
  className = '',
  width,
  height,
}: {
  className?: string
  width?: number | string
  height?: number | string
}) {
  return (
    <span
      aria-hidden
      className={`block animate-pulse rounded bg-zinc-200 dark:bg-zinc-800 ${className}`}
      style={{ width, height }}
    />
  )
}

/** Skeleton for a typical list row (avatar + 2 lines + badge). */
export function ListRowSkeleton() {
  return (
    <div className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3 last:border-b-0 dark:border-zinc-900">
      <Skeleton className="h-8 w-8 rounded-full" />
      <div className="flex-1">
        <Skeleton className="mb-1.5 h-3 w-2/5" />
        <Skeleton className="h-2.5 w-1/3" />
      </div>
      <Skeleton className="h-5 w-16 rounded-full" />
    </div>
  )
}

/** Skeleton for stats card. */
export function StatCardSkeleton() {
  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <Skeleton className="h-8 w-12" />
      <Skeleton className="mt-2 h-3 w-20" />
    </div>
  )
}

/** Generic table skeleton — header + N rows. */
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/50">
        <Skeleton className="h-3 w-32" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <ListRowSkeleton key={i} />
      ))}
    </div>
  )
}
