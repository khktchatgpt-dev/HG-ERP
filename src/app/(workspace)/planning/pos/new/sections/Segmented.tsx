'use client'

/**
 * NÚT GẠT PHÂN ĐOẠN (segmented control) — nhóm lựa chọn ít, bấm là chọn, trạng
 * thái đọc được ngay trên thanh. Dùng chung cho VAT / đã gồm-chưa gồm (TotalsBar)
 * và Theo LSX / Ngoài LSX (Bối cảnh đơn) để hai chỗ không mỗi nơi một kiểu.
 */
export function Segmented<T extends string | number>({
  options,
  value,
  onSelect,
  label,
}: {
  options: readonly { value: T; label: string }[]
  value: T | null
  onSelect: (v: T) => void
  label: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex rounded-lg border border-zinc-200 bg-zinc-100 p-0.5 dark:border-zinc-700 dark:bg-zinc-800"
    >
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onSelect(o.value)}
            className={
              'rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors ' +
              (on
                ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-100'
                : 'text-muted-foreground hover:text-zinc-700 dark:hover:text-zinc-300')
            }
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
