'use client'

import { Building2, Check, FileText, TriangleAlert } from 'lucide-react'

/**
 * Thanh ngữ cảnh DÍNH ĐẦU: mẫu · LSX · NCC · số dòng đủ số.
 *
 * Danh sách dòng hàng dài; cuộn xuống giữa chừng là mất hết phần đầu đơn, người
 * soạn không còn thấy mình đang đặt cho NCC nào, mẫu nào — mà gõ nhầm cột theo
 * mẫu khác thì sai tiền. Thanh này ghim lại đúng ba thông tin đó dạng chip.
 *
 * Cặp với thanh tổng dính đáy: trên là "đang soạn cho ai", dưới là "hết bao nhiêu".
 */
export function ContextStrip({
  templateLabel,
  lsxLabel,
  supplierName,
  readyLines,
  totalLines,
}: {
  templateLabel: string
  /** Mã LSX, "ngoài LSX", hoặc "— chưa chọn —" — ba trạng thái khác nhau. */
  lsxLabel: string
  supplierName: string | null
  readyLines: number
  totalLines: number
}) {
  const thieu = totalLines - readyLines
  return (
    // `top-[59px]` = đúng đáy topbar (2px accent + h-14). Để `top-16` (64px)
    // thì giữa hai thanh hở 5px và nội dung trang chạy qua khe đó khi cuộn.
    <div className="sticky top-[59px] z-[9] -mx-1 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-zinc-200 bg-white/95 px-2.5 py-1.5 text-[12px] shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[11px] font-medium text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300">
        <span className="size-1.5 rounded-full bg-violet-500" aria-hidden />
        {templateLabel}
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 px-2.5 py-0.5 text-muted-foreground dark:border-zinc-700">
        <FileText className="size-3" aria-hidden />
        LSX <b className="font-mono text-zinc-600 dark:text-zinc-300">{lsxLabel}</b>
      </span>
      <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-zinc-200 px-2.5 py-0.5 text-muted-foreground dark:border-zinc-700">
        <Building2 className="size-3 shrink-0" aria-hidden />
        NCC{' '}
        <b className="truncate text-zinc-600 dark:text-zinc-300">
          {supplierName ?? '— chưa chọn —'}
        </b>
      </span>
      <span className="ml-auto">
        {totalLines === 0 ? (
          <span className="text-muted-foreground">chưa có dòng nào</span>
        ) : thieu > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400">
            <TriangleAlert className="size-3" aria-hidden />
            {thieu}/{totalLines} dòng còn thiếu số
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400">
            <Check className="size-3" aria-hidden />
            {totalLines} dòng đủ số
          </span>
        )}
      </span>
    </div>
  )
}
