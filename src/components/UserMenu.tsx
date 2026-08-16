'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell, LogOut, UserRound } from 'lucide-react'
import { Avatar } from '@/components/Avatar'

/**
 * Menu người dùng trên topbar — theo thiết kế v3 (/design-lab mục 02): nút mở
 * chỉ là AVATAR TRÒN (tên/vai nằm trong dropdown), không còn cụm tên + caret
 * chiếm chỗ. Dropdown ăn token nên khớp theme ở mọi shell.
 */
export function UserMenu({
  user,
  avatarUrl,
}: {
  user: { name: string | null; email: string; role: string; title: string | null }
  /** URL ký của ảnh đại diện (server resolve, xem `accountService.avatarUrl`). */
  avatarUrl?: string | null
}) {
  const [open, setOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await fetch('/api/logout', { method: 'POST' })
    } catch {
      /* vẫn điều hướng về login dù API lỗi — cookie xoá server-side là chính */
    }
    // Điều hướng cứng: server (proxy) đánh giá lại phiên + xoá cache client.
    window.location.href = '/login'
  }

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const roleLabel =
    (
      { admin: 'Quản trị', manager: 'Quản lý', employee: 'Nhân viên' } as Record<
        string,
        string
      >
    )[user.role] ?? user.role

  const itemCls =
    'hover:bg-accent hover:text-accent-foreground flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Tài khoản — ${user.name ?? user.email}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className="grid place-items-center rounded-full transition-shadow hover:ring-2 hover:ring-[var(--primary)]/30"
      >
        <Avatar name={user.name} email={user.email} size="sm" src={avatarUrl} />
      </button>

      {open && (
        <div className="bg-popover text-popover-foreground absolute top-full right-0 z-50 mt-1.5 w-60 overflow-hidden rounded-lg border shadow-md">
          <div className="border-b px-3 py-2.5">
            <div className="truncate text-[13px] font-semibold">{user.name ?? '—'}</div>
            <div className="text-muted-foreground truncate text-xs">{user.email}</div>
            <div className="text-muted-foreground mt-1.5 inline-block rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-medium tracking-wide text-[var(--accent-foreground)] uppercase">
              {user.title ?? roleLabel}
            </div>
          </div>
          <Link href="/tai-khoan" className={itemCls} onClick={() => setOpen(false)}>
            <UserRound className="size-4" strokeWidth={1.8} /> Tài khoản của tôi
          </Link>
          <Link href="/notifications" className={itemCls} onClick={() => setOpen(false)}>
            <Bell className="size-4" strokeWidth={1.8} /> Thông báo
          </Link>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex w-full items-center gap-2.5 border-t px-3 py-2 text-left text-[13px] text-[var(--stop)] transition-colors hover:bg-[color-mix(in_srgb,var(--stop)_8%,transparent)] disabled:opacity-60"
          >
            <LogOut className="size-4" strokeWidth={1.8} />
            {loggingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
          </button>
        </div>
      )}
    </div>
  )
}
