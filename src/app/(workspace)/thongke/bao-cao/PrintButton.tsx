'use client'

/** Nút in báo cáo — dùng print CSS của trang (ẩn shell/bộ lọc khi in). */
export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900 print:hidden"
    >
      ⎙ In báo cáo
    </button>
  )
}
