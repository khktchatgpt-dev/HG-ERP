'use client'

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import './cong-no.css'

export const digits = (cur: string) => (cur === 'VND' ? 0 : 2)
export const money = (n: number, cur: string) =>
  n.toLocaleString('vi-VN', { maximumFractionDigits: digits(cur) })
export const qtyFmt = (n: number) =>
  n.toLocaleString('vi-VN', { maximumFractionDigits: 3 })
export const dmy = (d: string) => d.split('-').reverse().join('/')
export const monthLabel = (m: string) => {
  const [y, mm] = m.split('-')
  return `tháng ${Number(mm)}/${y}`
}

/**
 * Khung màn: tự chốt chiều cao bằng phần còn lại của cửa sổ để lưới cuộn TRONG
 * khung — đầu cột và dòng tổng mới dính được (cha cao theo nội dung thì không
 * có gì để dính). Cùng cách `KhoKhung` của khu Kho, bản riêng của Tài chính.
 */
export function CnKhung({ children }: { children: ReactNode }) {
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
    <div ref={goc} className="cn cn -m-4 sm:-mx-6 sm:-my-6" style={{ height: cao }}>
      {children}
    </div>
  )
}

/** Nhóm nút bật/tắt một lựa chọn — số đếm đi kèm để không lọc mù. */
export function Seg<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string; count?: number }[]
  onChange: (v: T) => void
}) {
  return (
    <span className="cn-seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
          {o.count != null && (
            <span className="cn-n">{o.count.toLocaleString('vi-VN')}</span>
          )}
        </button>
      ))}
    </span>
  )
}
