'use client'

import { useEffect, useState } from 'react'
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
 * CUỘN THÌ BÁM THEO Ô, KHÔNG TỰ TẮT (04/09/2026) — khi chỗ gọi truyền `anchorEl`.
 *
 * Bản đầu đóng popover ở mọi sự kiện `scroll`, lý do ghi là "toạ độ fixed tính
 * một lần lúc mở, bám theo sẽ trôi lệch". Đúng về kỹ thuật, sai về cách người
 * ta dùng: ở form soạn đơn, ô tìm nằm giữa một trang dài, nên thao tác tự nhiên
 * "gõ → liếc xuống bảng xem đã có món này chưa → chọn" bị cắt ngang, danh sách
 * biến mất giữa chừng. Chỉ cần ĐO LẠI vị trí ô mỗi lượt cuộn là hết trôi.
 *
 * Không truyền `anchorEl` thì giữ nguyên nết cũ (đóng khi cuộn), để hai chỗ gọi
 * sẵn có không đổi hành vi ngoài ý muốn.
 */
export function AnchoredPopover({
  anchor,
  anchorEl,
  onClose,
  width,
  maxHeight = 320,
  children,
}: {
  /** Vị trí ô kích hoạt, lấy bằng `getBoundingClientRect()` lúc mở. */
  anchor: DOMRect
  /**
   * Chính phần tử neo. Có thì popover bám theo lúc cuộn/đổi cỡ; không có thì
   * đóng lại như bản cũ.
   */
  anchorEl?: HTMLElement | null
  onClose: () => void
  width?: number
  maxHeight?: number
  children: React.ReactNode
}) {
  const [rect, setRect] = useState<DOMRect>(anchor)

  useEffect(() => {
    if (!anchorEl) {
      const close = () => onClose()
      // `true` = bắt cả cuộn của khung con (bảng), không chỉ cuộn trang.
      window.addEventListener('scroll', close, true)
      window.addEventListener('resize', close)
      return () => {
        window.removeEventListener('scroll', close, true)
        window.removeEventListener('resize', close)
      }
    }

    let raf = 0
    const follow = () => {
      cancelAnimationFrame(raf)
      // Gộp vào một khung hình: cuộn bắn hàng chục sự kiện mỗi giây, đo lại
      // `getBoundingClientRect()` từng cái là ép trình duyệt tính lại bố cục
      // liên tục và trang giật.
      raf = requestAnimationFrame(() => {
        const r = anchorEl.getBoundingClientRect()
        // Ô đã cuộn khuất hẳn khỏi màn hình thì danh sách neo vào hư không —
        // lúc đó đóng mới đúng.
        if (r.bottom < 0 || r.top > window.innerHeight) return onClose()
        setRect(r)
      })
    }
    window.addEventListener('scroll', follow, true)
    window.addEventListener('resize', follow)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', follow, true)
      window.removeEventListener('resize', follow)
    }
  }, [anchorEl, onClose])

  if (typeof document === 'undefined') return null

  const w = width ?? rect.width
  // Gần đáy màn hình thì bung LÊN — bảng dài, dòng cuối luôn sát mép dưới.
  const spaceBelow = window.innerHeight - rect.bottom
  const up = spaceBelow < Math.min(maxHeight, 220)
  const style: React.CSSProperties = {
    position: 'fixed',
    left: Math.max(8, Math.min(rect.left, window.innerWidth - w - 8)),
    width: w,
    maxHeight,
    ...(up
      ? { bottom: Math.max(8, window.innerHeight - rect.top + 4) }
      : { top: rect.bottom + 4 }),
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
