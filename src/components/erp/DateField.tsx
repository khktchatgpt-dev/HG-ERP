'use client'

import { useRef, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { Input } from '@/components/shadcn/input'
import { isoToVn, maskVnDate, vnToIso } from '@/lib/date-vn'
import { cn } from '@/lib/utils'

/**
 * Ô NGÀY KIỂU VIỆT NAM.
 *
 * `<input type="date">` vẽ chữ theo NGÔN NGỮ TRÌNH DUYỆT chứ không theo app:
 * máy cài Chrome tiếng Anh (đa số máy ở xưởng) hiện `mm/dd/yyyy`, trong khi mọi
 * chỗ khác của app và mọi chứng từ giấy đọc `dd/mm/yyyy` — `03/08` với `08/03`
 * là hai ngày khác nhau và không nhìn ra ô đang nói kiểu nào. Ô này tự vẽ chữ
 * `dd/mm/yyyy`, còn giá trị vào/ra vẫn là ISO `yyyy-mm-dd` y như `type="date"`
 * nên chỗ gọi không phải đổi gì.
 *
 * Vẫn giữ lịch bấm-chọn: nút lịch mở đúng bộ chọn của trình duyệt qua một
 * `input type="date"` trong suốt nằm chồng lên (`showPicker`).
 */
export function DateField({
  value,
  onChange,
  className,
  id,
  disabled,
  min,
  max,
  'aria-label': ariaLabel,
}: {
  /** ISO `yyyy-mm-dd`, hoặc '' khi để trống. */
  value: string
  onChange: (iso: string) => void
  className?: string
  id?: string
  disabled?: boolean
  min?: string
  max?: string
  'aria-label'?: string
}) {
  const [text, setText] = useState(() => isoToVn(value))
  const pickerRef = useRef<HTMLInputElement>(null)

  // Giá trị đổi từ bên ngoài (khôi phục nháp, nạp đơn để sửa) thì vẽ lại chữ —
  // nhưng đừng giẫm lên tay người đang gõ (chữ hiện tại đã ra đúng ngày ấy).
  // Chỉnh state ngay trong lượt render theo kiểu React khuyên, không useEffect.
  const [seen, setSeen] = useState(value)
  if (seen !== value) {
    setSeen(value)
    if (vnToIso(text) !== (value || null)) setText(isoToVn(value))
  }

  return (
    <span className="relative block">
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={10}
        placeholder="dd/mm/yyyy"
        aria-label={ariaLabel}
        disabled={disabled}
        value={text}
        onChange={(e) => {
          const next = maskVnDate(e.target.value)
          setText(next)
          const iso = vnToIso(next)
          if (iso) onChange(iso)
          else if (next === '') onChange('')
        }}
        onBlur={() => {
          // Gõ dở/ngày không có thật thì trả ô về giá trị đang giữ, không để
          // người dùng tưởng đã nhập được.
          const iso = vnToIso(text)
          setText(text.trim() === '' ? '' : isoToVn(iso ?? value))
        }}
        className={cn('t-data pr-9', className)}
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        aria-label="Mở lịch"
        onClick={() => {
          const el = pickerRef.current
          if (!el) return
          try {
            el.showPicker()
          } catch {
            el.focus() // trình duyệt cũ: ít nhất cũng nhảy vào ô lịch
          }
        }}
        className="text-muted-foreground/70 hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 disabled:opacity-50"
      >
        <CalendarDays className="size-4" aria-hidden />
      </button>
      {/* Ô lịch thật: trong suốt, nằm dưới nút — KHÔNG dùng `hidden`/`display:none`
          vì `showPicker()` từ chối phần tử không được vẽ. */}
      <input
        ref={pickerRef}
        type="date"
        tabIndex={-1}
        aria-hidden
        disabled={disabled}
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setText(isoToVn(e.target.value))
        }}
        className="pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2 opacity-0"
      />
    </span>
  )
}
