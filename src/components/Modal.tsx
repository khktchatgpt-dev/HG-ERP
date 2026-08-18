'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'

/**
 * Hộp thoại điều khiển bằng prop `open` — GIỮ render inline (không portal):
 * nằm trong cây DOM của trang nên tự ăn token theme đang phủ (`theme-v2/v3`),
 * không dính bẫy Radix portal văng ra <body> mất theme. Style lấy từ token.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = 'sm:max-w-lg',
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  maxWidth?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      onClick={onClose}
    >
      {/*
        HỘP THOẠI PHẢI CUỘN ĐƯỢC, KHÔNG ĐƯỢC CAO HƠN MÀN HÌNH.

        Bản cũ để hộp cao tự do trong lúc `body` đã bị khoá cuộn (effect trên):
        form "Thêm vật tư" 16 ô đo được 1234px trên màn 768px — ô Tên vật tư nằm
        ở y=-141 và nút lưu ở y=941, cả hai đều ngoài màn và KHÔNG có cách nào
        cuộn tới. Nay: chiều cao trần theo `dvh` (dvh chứ không vh — thanh địa
        chỉ trình duyệt di động ăn mất phần chênh), tiêu đề ghim trên, chỉ phần
        thân cuộn.
      */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-card text-card-foreground flex max-h-[calc(100dvh-2rem)] w-full ${maxWidth} flex-col rounded-t-xl border shadow-lg sm:rounded-xl`}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b px-6 py-4">
          <h2 className="t-title">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Đóng"
            className="text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-md p-1 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>
        {/* `min-h-0` bắt buộc: thiếu nó thì flex item không co lại được và
            `overflow-y-auto` vô tác dụng — hộp lại tràn ra ngoài như cũ. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  )
}
