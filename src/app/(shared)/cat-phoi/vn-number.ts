'use client'

import { useState } from 'react'
import { parseCell } from '@/lib/cut-plan/paste'
import { fmtMm } from '@/lib/cut-plan/format'

/**
 * Ô SỐ CỦA MÀN QUY CẮT — đọc số theo LỐI VIỆT, cùng luật với dán từ Excel.
 *
 * `useNumberDraft` của kit hiểu dấu chấm là thập phân, nên gõ "1.390" vào ô Dài
 * cắt ra 1,39 mm trong khi dán chính chuỗi đó ra 1390 (đo 09/09/2026). Trong
 * màn này mọi chuỗi đi qua `parseCell` (`lib/cut-plan/paste`): "1.390" = 1390,
 * "1390,5" = 1390,5, số lượng làm tròn thành số nguyên. Lúc rời ô, con số đã
 * chốt hiện lại theo `fmtMm` (phẩy thập phân) để nhìn cũng là lối Việt.
 *
 * Chỉ dùng trong `cat-phoi/`; không sửa hook của kit vì các màn khác (tiền,
 * định mức) đang gõ dấu chấm thập phân theo thói quen của họ.
 */
export function useVnNumber({
  value,
  onValueChange,
  col,
}: {
  value: number | ''
  onValueChange: (v: number | '') => void
  col: 'length_mm' | 'qty'
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const shown = value === '' ? '' : col === 'qty' ? String(value) : fmtMm(value)
  return {
    type: 'text' as const,
    inputMode: 'decimal' as const,
    value: draft ?? shown,
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => e.currentTarget.select(),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/[^\d.,\s]/g, '')
      setDraft(raw)
      onValueChange(raw.trim() === '' ? '' : parseCell(col, raw))
    },
    onBlur: () => setDraft(null),
  }
}
