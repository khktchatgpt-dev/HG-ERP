'use client'

import { useLayoutEffect, useState, type RefObject } from 'react'

/**
 * BỀ RỘNG THẬT của một khung — để màn tự ẨN CỘT PHỤ khi hẹp thay vì cuộn ngang
 * (luật màn hẹp, Kho đợt 2 · Bước 2, duyệt 12/10/2026).
 *
 * Đo khung chứ không đo cửa sổ: cùng màn 1280px mà sidebar mở (212px) hay thu
 * gọn là hai bề rộng khác nhau — B1 từng "vừa 1280" khi soi lúc sidebar thu gọn,
 * mở sidebar ra là cuộn ngang 1053/1151.
 *
 * `macDinh` là bề rộng giả định trước lần đo đầu (server render) — chọn cỡ RỘNG
 * để lần vẽ đầu bày đủ cột, rồi co lại nếu khung hẹp.
 */
export function useBeRong(ref: RefObject<HTMLElement | null>, macDinh = 1200): number {
  const [rong, setRong] = useState(macDinh)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const tinh = () =>
      setRong((w) => (Math.abs(w - el.clientWidth) < 2 ? w : el.clientWidth))
    tinh()
    const ro = new ResizeObserver(tinh)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return rong
}
