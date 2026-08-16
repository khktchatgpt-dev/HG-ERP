'use client'

import { Search } from 'lucide-react'

/**
 * Ô tìm trên topbar (thiết kế v3) — thực chất là NÚT mở CommandPalette (⌘K),
 * không phải input thật: gõ phím diễn ra trong palette. Vẽ như ô nhập để người
 * dùng nhận ra "chỗ này tìm được" mà không cần biết phím tắt.
 */
export function TopbarSearch() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event('hg:open-command-palette'))}
      aria-label="Tìm kiếm (Ctrl+K)"
      className="border-input bg-background text-muted-foreground hover:border-ring/50 hidden h-8 w-56 items-center gap-2 rounded-lg border px-2.5 text-left text-[12.5px] transition-colors md:flex lg:w-64"
    >
      <Search className="size-4 shrink-0" strokeWidth={1.8} />
      <span className="min-w-0 flex-1 truncate">Tìm nhanh, đi tới trang…</span>
      <kbd className="border-border rounded border px-1 font-mono text-[10px]">⌘K</kbd>
    </button>
  )
}
