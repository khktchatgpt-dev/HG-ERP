'use client'

/** Thanh nút In/Đóng (+ Xuất Excel nếu phiếu có) — tự ẩn khi in (print:hidden). */
export function PrintToolbar({ exportHref }: { exportHref?: string }) {
  return (
    <div className="mb-4 flex justify-end gap-2 print:hidden">
      <button
        onClick={() => window.close()}
        className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50"
      >
        Đóng
      </button>
      {exportHref && (
        <a
          href={exportHref}
          download
          className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
        >
          ⬇ Xuất Excel
        </a>
      )}
      <button
        onClick={() => window.print()}
        className="rounded-md bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-700"
      >
        🖨 In
      </button>
    </div>
  )
}
