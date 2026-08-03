'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'

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
        className={`flex max-h-[calc(100dvh-2rem)] w-full ${maxWidth} flex-col rounded-t-xl bg-white shadow-xl sm:rounded-xl dark:bg-zinc-950`}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Đóng"
            className="rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white"
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
