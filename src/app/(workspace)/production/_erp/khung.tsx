'use client'

import './sx.css'
import Link from 'next/link'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/**
 * KHUNG CHUNG CỦA KHU SẢN XUẤT — lối ERP, viết tay, không kit (B1 cấu hình
 * công đoạn, bản vẽ https://claude.ai/artifact/4VNmsX9hoLFmgic9AGrCci, duyệt
 * 03/11/2026). Cùng cách `warehouse/_erp/khung.tsx` nhưng là đồ riêng của Sản
 * xuất: phòng khác không import, Sản xuất không import của Kho.
 *
 * Tầng: `DauTrang` (+ Action Pane) · `TabNgang` · lưới / vùng thân · `ThanhTT`.
 * Kiểu ở `sx.css`.
 */

/**
 * Gốc của một màn. Huỷ đệm của `<main>` (shell không `bare`) và CHỐT CHIỀU CAO
 * = 100dvh − đỉnh màn, để chỉ vùng thân cuộn — đầu trang, tab, thanh trạng
 * thái đứng yên.
 */
export function SxKhung({
  children,
  label,
  bare = false,
}: {
  children: ReactNode
  label?: string
  /**
   * true = vỏ đã `bare` (nhóm route `(san-xuat)`): `<main>` không đệm nên KHÔNG
   * trừ lề. Chiều cao vẫn phải tự chốt bằng đo đỉnh — `<main>` bare là khối
   * `overflow: auto` chứ không phải cột flex, `flex: 1` trong đó vô nghĩa (đo
   * 03/11: màn cao 3.100px, cuộn cả trang, đầu/chân dính vô hiệu).
   */
  bare?: boolean
}) {
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
    <div
      ref={goc}
      className={bare ? 'sx' : 'sx -m-4 sm:-mx-6 sm:-my-6'}
      style={{ height: cao }}
      aria-label={label}
    >
      {children}
    </div>
  )
}

/** Tầng 1 — "Sản xuất ›" + tên màn + một dòng ngữ cảnh + Action Pane góc phải. */
export function DauTrang({
  crumb = 'Sản xuất',
  title,
  ctx,
  actions,
}: {
  crumb?: ReactNode
  title: ReactNode
  /** Một dòng ngữ cảnh cạnh tên — KHÔNG lặp số đã có ở tab / thanh trạng thái. */
  ctx?: ReactNode
  /** Các `ApNhom` — nhóm thao tác dòng trước, nhóm mở màn khác sau, nút chính cuối. */
  actions?: ReactNode
}) {
  return (
    <div className="sx-ph">
      <span className="crumb">{crumb} ›</span>
      <h1>{title}</h1>
      {ctx && <span className="ctx">{ctx}</span>}
      {actions && (
        <div className="sx-ap" role="toolbar" aria-label="Thao tác">
          {actions}
        </div>
      )}
    </div>
  )
}

export function ApNhom({ children }: { children: ReactNode }) {
  return <div>{children}</div>
}

/**
 * Một nút của Action Pane. `why` = vì sao đang khoá — nút vẫn nhìn thấy, mờ,
 * nói lý do NGAY CẠNH (không giấu trong tooltip) và trong tên đọc màn hình.
 */
export function ApNut({
  children,
  href,
  onClick,
  primary = false,
  why,
  busy = false,
}: {
  children: ReactNode
  href?: string
  onClick?: () => void
  primary?: boolean
  why?: string | null
  busy?: boolean
}) {
  const cls = primary ? 'sx-btn p' : 'sx-btn'
  if (why)
    return (
      <>
        <span className={cls} aria-disabled="true" role="button" tabIndex={0}>
          {children}
        </span>
        <span className="sx-why">{why}</span>
      </>
    )
  if (href)
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    )
  return (
    <button type="button" className={cls} onClick={onClick} aria-busy={busy || undefined}>
      {busy ? 'Đang lưu…' : children}
    </button>
  )
}

export type TabMuc = {
  key: string
  label: ReactNode
  on: boolean
  n?: number
  onClick: () => void
}

/** Tầng 2 — tab ngang có số (số = đúng số dòng bấm vào thấy). */
export function TabNgang({ tabs, label }: { tabs: TabMuc[]; label: string }) {
  return (
    <div className="sx-tabs" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={t.on}
          className="sx-tab"
          onClick={t.onClick}
        >
          {t.label}
          {t.n !== undefined && <span className="n">{t.n.toLocaleString('vi-VN')}</span>}
        </button>
      ))}
    </div>
  )
}

/** Tầng cuối — thanh trạng thái: tổng kết bên trái, ngữ cảnh kỹ thuật bên phải. */
export function ThanhTT({ left, right }: { left: ReactNode; right?: ReactNode }) {
  return (
    <div className="sx-sb">
      <span>{left}</span>
      {right && <span className="r">{right}</span>}
    </div>
  )
}

/** Rỗng: nói lý do và việc làm tiếp. */
export function Rong({
  tieuDe,
  lyDo,
  tiep,
}: {
  tieuDe: string
  lyDo: string
  tiep?: ReactNode
}) {
  return (
    <div className="sx-rong">
      <b>{tieuDe}</b>
      <p>{lyDo}</p>
      {tiep}
    </div>
  )
}
