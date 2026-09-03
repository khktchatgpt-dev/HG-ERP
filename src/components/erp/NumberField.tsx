'use client'

import { useState } from 'react'
import { Input } from '@/components/shadcn/input'

/**
 * Ô SỐ GÕ ĐƯỢC SỐ THẬP PHÂN — phần chung của cả lưới lẫn form (03/09/2026).
 *
 * Vì sao cần: `<input type="number">` trả về CHUỖI RỖNG cho mọi trạng thái gõ
 * dở ("0." và "0," đều không phải số hợp lệ). Ô nào giữ state là SỐ thì mỗi
 * phím thập phân bị đặt lại về số cũ — 0,38 không có đường nào gõ thẳng, phải
 * lách bằng cách gõ một chữ số mồi rồi quay lại xoá (báo cáo phòng Cung ứng,
 * ô "m³ / SP" của mẫu đơn gỗ).
 *
 * Ô nào giữ state là CHUỖI thì thoát nạn, nhưng chỉ do may: chuỗi rỗng ghi đè
 * lên chuỗi rỗng nên không thấy gì. Đổi nó sang số một ngày nào đó là lỗi quay
 * lại, im lặng.
 *
 * Cách chữa: ô CHỮ + `inputMode="decimal"` (điện thoại vẫn ra bàn phím số),
 * giữ nguyên văn cái đang gõ tới khi rời ô, chỉ báo ra ngoài khi đọc được
 * thành số. `type="number"` vốn không cho gì ở đây — mũi tên tăng/giảm bị ẩn
 * bằng CSS, lăn chuột bị chặn vì nó âm thầm đổi tiền.
 */
export function useNumberDraft({
  value,
  onValueChange,
  min,
  max,
  onFocus,
  onBlur,
}: {
  value: number | ''
  onValueChange: (v: number | '') => void
  min?: number
  max?: number
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)

  return {
    type: 'text' as const,
    inputMode: 'decimal' as const,
    value: draft ?? (value === '' ? '' : String(value)),
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
      // Bôi đen sẵn: ô đang là "0" thì gõ đè là xong, không phải xoá trước.
      e.currentTarget.select()
      onFocus?.(e)
    },
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      // Chặn CHỮ ngay lúc gõ để ô không bao giờ mang giá trị server sẽ từ chối.
      const raw = e.target.value.replace(/[^\d.,-]/g, '')
      setDraft(raw)
      if (raw.trim() === '') {
        onValueChange('')
        return
      }
      // Dấu PHẨY hiểu như dấu chấm — người Việt gõ phẩy, ô cũ nuốt ký tự đó.
      const n = Number(raw.replace(',', '.'))
      if (!Number.isFinite(n)) return // "0," / "-" — giữ nguyên, chờ gõ tiếp
      if (min != null && n < min) return
      if (max != null && n > max) return
      onValueChange(n)
    },
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
      // Rời ô thì bỏ bản nháp, hiện lại con số đã chốt (bỏ "0," dở dang, gọn
      // "007" thành 7) — cùng lối bảng tính.
      setDraft(null)
      onBlur?.(e)
    },
  }
}

/**
 * Ô SỐ CỦA FORM — `Input` của kit + `useNumberDraft`.
 *
 * Dùng cho mọi ô tiền / số lượng / định mức ngoài lưới. Trong lưới bảng tính
 * thì dùng `GridCellNumber` (erp/GridCell) — cùng một logic, khác lớp áo.
 */
export function NumberField({
  value,
  onValueChange,
  min = 0,
  max,
  onFocus,
  onBlur,
  ...props
}: Omit<
  React.ComponentProps<typeof Input>,
  'value' | 'onChange' | 'type' | 'min' | 'max'
> & {
  value: number | ''
  onValueChange: (v: number | '') => void
  min?: number
  max?: number
}) {
  const bind = useNumberDraft({ value, onValueChange, min, max, onFocus, onBlur })
  return <Input {...props} {...bind} />
}
