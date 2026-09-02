'use client'

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
