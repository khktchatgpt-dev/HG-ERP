'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Avatar } from '@/components/Avatar'

export function UserMenu({
  user,
}: {
  user: { name: string | null; email: string; role: string; title: string | null }
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
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const roleLabel =
    (
      { admin: 'Quản trị', manager: 'Quản lý', employee: 'Nhân viên' } as Record<
        string,
        string
      >
    )[user.role] ?? user.role

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-md p-1 pr-2 hover:bg-zinc-100 dark:hover:bg-zinc-900"
      >
        <Avatar name={user.name} email={user.email} size="sm" />
        <div className="hidden text-left text-xs sm:block">
          <div className="leading-tight font-medium">{user.name ?? user.email}</div>
          <div className="text-zinc-500">{user.title ?? roleLabel}</div>
        </div>
        <span className="text-xs text-zinc-500">▾</span>
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 w-56 overflow-hidden rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
          <div className="border-b border-zinc-100 px-3 py-2 text-xs dark:border-zinc-900">
            <div className="font-medium">{user.name ?? '—'}</div>
            <div className="text-zinc-500">{user.email}</div>
            <div className="mt-1 inline-block rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] tracking-wide uppercase dark:bg-zinc-800">
              {roleLabel}
            </div>
          </div>
          <Link
            href="/notifications"
            className="block px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
            onClick={() => setOpen(false)}
          >
            Thông báo
          </Link>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-60 dark:hover:bg-red-950/30"
          >
            {loggingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
          </button>
        </div>
      )}
    </div>
  )
}
