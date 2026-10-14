'use client'

import './kho.css'
import Link from 'next/link'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/**
 * KHUNG CHUNG CỦA KHU KHO — lối ERP, viết tay, không kit (B1, bản vẽ
 * https://claude.ai/artifact/F2uVKzc4tb28FhHZY6BDiR, duyệt 14/10/2026).
 *
 * Sáu tầng, trên xuống: `DauTrang` (+ Action Pane) · `TabNgang` · `ThanhLoc` ·
 * `ODem` (chỉ màn nhiều rổ chéo nhau) · lưới (`kh-grid` > `table.kh-tb`) ·
 * `ThanhTT`. Kiểu ở `kho.css`. Đồ riêng của Kho: phòng khác không import.
 */

/**
 * Gốc của một màn Kho. Huỷ đệm của `<main>` (shell không `bare`) và CHỐT CHIỀU
 * CAO = 100dvh − đỉnh màn, để chỉ lưới cuộn — đầu trang, tab, lọc, thanh trạng
 * thái đứng yên (cùng cách Hộp ký).
 */
export function KhoKhung({ children, label }: { children: ReactNode; label?: string }) {
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
      className="kh -m-4 sm:-mx-6 sm:-my-6"
      style={{ height: cao }}
      aria-label={label}
    >
      {children}
    </div>
  )
}

/** Tầng 1 — "Kho ›" + tên màn + một dòng ngữ cảnh + Action Pane góc phải. */
export function DauTrang({
  crumb = 'Kho',
  title,
  ctx,
  actions,
}: {
  crumb?: ReactNode
  title: ReactNode
  /** Một dòng ngữ cảnh cạnh tên — KHÔNG lặp số đã có ở tab / ô đếm. */
  ctx?: ReactNode
  /** Các `ApNhom` — nhóm thao tác dòng trước, nhóm mở màn khác sau. */
  actions?: ReactNode
}) {
  return (
    <div className="kh-ph">
      <span className="crumb">{crumb} ›</span>
      <h1>{title}</h1>
      {ctx && <span className="ctx">{ctx}</span>}
      {actions && (
        <div className="kh-ap" role="toolbar" aria-label="Thao tác">
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
 * Một nút của Action Pane. `why` = vì sao đang khoá (thường "Chọn một dòng
 * trước") — nút vẫn nhìn thấy, mờ, nói lý do ở tooltip + tên đọc màn hình.
 */
export function ApNut({
  children,
  href,
  onClick,
  primary = false,
  why,
  icon,
}: {
  children: ReactNode
  href?: string
  onClick?: () => void
  primary?: boolean
  why?: string | null
  icon?: ReactNode
}) {
  const cls = primary ? 'kh-btn p' : 'kh-btn'
  if (why)
    return (
      <span className={cls} aria-disabled="true" role="button" title={why} tabIndex={0}>
        {icon}
        {children}
      </span>
    )
  if (href)
    return (
      <Link href={href} className={cls}>
        {icon}
        {children}
      </Link>
    )
  return (
    <button type="button" className={cls} onClick={onClick}>
      {icon}
      {children}
    </button>
  )
}

export type TabMuc = {
  key: string
  label: ReactNode
  on: boolean
  /** Đường dẫn (tab đổi URL) hoặc hàm (tab trong màn). */
  href?: string
  onClick?: () => void
  /** Số trên tab — đúng số dòng bấm vào thấy. */
  n?: number
  /** `red` = việc trễ / thiếu; `warn` = việc chờ; `mut` = số thường. */
  tone?: 'red' | 'warn' | 'mut'
  /** Chữ đỏ nhỏ sau số ("39 thiếu cho lệnh") — ẩn ở khung hẹp. */
  note?: string
  /** Lớp màu vạch trên (`c-nhap`, `c-stop`…). */
  mau?: string
}

/** Tầng 2 — tab ngang có số. */
export function TabNgang({ tabs, label }: { tabs: TabMuc[]; label: string }) {
  return (
    <div className="kh-tabs" role="tablist" aria-label={label}>
      {tabs.map((t) => {
        const bd =
          t.n === undefined ? null : (
            <span
              className={`kh-bd ${t.n === 0 ? 'zero' : (t.tone ?? 'mut')}`}
              aria-hidden
            >
              {t.n.toLocaleString('vi-VN')}
            </span>
          )
        const inner = (
          <>
            {t.label}
            {bd}
            {t.note && <span className="note">{t.note}</span>}
          </>
        )
        const cls = `kh-tab ${t.mau ?? ''}`
        const aria = t.n === undefined ? undefined : `${textOf(t.label)} — ${t.n}`
        return t.href ? (
          <Link
            key={t.key}
            href={t.href}
            role="tab"
            aria-selected={t.on}
            aria-label={aria}
            className={cls}
            scroll={false}
          >
            {inner}
          </Link>
        ) : (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={t.on}
            aria-label={aria}
            className={cls}
            onClick={t.onClick}
          >
            {inner}
          </button>
        )
      })}
    </div>
  )
}

const textOf = (n: ReactNode) => (typeof n === 'string' ? n : '')

/** Tầng 3 — thanh lọc: ô tìm, hộp lọc, Xếp. Con tự sắp. */
export function ThanhLoc({ children }: { children: ReactNode }) {
  return <div className="kh-fb">{children}</div>
}

export type ODemMuc = {
  key: string
  t: string
  n: number
  s?: string
  mau: string
  on: boolean
  onClick: () => void
}

/** Tầng 4 — ô đếm vuông làm rổ lọc. Chỉ dùng khi các rổ chéo nhau (Tồn kho). */
export function ODem({ items, label }: { items: ODemMuc[]; label: string }) {
  return (
    <div className="kh-tiles" role="group" aria-label={label}>
      {items.map((i) => (
        <button
          key={i.key}
          type="button"
          className={`kh-tile ${i.mau}${i.n === 0 ? 'zero' : ''}`}
          aria-pressed={i.on}
          onClick={i.onClick}
          title={i.s}
        >
          <span className="t">{i.t}</span>
          <span className="n">{i.n.toLocaleString('vi-VN')}</span>
          <span className="s">{i.s ?? ' '}</span>
        </button>
      ))}
    </div>
  )
}

/** Tầng 6 — thanh trạng thái: ký hiệu, phím tắt bên trái; số dòng + trang bên phải. */
export function ThanhTT({ left, right }: { left: ReactNode; right?: ReactNode }) {
  return (
    <div className="kh-sb">
      <span>{left}</span>
      {right && <span className="r">{right}</span>}
    </div>
  )
}

/** Phân trang gọn trong thanh trạng thái. */
export function PhanTrang({
  trang,
  soTrang,
  onDoi,
}: {
  trang: number
  soTrang: number
  onDoi: (t: number) => void
}) {
  if (soTrang <= 1) return null
  const ds = trangHien(trang, soTrang)
  return (
    <span className="r" role="navigation" aria-label="Trang">
      <button
        type="button"
        className="kh-pg"
        disabled={trang <= 1}
        onClick={() => onDoi(trang - 1)}
        aria-label="Trang trước"
      >
        ‹
      </button>
      {ds.map((t, i) =>
        t === 0 ? (
          <span key={`g${i}`}>…</span>
        ) : (
          <button
            key={t}
            type="button"
            className="kh-pg"
            aria-current={t === trang ? 'page' : undefined}
            onClick={() => onDoi(t)}
          >
            {t}
          </button>
        ),
      )}
      <button
        type="button"
        className="kh-pg"
        disabled={trang >= soTrang}
        onClick={() => onDoi(trang + 1)}
        aria-label="Trang sau"
      >
        ›
      </button>
    </span>
  )
}

/** Số trang hiện: đầu, cuối, quanh trang đang đứng; 0 = dấu "…". */
export function trangHien(trang: number, soTrang: number): number[] {
  const set = new Set([1, soTrang, trang - 1, trang, trang + 1])
  const ds = [...set].filter((t) => t >= 1 && t <= soTrang).sort((a, b) => a - b)
  const out: number[] = []
  for (const t of ds) {
    if (out.length && t - out[out.length - 1] > 1) out.push(0)
    out.push(t)
  }
  return out
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
    <div className="kh-rong">
      <b>{tieuDe}</b>
      <p>{lyDo}</p>
      {tiep}
    </div>
  )
}

/** Số kiểu VN; 0 hiện "·" nhạt (số 0 không phải lúc nào cũng xấu — đừng tô đỏ). */
export function So({ n, tone }: { n: number; tone?: 'warn' | 'stop' | 'ok' | 'b' }) {
  if (Math.abs(n) < 1e-9) return <span className="kh-empty">·</span>
  const cls =
    tone === 'warn'
      ? 'kh-warn'
      : tone === 'stop'
        ? 'kh-stop'
        : tone === 'ok'
          ? 'kh-ok'
          : tone === 'b'
            ? 'kh-b'
            : undefined
  return (
    <span className={cls}>{n.toLocaleString('vi-VN', { maximumFractionDigits: 3 })}</span>
  )
}
