'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Spinner } from '@/components/ui/Spinner'

type Notif = {
  id: string
  type: string
  task_id: string | null
  payload: { title?: string } | null
  read_at: string | null
  created_at: string
}

const TYPE_LABEL: Record<string, string> = {
  assigned: 'đã giao cho bạn',
  reassigned: 'đã chuyển công việc',
  status_changed: 'đã đổi trạng thái',
  submitted: 'đã báo hoàn thành',
  approved: 'đã duyệt',
  rejected: 'đã trả lại',
  commented: 'đã bình luận',
  due_soon: 'sắp đến hạn',
  overdue: 'đã quá hạn',
  lsx_submitted: 'gửi LSX chờ duyệt',
  lsx_approved: 'đã duyệt LSX',
  lsx_rejected: 'đã từ chối LSX',
  order_changed: 'đã sửa đơn sau khi phát LSX',
  order_cancelled: 'đã huỷ đơn hàng',
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'vừa xong'
  if (m < 60) return `${m} phút trước`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} giờ trước`
  return `${Math.floor(h / 24)} ngày trước`
}

export function NotificationsDropdown({ initialUnread }: { initialUnread: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<Notif[]>([])
  const [unread, setUnread] = useState(initialUnread)
  const ref = useRef<HTMLDivElement>(null)

  // close on outside-click
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  async function fetchLatest() {
    setLoading(true)
    try {
      const res = await fetch('/api/notifications')
      if (res.ok) {
        const json = await res.json()
        setItems(json.notifications.slice(0, 8))
        setUnread(json.unread)
      }
    } finally {
      setLoading(false)
    }
  }

  function toggle() {
    const next = !open
    setOpen(next)
    if (next && items.length === 0) void fetchLatest()
  }

  async function markAllRead() {
    await fetch('/api/notifications', { method: 'POST' })
    setUnread(0)
    setItems((arr) =>
      arr.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })),
    )
    router.refresh()
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={toggle}
        aria-label="Thông báo"
        aria-expanded={open}
        className="relative grid h-9 w-9 place-items-center rounded-md text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
      >
        <span className="text-lg leading-none">🔔</span>
        {unread > 0 && (
          <span className="absolute top-1 right-1 grid h-4 min-w-4 place-items-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-slate-900">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full right-0 z-50 mt-1 w-80 overflow-hidden rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
          <header className="flex items-center justify-between border-b border-zinc-100 px-3 py-2 dark:border-zinc-900">
            <h3 className="text-sm font-semibold">Thông báo</h3>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-zinc-500 underline hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                Đánh dấu đã đọc
              </button>
            )}
          </header>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner />
            </div>
          ) : items.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-zinc-500">
              Chưa có thông báo nào.
            </p>
          ) : (
            <ul className="max-h-96 divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-900">
              {items.map((n) => {
                const title = n.payload?.title
                return (
                  <li
                    key={n.id}
                    className={
                      n.read_at ? 'opacity-60' : 'bg-amber-50/40 dark:bg-amber-950/10'
                    }
                  >
                    <Link
                      href={n.task_id ? `/tasks/${n.task_id}` : '/notifications'}
                      onClick={() => setOpen(false)}
                      className="block px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                    >
                      <div className="text-sm">
                        <span className="font-medium">
                          {TYPE_LABEL[n.type] ?? n.type}
                        </span>
                        {title && <span className="text-zinc-500"> — {title}</span>}
                      </div>
                      <time className="text-xs text-zinc-500">
                        {timeAgo(n.created_at)}
                      </time>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}

          <footer className="border-t border-zinc-100 dark:border-zinc-900">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-center text-xs text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Xem tất cả
            </Link>
          </footer>
        </div>
      )}
    </div>
  )
}
