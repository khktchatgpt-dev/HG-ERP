'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell } from 'lucide-react'
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
  quote_submitted: 'gửi báo giá chờ duyệt',
  quote_approved: 'đã duyệt báo giá',
  quote_rejected: 'đã từ chối báo giá',
  po_submitted: 'gửi đơn đặt chờ duyệt',
  po_approved: 'đã duyệt đơn đặt',
  po_rejected: 'đã từ chối đơn đặt',
  // 0155: po_withdrawn/po_reassigned trước đây bị constraint chặn im lặng —
  // giờ insert được thì phải có nhãn, khỏi hiện chuỗi thô.
  wh_doc_reversed: 'đã đảo phiếu kho ghi sai',
  wh_stocktake_pending: 'gửi biên bản kiểm kê chờ duyệt',
  wh_stocktake_approved: 'đã duyệt biên bản kiểm kê',
  wh_stocktake_rejected: 'đã từ chối biên bản kiểm kê',
  po_withdrawn: 'đã rút đơn đặt về nháp',
  po_reassigned: 'đã bàn giao đơn đặt',
  po_closed_short: 'đã chốt phần thiếu đơn đặt',
  po_late: 'đơn đặt quá hẹn giao',
  wh_receipt: 'hàng về — có phiếu nhập',
  wh_stock_low: 'tồn kho dưới mức tối thiểu',
  wh_return: 'trả hàng NCC',
  lsx_submitted: 'gửi LSX chờ duyệt',
  lsx_approved: 'đã duyệt LSX',
  lsx_rejected: 'đã từ chối LSX',
  order_changed: 'đã sửa đơn sau khi phát LSX',
  order_cancelled: 'đã huỷ đơn hàng',
  stage_handoff: 'bàn giao công đoạn',
  incident_reported: 'báo sự cố xưởng',
  incident_resolved: 'đã xử lý sự cố',
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
      {/* Chuông theo thiết kế v3: icon lucide + badge đếm màu --stop (đỏ). */}
      <button
        onClick={toggle}
        aria-label="Thông báo"
        aria-expanded={open}
        className="text-muted-foreground hover:bg-accent hover:text-accent-foreground relative grid h-9 w-9 place-items-center rounded-md transition-colors"
      >
        <Bell className="size-4.5" strokeWidth={1.8} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--stop)] px-1 font-mono text-[9.5px] leading-none font-bold text-white tabular-nums">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="bg-popover text-popover-foreground absolute top-full right-0 z-50 mt-1.5 w-80 overflow-hidden rounded-lg border shadow-md">
          <header className="flex items-center justify-between border-b px-3 py-2">
            <h3 className="text-sm font-semibold">Thông báo</h3>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="text-muted-foreground hover:text-foreground text-xs underline transition-colors"
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
            <p className="text-muted-foreground px-3 py-8 text-center text-xs">
              Chưa có thông báo nào.
            </p>
          ) : (
            <ul className="divide-border/60 max-h-96 divide-y overflow-y-auto">
              {items.map((n) => {
                const title = n.payload?.title
                return (
                  <li
                    key={n.id}
                    className={n.read_at ? 'opacity-60' : 'bg-[var(--accent)]/40'}
                  >
                    <Link
                      href={n.task_id ? `/tasks/${n.task_id}` : '/notifications'}
                      onClick={() => setOpen(false)}
                      className="hover:bg-accent block px-3 py-2 transition-colors"
                    >
                      <div className="text-sm">
                        <span className="font-medium">
                          {TYPE_LABEL[n.type] ?? n.type}
                        </span>
                        {title && (
                          <span className="text-muted-foreground"> — {title}</span>
                        )}
                      </div>
                      <time className="text-muted-foreground text-xs">
                        {timeAgo(n.created_at)}
                      </time>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}

          <footer className="border-t">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground block px-3 py-2 text-center text-xs underline transition-colors"
            >
              Xem tất cả
            </Link>
          </footer>
        </div>
      )}
    </div>
  )
}
