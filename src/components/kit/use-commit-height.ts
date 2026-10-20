'use client'

import { useEffect, useRef } from 'react'

/**
 * KHAY THÔNG BÁO KHÔNG ĐƯỢC ĐÈ THANH CHỐT ĐÁY (29/09/2026).
 *
 * Toast góc dưới phải từng che đúng nút "Tạo đơn" của `CommitBar` vài giây.
 * Thanh khai chiều cao của nó vào `--k-commit-h` trên `<html>`; `.k-toasts`
 * (erp.css) đứng cách đáy chừng đó. Đo bằng ResizeObserver vì thanh bẻ dòng
 * khi hẹp — một hằng số đoán sẵn sẽ lệch. Gỡ thanh thì trả biến về trống.
 */
export function useCommitHeight<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    const root = document.documentElement
    if (!el) return
    const ro = new ResizeObserver(() =>
      root.style.setProperty('--k-commit-h', `${el.offsetHeight}px`),
    )
    ro.observe(el)
    return () => {
      ro.disconnect()
      root.style.removeProperty('--k-commit-h')
    }
  }, [])
  return ref
}
