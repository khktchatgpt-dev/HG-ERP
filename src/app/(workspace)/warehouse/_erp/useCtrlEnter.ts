'use client'

import { useLayoutEffect, useRef, type KeyboardEvent } from 'react'

/**
 * Ctrl+Enter = Ghi sổ, kể cả khi con trỏ còn TRONG Ô (26/10/2026).
 *
 * Ô của khu Kho (`OSo`, `OChu`) chỉ chốt chữ lúc rời ô. Rời ô rồi gọi hàm ghi
 * của CHÍNH lần render này là ghi bằng state cũ: số vừa gõ ở ô đang đứng không
 * vào phiếu (dòng qty 0 còn bị lọc mất). Nên: rời ô trước, chờ state nhận chữ,
 * rồi gọi bản hàm ghi MỚI NHẤT qua ref — cùng cách màn Nhận hàng vá 04/10.
 *
 * Trả hàm `onKeyDown` gắn lên khung màn. `chan` = đang mở hộp thoại thì bỏ qua.
 */
export function useCtrlEnter(ghi: () => void, chan = false) {
  const moiNhat = useRef(ghi)
  useLayoutEffect(() => {
    moiNhat.current = ghi
  })
  return (e: KeyboardEvent) => {
    if (!(e.ctrlKey || e.metaKey) || e.key !== 'Enter') return
    e.preventDefault()
    if (chan) return
    ;(document.activeElement as HTMLElement | null)?.blur()
    setTimeout(() => moiNhat.current(), 0)
  }
}
