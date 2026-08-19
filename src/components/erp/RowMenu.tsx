'use client'

import { useRef, useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/shadcn/dropdown-menu'
import { cn } from '@/lib/utils'

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
 * BẪY PORTAL: Radix render content ra <body>, NGOÀI wrapper `.theme-v2/.theme-v3`
 * nên token theme không phủ tới. Fix tự động: lúc mở, dò class theme gần nhất
 * từ nút trigger (`closest`) rồi gắn lại vào content — component gọi không phải
 * quan tâm gì.
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
  const btnRef = useRef<HTMLButtonElement>(null)
  const [themeClass, setThemeClass] = useState<string | undefined>(undefined)

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (!open) return
        const themed = btnRef.current?.closest('.theme-v3, .theme-v2')
        setThemeClass(
          themed?.classList.contains('theme-v3')
            ? 'theme-v3'
            : themed?.classList.contains('theme-v2')
              ? 'theme-v2'
              : undefined,
        )
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          ref={btnRef}
          aria-label={ariaLabel ?? 'Actions'}
          className={
            triggerClassName ??
            'border-input hover:bg-accent hover:text-accent-foreground rounded-md border px-2 py-0.5 text-sm transition-colors'
          }
        >
          {trigger ?? '⋯'}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={cn('min-w-40', themeClass)}>
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
