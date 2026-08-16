/**
 * Skeleton vùng nội dung dùng chung cho loading.tsx của các workspace.
 * Render bên trong layout (shell cố định) → chỉ phần nội dung nhấp nháy.
 * Màu lấy từ token (muted/card/border) để khớp theme đang phủ.
 */
export function ContentSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-4">
      {/* PageHeader */}
      <div className="border-b pb-4">
        <div className="bg-muted h-3 w-40 rounded" />
        <div className="bg-muted mt-2 h-6 w-56 rounded" />
        <div className="bg-muted/60 mt-2 h-3 w-72 rounded" />
      </div>

      {/* StatsBar */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-card p-4">
            <div className="bg-muted h-2 w-16 rounded" />
            <div className="bg-muted mt-2 h-6 w-10 rounded" />
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border">
        <div className="bg-muted/50 h-9 border-b" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="border-border/60 flex items-center gap-3 border-b px-3 py-2.5 last:border-0"
          >
            <div className="bg-muted h-8 w-8 rounded-full" />
            <div className="flex-1">
              <div className="bg-muted h-3 w-1/3 rounded" />
              <div className="bg-muted/60 mt-1.5 h-2 w-1/2 rounded" />
            </div>
            <div className="bg-muted/60 h-4 w-20 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
