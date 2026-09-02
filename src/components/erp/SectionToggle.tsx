'use client'

import { ChevronDown, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * ĐẦU KHỐI GẬP/MỞ — thanh tiêu đề của một `<section>` thu gọn được.
 *
 * Lên kit 02/09/2026 khi dọn `/planning/pos/new`: `TermsSection` và
 * `ShipmentPlanPanel` đang chép cùng một chuỗi class
 * (`flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[13px]`) mà lệch
 * nhau ở phần gợi ý bên phải — một bên pill có viền + mũi tên, một bên chỉ chữ
 * xám. Gộp về bản CÓ pill: ghi chú trong TermsSection kể rằng bản chữ-xám từng
 * làm cả khối trở nên vô hình (người dùng lướt qua như thể là chú thích), và
 * đó là bài học đã trả giá rồi.
 *
 * KHÔNG dùng `Button`: nút của kit là `whitespace-nowrap shrink-0`, còn thanh
 * này cần một dòng tóm tắt CO ĐƯỢC và cắt bằng `truncate`. Ép vào Button thì
 * phải ghi đè ngược lại gần hết, tức là mất đúng thứ dùng Button để có.
 */
export function SectionToggle({
  icon: Icon,
  title,
  summary,
  open,
  onToggle,
  openLabel = 'Mở',
  closeLabel = 'Thu gọn',
  className,
}: {
  icon?: LucideIcon
  title: string
  /** Hé lộ NỘI DUNG thật khi đang đóng — không phải mô tả kiểu "đã điền sẵn". */
  summary?: React.ReactNode
  open: boolean
  onToggle: () => void
  /** Chữ trên pill khi đang đóng. "Sửa" nếu mở ra là để nhập liệu. */
  openLabel?: string
  closeLabel?: string
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={cn(
        'flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[13px]',
        className,
      )}
    >
      {Icon && (
        <Icon
          className="text-muted-foreground size-4 shrink-0"
          strokeWidth={1.8}
          aria-hidden
        />
      )}
      <b className="shrink-0">{title}</b>
      {summary != null && (
        <span className="text-muted-foreground min-w-0 truncate text-[11.5px]">
          {summary}
        </span>
      )}
      <span className="border-input text-muted-foreground ml-auto inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-[11.5px]">
        {open ? closeLabel : openLabel}
        <ChevronDown
          aria-hidden
          className={cn('size-3.5 transition-transform', open && 'rotate-180')}
        />
      </span>
    </button>
  )
}
