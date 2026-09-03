'use client'

import { useEffect } from 'react'

/**
 * CHẶN LĂN CHUỘT ĐỔI SỐ trên mọi `<input type="number">` của workspace.
 *
 * Trình duyệt coi lăn chuột trên ô số đang focus là "tăng/giảm một bậc". Ở
 * bảng nhập liệu dài (soạn đơn, kiểm kê, định mức) người dùng lăn để cuộn
 * trang, ô số đang focus âm thầm nhảy 12 → 9 và không ai thấy cho tới khi in.
 * Form soạn đơn đã tự vá từng ô (`blurOnWheel`), nhưng còn ~30 file khác mỗi
 * file vài ô — vá từng chỗ thì cái mới thêm lại quên.
 *
 * Một listener capture ở document: lăn chuột mà ô số đang focus nằm dưới con
 * trỏ → blur ô đó trước khi trình duyệt xử lý. Cuộn vẫn diễn ra bình thường,
 * chỉ ô số không ăn sự kiện. Ô kiểu text (`useNumberDraft`) không bị đụng.
 */
export function NumberWheelGuard() {
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      const el = document.activeElement
      if (
        el instanceof HTMLInputElement &&
        el.type === 'number' &&
        e.target instanceof Node &&
        el.contains(e.target)
      ) {
        el.blur()
      }
    }
    document.addEventListener('wheel', onWheel, { capture: true, passive: true })
    return () => document.removeEventListener('wheel', onWheel, { capture: true })
  }, [])
  return null
}
