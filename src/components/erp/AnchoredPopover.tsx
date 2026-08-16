'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'

/**
 * Danh sách thả xuống NEO theo ô kích hoạt nhưng VẼ Ở `document.body`.
 *
 * Vì sao không dùng `absolute` như thường: bảng dòng hàng của form soạn đơn nằm
 * trong khung `overflow-x-auto` (bảng rộng hơn màn hình). Khung cuộn cắt cụt mọi
 * thứ tràn ra — kết quả tìm vật tư và danh sách mã SP bị che mất phần dưới, đúng
 * chỗ người dùng cần bấm. CSS không cho `overflow-x: auto` đi kèm
 * `overflow-y: visible` (trình duyệt ép về auto), nên phải đưa danh sách ra ngoài
 * khung bằng portal + `position: fixed`.
 *
 * Cuộn trang hoặc đổi cỡ cửa sổ thì ĐÓNG lại, không cố bám theo: toạ độ fixed
 * tính một lần lúc mở, bám theo sẽ trôi lệch khỏi ô.
 */
export function AnchoredPopover({
  anchor,
  onClose,
  width,
  maxHeight = 320,
  children,
}: {
  /** Vị trí ô kích hoạt, lấy bằng `getBoundingClientRect()` lúc mở. */
  anchor: DOMRect
  onClose: () => void
  width?: number
  maxHeight?: number
  children: React.ReactNode
}) {
  useEffect(() => {
    const close = () => onClose()
    // `true` = bắt cả cuộn của khung con (bảng), không chỉ cuộn trang.
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [onClose])

  if (typeof document === 'undefined') return null

  const w = width ?? anchor.width
  // Gần đáy màn hình thì bung LÊN — bảng dài, dòng cuối luôn sát mép dưới.
  const spaceBelow = window.innerHeight - anchor.bottom
  const up = spaceBelow < Math.min(maxHeight, 220)
  const style: React.CSSProperties = {
    position: 'fixed',
    left: Math.max(8, Math.min(anchor.left, window.innerWidth - w - 8)),
    width: w,
    maxHeight,
    ...(up
      ? { bottom: Math.max(8, window.innerHeight - anchor.top + 4) }
      : { top: anchor.bottom + 4 }),
  }

  return createPortal(
    <>
      {/* Bấm ra ngoài để đóng — nằm dưới danh sách nên không nuốt cú bấm chọn. */}
      <div className="fixed inset-0 z-[60]" onPointerDown={onClose} />
      <div
        data-anchored-popover=""
        style={style}
        // Token thay zinc gõ cứng. Popover portal ra <body> ngoài wrapper theme,
        // nhưng --popover/--border ở :root đều là trắng/xám sáng — khớp mọi theme.
        className="bg-popover text-popover-foreground z-[61] overflow-y-auto rounded-md border shadow-lg"
      >
        {children}
      </div>
    </>,
    document.body,
  )
}
