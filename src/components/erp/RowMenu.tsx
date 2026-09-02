'use client'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/shadcn/dropdown-menu'

export type RowMenuItem = {
  label: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
  disabledReason?: string
}

/**
 * Menu ⋯ cho cell action — tiết kiệm chỗ so với xếp 5 nút.
 *
 * Nay là lớp mỏng trên `shadcn/dropdown-menu` (Radix): portal + auto-flip +
 * đóng khi cuộn/Esc/click ngoài đều do Radix lo, bỏ được ~80 dòng đo toạ độ
 * tự viết (kèm bug lệch khi zoom).
 *
 * BẪY PORTAL (đã dời xuống primitive 02/09/2026): Radix render content ra
 * <body>, ngoài wrapper `.theme-v3`. Trước đây RowMenu tự dò theme từ trigger;
 * nay `DropdownMenuContent` tự lo qua `usePortalTheme()`, nên chỗ này bỏ được
 * bản tự chế — một cơ chế, không phải hai.
 */
export function RowMenu({
  items,
  trigger,
  triggerClassName,
  ariaLabel,
}: {
  items: RowMenuItem[]
  /** Nội dung nút mở menu. Mặc định '⋯' — thẻ/card truyền icon riêng. */
  trigger?: React.ReactNode
  /** Thay class nút mở menu (không cộng dồn) — dùng khi nút nằm đè lên ảnh. */
  triggerClassName?: string
  /** Nhãn cho trình đọc màn hình. Trigger CÓ CHỮ thì phải truyền nhãn trùng chữ
   *  đó, không thì aria-label "Actions" đè lên và người dùng NVDA nghe sai nút. */
  ariaLabel?: string
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={ariaLabel ?? 'Actions'}
          className={
            triggerClassName ??
            'border-input hover:bg-accent hover:text-accent-foreground rounded-md border px-2 py-0.5 text-sm transition-colors'
          }
        >
          {trigger ?? '⋯'}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        {items.map((it, i) => (
          <DropdownMenuItem
            key={i}
            variant={it.danger ? 'destructive' : 'default'}
            disabled={it.disabled}
            title={it.disabled ? it.disabledReason : undefined}
            onClick={it.onClick}
          >
            {it.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
