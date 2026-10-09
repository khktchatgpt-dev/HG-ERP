'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * Ô SỬA TẠI CHỖ dùng chung cho các bảng của hồ sơ (đóng gói, tài liệu…):
 * chữ thường khi xem; ở chế độ sửa là ô nhập, rời ô / Enter là lưu nếu có đổi,
 * Esc trả lại. `onSave` nhận chuỗi thô, tự parse số theo luật VN nếu cần.
 */
export function OTxt({
  sua,
  value,
  ph = '—',
  num,
  w,
  show,
  onSave,
}: {
  sua: boolean
  value: string
  ph?: string
  num?: boolean
  w?: number
  /** Chữ bày khi xem (mặc định = value). */
  show?: string
  onSave: (raw: string) => Promise<unknown> | void
}) {
  const [val, setVal] = useState(value)
  const [key, setKey] = useState(value)
  if (key !== value) {
    setKey(value)
    setVal(value)
  }
  if (!sua) {
    const t = show ?? value
    return <span className={cn(!t && 'muted')}>{t || ph}</span>
  }
  const commit = () => {
    if (val.trim() !== value.trim()) void onSave(val)
  }
  return (
    <input
      className={cn('cell', num && 'num')}
      value={val}
      placeholder={ph}
      aria-label={ph}
      inputMode={num ? 'decimal' : undefined}
      style={w ? { width: w } : undefined}
      onChange={(e) => setVal(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          commit()
          e.currentTarget.blur()
        }
        if (e.key === 'Escape') setVal(value)
      }}
      onBlur={commit}
    />
  )
}

/** "1.390" → 1390 · "2,5" → 2.5 · "" → null · chữ → undefined. */
export function soVn(raw: string): number | null | undefined {
  const t = raw.trim()
  if (!t) return null
  const n = Number(t.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : undefined
}
