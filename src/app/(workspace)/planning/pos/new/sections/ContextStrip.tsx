'use client'

/**
 * Thanh ngữ cảnh DÍNH ĐẦU: mẫu · LSX · NCC · số dòng đủ số.
 *
 * Bảng dòng hàng dài và cuộn ngang; cuộn xuống giữa bảng là mất hết phần đầu đơn,
 * người soạn không còn thấy mình đang đặt cho NCC nào, mẫu nào — mà gõ nhầm cột
 * theo mẫu khác thì sai tiền. Thanh này ghim lại đúng ba thông tin đó.
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
    <div className="sticky top-16 z-[9] -mx-1 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-zinc-200 bg-white/95 px-3 py-1.5 text-[12px] shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
      <span className="rounded bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
        {templateLabel}
      </span>
      <span className="text-zinc-400">
        LSX <b className="font-mono text-zinc-600 dark:text-zinc-300">{lsxLabel}</b>
      </span>
      <span className="min-w-0 truncate text-zinc-400">
        NCC{' '}
        <b className="text-zinc-600 dark:text-zinc-300">
          {supplierName ?? '— chưa chọn —'}
        </b>
      </span>
      <span className="ml-auto text-zinc-400">
        {totalLines === 0 ? (
          'chưa có dòng nào'
        ) : thieu > 0 ? (
          <span className="text-amber-600 dark:text-amber-500">
            {thieu}/{totalLines} dòng còn thiếu số
          </span>
        ) : (
          <span className="text-green-600 dark:text-green-500">
            {totalLines} dòng đủ số
          </span>
        )}
      </span>
    </div>
  )
}
