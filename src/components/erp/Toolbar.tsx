'use client'

import { Input } from '@/components/shadcn/input'
import { cn } from '@/lib/utils'

/**
 * Filter/action toolbar dense — dùng ngay trên bảng dữ liệu.
 * Nay ăn token (bg-card/border) thay vì zinc gõ cứng, để khớp theme đang phủ.
 */
export function Toolbar({
  left,
  right,
  sticky = false,
}: {
  left?: React.ReactNode
  right?: React.ReactNode
  sticky?: boolean
}) {
  return (
    <div
      className={cn(
        'bg-card flex flex-wrap items-center justify-between gap-2 rounded-t-lg border border-b-0 px-2 py-1.5',
        sticky && 'sticky top-16 z-[5]',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">{left}</div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  )
}

/** Compact filter input dùng trong toolbar — lớp mỏng trên shadcn/input. */
export function ToolbarInput({
  value,
  onChange,
  placeholder,
  icon,
  className = '',
  onEnter,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  /** Ký tự ('⌕') hoặc icon component — cả hai đều render được. */
  icon?: React.ReactNode
  className?: string
  /**
   * Có onEnter = tìm ở SERVER, chỉ chạy khi bấm Enter.
   * Danh sách lớn (13k vật tư) mà tìm theo từng phím là mỗi ký tự một vòng
   * server + một lượt đếm lại; gõ "thép hộp" là 8 vòng cho một lần tìm.
   */
  onEnter?: () => void
}) {
  return (
    <div className={cn('relative', className)}>
      {icon && (
        <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 flex -translate-y-1/2 items-center text-xs [&_svg]:size-4">
          {icon}
        </span>
      )}
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onEnter) {
            e.preventDefault()
            onEnter()
          }
        }}
        placeholder={placeholder}
        className={cn('h-8 w-full text-sm', icon && 'pl-7')}
      />
    </div>
  )
}

/**
 * Compact select dùng trong toolbar. Giữ <select> native (nhẹ, mở nhanh bằng
 * bàn phím, không portal) nhưng style theo token cho khớp Input bên cạnh.
 */
export function ToolbarSelect<T extends string>({
  value,
  onChange,
  options,
  className = '',
  'aria-label': ariaLabel,
}: {
  value: T
  onChange: (v: T) => void
  options: readonly { value: T; label: string }[]
  className?: string
  /** Bắt buộc khi ô KHÔNG có <label> nhìn thấy được — select trần không tự có
   *  tên cho trình đọc màn hình. Trước đây prop này không tồn tại nên chỗ gọi
   *  truyền vào là rơi im lặng (TS không báo). */
  'aria-label'?: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      aria-label={ariaLabel}
      className={cn(
        'border-input bg-card focus-visible:border-ring focus-visible:ring-ring/50 h-8 rounded-md border px-2 text-sm transition-[color,box-shadow] outline-none focus-visible:ring-[3px]',
        className,
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
