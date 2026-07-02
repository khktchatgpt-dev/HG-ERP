/**
 * Skeleton vùng nội dung dùng chung cho loading.tsx của các workspace.
 * Render bên trong layout (shell cố định) → chỉ phần nội dung nhấp nháy.
 */
export function ContentSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-4">
      {/* PageHeader */}
      <div className="border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <div className="h-3 w-40 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="mt-2 h-6 w-56 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="mt-2 h-3 w-72 rounded bg-zinc-100 dark:bg-zinc-900" />
      </div>

      {/* StatsBar */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-zinc-200 sm:grid-cols-3 lg:grid-cols-6 dark:border-zinc-800">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white p-4 dark:bg-zinc-950">
            <div className="h-2 w-16 rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="mt-2 h-6 w-10 rounded bg-zinc-200 dark:bg-zinc-800" />
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
        <div className="h-9 border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b border-zinc-100 px-3 py-2.5 last:border-0 dark:border-zinc-900"
          >
            <div className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-800" />
            <div className="flex-1">
              <div className="h-3 w-1/3 rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="mt-1.5 h-2 w-1/2 rounded bg-zinc-100 dark:bg-zinc-900" />
            </div>
            <div className="h-4 w-20 rounded bg-zinc-100 dark:bg-zinc-900" />
          </div>
        ))}
      </div>
    </div>
  )
}
