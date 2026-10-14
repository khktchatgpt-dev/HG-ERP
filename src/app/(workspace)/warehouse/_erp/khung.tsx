'use client'

import './kho.css'
import Link from 'next/link'
import {
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'

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
export function KhoKhung({
  children,
  label,
  onKeyDown,
}: {
  children: ReactNode
  label?: string
  /** Phím tắt cả màn (Ctrl+Enter ghi sổ ở màn gõ). */
  onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void
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
      className="kh -m-4 sm:-mx-6 sm:-my-6"
      style={{ height: cao }}
      aria-label={label}
      onKeyDown={onKeyDown}
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

/**
 * Dải "ĐÃ GHI SỔ" của Kho — sau khi ghi phiếu, có nút In (thủ kho in ngay đưa
 * người giao / tổ ký; toast tự tắt trước khi họ với tới chuột).
 */
export function DaGhiSo({
  code,
  docId,
  detail,
  soPhieuHref,
  onClose,
}: {
  code: string
  docId: string
  detail: string
  soPhieuHref: string
  onClose: () => void
}) {
  return (
    <div className="kh-note ok" role="status">
      <span className="tag">Đã ghi sổ</span>
      <span>
        <b className="kh-num">{code}</b> · {detail}
      </span>
      <Link href={`/print/warehouse/${docId}`} className="kh-btn">
        In phiếu
      </Link>
      <Link href={soPhieuHref} className="kh-btn">
        Xem ở sổ phiếu
      </Link>
      <button type="button" className="kh-btn dong" onClick={onClose}>
        Đóng
      </button>
    </div>
  )
}

export type MenuMuc = {
  label: string
  onClick?: () => void
  href?: string
  /** Vì sao khoá — mục vẫn hiện, mờ, nói lý do. */
  why?: string | null
  /** Việc không lùi được (đảo phiếu) — chữ đỏ, tách vạch. */
  nguy?: boolean
}

/**
 * Nút thả xuống của Action Pane ("Sửa phiếu ▾"). Mục khoá vẫn hiện kèm lý do —
 * không giấu việc người dùng đang tìm. Esc / bấm ra ngoài là đóng.
 */
export function MenuNut({ label, items }: { label: string; items: MenuMuc[] }) {
  const [mo, setMo] = useState(false)
  const goc = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (!mo) return
    const ngoai = (e: MouseEvent) => {
      if (!goc.current?.contains(e.target as Node)) setMo(false)
    }
    const esc = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && setMo(false)
    document.addEventListener('mousedown', ngoai)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', ngoai)
      document.removeEventListener('keydown', esc)
    }
  }, [mo])
  return (
    <div ref={goc} className="kh-menu">
      <button
        type="button"
        className="kh-btn"
        aria-haspopup="menu"
        aria-expanded={mo}
        onClick={() => setMo(!mo)}
      >
        {label} ▾
      </button>
      {mo && (
        <div role="menu" className="kh-menu-ds">
          {items.map((m) => {
            const cls = m.nguy ? 'nguy' : undefined
            if (m.why)
              return (
                <span
                  key={m.label}
                  role="menuitem"
                  aria-disabled="true"
                  className={cls}
                  title={m.why}
                >
                  {m.label}
                  <small>{m.why}</small>
                </span>
              )
            return m.href ? (
              <Link key={m.label} role="menuitem" href={m.href} className={cls}>
                {m.label}
              </Link>
            ) : (
              <button
                key={m.label}
                type="button"
                role="menuitem"
                className={cls}
                onClick={() => {
                  setMo(false)
                  m.onClick?.()
                }}
              >
                {m.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export type MocTg = {
  key: string
  /** ISO; null = mốc chưa tới (mờ). */
  at: string | null
  label: string
  actor?: string | null
  detail?: string | null
  tone?: 'act' | 'done' | 'warn' | 'stop'
}

const ngayGio = (at: string) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(at)) return `${at.slice(8, 10)}/${at.slice(5, 7)}`
  const d = new Date(at)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** DÒNG THỜI GIAN của chứng từ — mốc chưa tới vẫn hiện, mờ (thấy còn mấy bước). */
export function DongThoiGian({ marks }: { marks: MocTg[] }) {
  return (
    <ol className="kh-tl">
      {marks.map((m) => (
        <li key={m.key} className={m.at ? `roi ${m.tone ?? 'act'}` : 'chua'}>
          <span className="nhan">{m.label}</span>
          <span className="kh-num kh-mut"> {m.at ? ngayGio(m.at) : 'chưa tới'}</span>
          {m.actor && m.at && <span> · {m.actor}</span>}
          {m.detail && m.at && <p>{m.detail}</p>}
        </li>
      ))}
    </ol>
  )
}
