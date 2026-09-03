'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * Ô NHẬP TRONG LƯỚI KIỂU BẢNG TÍNH.
 *
 * Khác `Input` của kit ở bản chất, không phải ở trang trí: ô này KHÔNG có viền
 * và nền riêng — nó lấp đầy ô `<td>` và để đường kẻ của bảng làm viền, đúng
 * cảm giác Excel mà người soạn đơn đang quen. Bọc `Input` rồi ghi đè
 * `border-0 rounded-none bg-transparent h-[32px]` là xoá gần hết thứ khiến
 * Input là Input, nên nó xứng đáng là một primitive riêng.
 *
 * Ở kit (chứ không nằm cạnh chỗ gọi) vì hai lẽ: `<input>` thô chỉ được phép
 * sống trong kit, và lưới thứ hai của app (định mức SP) sớm muộn cũng cần đúng
 * ô này — hiện nó đang tự dựng bản riêng.
 *
 * 02/09: đổi `focus:bg-sky-50/70` + `ring-sky-500/60` (sót lại từ theme-v2)
 * sang `--accent` / `--ring`. Trước đó `PoLineTable` phải vá đè ở thẻ bao
 * (`[&_input:focus]:bg-[var(--accent)]`) — chữa ngọn vì gốc sai màu.
 */
export const gridCellClass =
  'h-[32px] w-full rounded-none border-0 bg-transparent px-2 text-[13px] outline-none ring-inset transition-colors focus:bg-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]/45 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'

export function GridCellInput({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <input data-slot="grid-cell" className={cn(gridCellClass, className)} {...props} />
  )
}

/**
 * Ô SỐ TRONG LƯỚI — gõ được số thập phân, kể cả lúc gõ dở (03/09/2026).
 *
 * VÌ SAO KHÔNG DÙNG `type="number"` NỮA. Các ô cũ ghi
 * `value={số}` + `onChange={Number(e.target.value)}`, và với `type="number"`
 * trình duyệt trả về CHUỖI RỖNG cho mọi trạng thái gõ dở: "0." và "0," đều là
 * số không hợp lệ. Nên vừa gõ dấu phẩy là ô bị đặt lại, và số 0,38 không có
 * đường nào gõ thẳng — người dùng phải gõ "0," rồi một chữ số khác 0, gõ nốt
 * phần còn lại rồi quay lại xoá chữ số mồi đó (báo cáo của phòng Cung ứng, ô
 * "m³ / SP" của mẫu đơn gỗ).
 *
 * Ba thứ `type="number"` đáng lẽ cho thì màn này đã tự tay tắt hết: mũi tên
 * tăng/giảm bị ẩn bằng CSS, lăn chuột bị chặn (`blurOnWheel`) vì nó âm thầm
 * đổi tiền. Nên đổi sang ô CHỮ với `inputMode="decimal"` (điện thoại vẫn ra bàn
 * phím số) là mất không, được nhiều.
 *
 * Giữ NGUYÊN VĂN cái đang gõ trong `draft` cho tới khi rời ô; chỉ báo ra ngoài
 * khi chuỗi đọc được thành số. Dấu PHẨY hiểu như dấu chấm — người Việt gõ phẩy,
 * và ô cũ nuốt luôn ký tự đó.
 *
 * Bôi đen sẵn khi vào ô: ô đang là "0" thì gõ đè là xong, không phải xoá trước.
 */
export function GridCellNumber({
  value,
  onValueChange,
  onFocus,
  onBlur,
  min = 0,
  max,
  ...props
}: Omit<React.ComponentProps<'input'>, 'value' | 'onChange' | 'type' | 'min' | 'max'> & {
  value: number | ''
  onValueChange: (v: number | '') => void
  min?: number
  max?: number
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? (value === '' ? '' : String(value))

  return (
    <GridCellInput
      {...props}
      type="text"
      inputMode="decimal"
      value={shown}
      onFocus={(e) => {
        e.currentTarget.select()
        onFocus?.(e)
      }}
      onChange={(e) => {
        // Chỉ nhận chữ số, dấu thập phân và dấu trừ — chặn chữ ngay lúc gõ để
        // ô không bao giờ mang một giá trị mà server sẽ từ chối.
        const raw = e.target.value.replace(/[^\d.,-]/g, '')
        setDraft(raw)
        if (raw.trim() === '') {
          onValueChange('')
          return
        }
        const n = Number(raw.replace(',', '.'))
        if (!Number.isFinite(n)) return // "0," / "-" — giữ nguyên, chờ gõ tiếp
        if (n < min) return
        if (max != null && n > max) return
        onValueChange(n)
      }}
      onBlur={(e) => {
        // Rời ô thì bỏ bản nháp, hiện lại con số đã chốt (bỏ "0," dở dang,
        // gọn "007" thành 7) — cùng lối bảng tính.
        setDraft(null)
        onBlur?.(e)
      }}
    />
  )
}

export function GridCellTextarea({
  className,
  ...props
}: React.ComponentProps<'textarea'>) {
  return (
    <textarea data-slot="grid-cell" className={cn(gridCellClass, className)} {...props} />
  )
}

/**
 * Select trong lưới. Nhận `children` (thẻ `<option>`) chứ không nhận mảng
 * `options` như `ToolbarSelect`: các cột ở đây dựng option theo mẫu đơn và có
 * nhánh điều kiện, ép vào mảng là phải viết lại logic — đổi trang trí thì
 * không được đổi luôn cách sinh dữ liệu.
 */
export function GridCellSelect({
  className,
  children,
  ...props
}: React.ComponentProps<'select'>) {
  return (
    <select data-slot="grid-cell" className={cn(gridCellClass, className)} {...props}>
      {children}
    </select>
  )
}
