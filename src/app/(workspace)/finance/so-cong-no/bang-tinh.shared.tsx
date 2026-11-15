'use client'

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import './bang-tinh.css'

const digits = (cur: string) => (cur === 'VND' ? 0 : 2)
export const money = (n: number, cur = 'VND') =>
  n.toLocaleString('vi-VN', { maximumFractionDigits: digits(cur) })
export const qtyFmt = (n: number) =>
  n.toLocaleString('vi-VN', { maximumFractionDigits: 3 })
export const dmy = (d: string) => d.split('-').reverse().join('/')
/** `2026-10` → `10/2026`. */
export const mm = (month: string) => `${month.slice(5, 7)}/${month.slice(0, 4)}`

/**
 * Khung màn: tự chốt chiều cao bằng phần còn lại của cửa sổ để bảng cuộn TRONG
 * khung — đầu cột và dòng tổng mới dính được. Cùng cách `KhoKhung` của khu Kho.
 */
export function Khung({ children }: { children: ReactNode }) {
  const goc = useRef<HTMLDivElement>(null)
  const [cao, setCao] = useState('calc(100dvh - 60px)')
  useLayoutEffect(() => {
    const el = goc.current
    if (!el) return
    const doi = () =>
      setCao(`calc(100dvh - ${Math.round(el.getBoundingClientRect().top)}px)`)
    doi()
    window.addEventListener('resize', doi)
    return () => window.removeEventListener('resize', doi)
  }, [])
  return (
    <div ref={goc} className="bt bt -m-4 sm:-mx-6 sm:-my-6" style={{ height: cao }}>
      {children}
    </div>
  )
}
