'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Btn } from '@/components/kit'

/* ── Hai mảnh nhỏ của đầu phiếu, chỉ màn này dùng ─────────────────────── */

/** Nhãn ô đầu phiếu kèm số thứ tự câu hỏi (1 xuất cho → 2 lệnh → 3 tổ → 4 ngày). */
export function Buoc({
  n,
  dim = false,
  need = false,
  children,
}: {
  n: number | string
  dim?: boolean
  /** Ô bắt buộc đang TRỐNG sau khi đã bấm Ghi sổ — mới đỏ, không đỏ lúc mở form. */
  need?: boolean
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'text-k-label inline-flex items-center gap-1.5 font-bold tracking-[.07em] whitespace-nowrap uppercase',
        need ? 'text-[var(--stop)]' : 'text-[var(--ink-label)]',
      )}
    >
      <i
        className={cn(
          'text-k-label grid h-4 w-4 place-items-center rounded-full font-bold tracking-normal not-italic',
          need
            ? 'bg-[var(--stop)] text-white'
            : dim
              ? 'bg-[var(--track)] text-[var(--ink-2)]'
              : 'bg-[var(--act)] text-[var(--act-ink)]',
        )}
      >
        {n}
      </i>
      {children}
    </span>
  )
}

/** Dải nút chọn một — segmented control dựng từ `Btn` của kit. */
export function Seg<T extends string>({
  value,
  options,
  onChange,
  label,
  disabled,
  need = false,
}: {
  value: T | ''
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  label: string
  disabled?: boolean
  need?: boolean
}) {
  return (
    <span
      role="radiogroup"
      aria-label={label}
      className={cn(
        'inline-flex h-[26px] overflow-hidden rounded-[var(--radius)] border',
        need ? 'border-[var(--stop)]' : 'border-[var(--line)]',
      )}
    >
      {options.map((o) => (
        <Btn
          key={o.value}
          primary={o.value === value}
          disabled={disabled}
          aria-checked={o.value === value}
          role="radio"
          onClick={() => onChange(o.value)}
          className={cn(
            'text-k-sm h-full rounded-none border-0 border-r border-[var(--line)] px-3 last:border-r-0',
            o.value !== value && 'bg-[var(--surface-card)] font-medium',
          )}
        >
          {o.label}
        </Btn>
      ))}
    </span>
  )
}
