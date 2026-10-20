'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'

/**
 * KHỐI GIAO DIỆN ERP CỦA KHU MUA HÀNG — KHÔNG DÙNG KIT (12/10/2026).
 *
 * Chủ dự án: "ko dùng kit hiện tại" khi so màn Hạng mục / ô Cho việc / ô Thuế
 * với bản vẽ Đầu đơn mua (artifact H3bGKgpz…). Khối ở đây chép đúng CSS bản vẽ:
 * ERP phẳng kiểu Dynamics — thanh đầu trang + công cụ góc phải, dải ô số ngăn
 * vạch mảnh, bảng tiêu đề nền xám + chân tổng dính, nhãn góc vuông, không bóng
 * đổ hay thẻ bo to. Chỉ Tailwind + biến màu của khu (`--act`, `--hair`, `--ink-*`
 * …, khai ở kit/tokens.css và phủ cả khu Mua hàng) — không import component kit.
 */

export type Tone = 'stop' | 'warn' | 'done' | 'run' | 'neutral'

/** Ô tiêu đề cột. */
export const TH =
  'sticky top-0 z-[1] border-b border-[var(--line)] bg-[var(--surface-raised)] px-2.5 py-1.5 text-left text-[11px] font-bold uppercase tracking-[.04em] text-[var(--ink-2)] whitespace-nowrap'
/** Ô dữ liệu. */
export const TD = 'border-b border-[var(--hair)] px-2.5 py-1.5 align-middle text-[13px]'
/** Số: mono, căn phải, chữ số đều cột. */
export const NUM = 'text-right font-mono tabular-nums whitespace-nowrap'
/** Ô chân bảng (dính đáy). */
export const TF =
  'sticky bottom-0 z-[1] border-t border-[var(--line)] bg-[var(--surface-raised)] px-2.5 py-1.5 text-[13px] font-semibold'

const MAU_NHAN: Record<Tone, string> = {
  stop: 'bg-[var(--stop-wash)] text-[var(--stop)]',
  warn: 'bg-[var(--warn-wash)] text-[var(--warn)]',
  done: 'bg-[var(--done-wash)] text-[var(--done)]',
  run: 'bg-[var(--act-wash)] text-[var(--act-text)]',
  neutral: 'bg-[#eceff3] text-[var(--ink-2)]',
}

/** Nhãn tình trạng — góc vuông nhỏ, màu theo nghĩa vòng đời. Chỉ để đọc. */
export function Nhan({
  tone = 'neutral',
  children,
  title,
}: {
  tone?: Tone
  children: ReactNode
  title?: string
}) {
  // prettier-ignore
  return (
    <span title={title} className={`inline-block rounded-[3px] px-[7px] py-[2px] text-[11.5px] font-semibold whitespace-nowrap ${MAU_NHAN[tone]}`}>
      {children}
    </span>
  )
}

/** Khung trang: cao trọn vùng nội dung, cuộn bên trong (để đầu/chân bảng dính được). */
export function Trang({ children }: { children: ReactNode }) {
  return <div className="flex h-full min-h-0 flex-1 flex-col bg-[var(--surface)] text-[13px] text-[var(--ink)]">{children}</div> // prettier-ignore
}

/** Thanh đầu trang: dòng nhỏ · tiêu đề · nhãn — công cụ GÓC PHẢI; dưới là dòng dữ kiện. */
export function DauTrang({
  eyebrow,
  title,
  status,
  actions,
  facts,
}: {
  eyebrow: ReactNode
  title: ReactNode
  status?: ReactNode
  actions?: ReactNode
  /** Dòng dữ kiện chữ: nhãn nhỏ viết hoa trên, giá trị dưới, ngăn vạch dọc. */
  facts?: { k: string; v: ReactNode; tone?: 'warn' }[]
}) {
  return (
    <div className="border-b border-[var(--line)] bg-[var(--surface)]">
      <div className="flex flex-wrap items-center gap-2.5 px-4 pt-2.5 pb-1.5">
        <span className="text-[11px] font-bold tracking-[.06em] text-[var(--ink-3)] uppercase">
          {eyebrow}
        </span>
        <span className="text-[16px] font-bold">{title}</span>
        {status}
        {actions && (
          <span className="ml-auto flex flex-wrap items-center gap-1.5">{actions}</span>
        )}
      </div>
      {facts && facts.length > 0 && (
        <div className="flex flex-wrap px-4 pb-2.5 text-[12.5px]">
          {facts.map((f, i) => (
            <span
              key={f.k}
              className={i === 0 ? 'pr-3.5' : 'border-l border-[var(--line)] px-3.5'}
            >
              <span className="block text-[10.5px] font-bold tracking-[.05em] text-[var(--ink-3)] uppercase">
                {f.k}
              </span>
              <span
                className={`font-semibold ${f.tone === 'warn' ? 'text-[var(--warn)]' : ''}`}
              >
                {f.v}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

const NUT =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-[3px] border px-3 py-[7px] text-[12.5px] font-semibold leading-none'

/**
 * Nút. `chinh` = nút chính (nền đặc màu hành động). `khoa` = lý do bị khoá —
 * nút xám đặc, bấm vào HIỆN lý do ngay dưới thanh (không giấu trong tooltip).
 * `href` → link.
 */
export function Nut({
  children,
  chinh,
  khoa,
  href,
  onClick,
  busy,
  title,
}: {
  children: ReactNode
  chinh?: boolean
  khoa?: string
  href?: string
  onClick?: () => void
  busy?: boolean
  title?: string
}) {
  const [noi, setNoi] = useState(false)
  const cls = khoa
    ? `${NUT} cursor-not-allowed border-[#d3d8df] bg-[#e3e6eb] text-[#4a5260]`
    : chinh
      ? `${NUT} border-[var(--act)] bg-[var(--act)] text-white hover:brightness-110`
      : `${NUT} border-[var(--line)] bg-[var(--surface-card)] text-[var(--ink)] hover:border-[var(--act)]`
  if (href && !khoa)
    return (
      <Link href={href} className={cls} title={title}>
        {children}
      </Link>
    )
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        className={cls}
        title={khoa ?? title}
        aria-disabled={khoa ? true : undefined}
        disabled={busy}
        onClick={() => (khoa ? setNoi((x) => !x) : onClick?.())}
      >
        {busy ? '…' : children}
      </button>
      {khoa && noi && (
        <span
          role="status"
          className="absolute top-full right-0 z-10 mt-1 w-max max-w-[280px] border border-[var(--warn-line)] bg-[var(--warn-wash)] px-2 py-1 text-[12px] text-[var(--warn)]"
        >
          {khoa}
        </span>
      )}
    </span>
  )
}

/** Menu "⋯" — các việc phụ, góc phải. Đóng khi bấm ra ngoài / Esc. */
export function MenuBa({
  items,
}: {
  items: { label: string; onClick: () => void; khoa?: string }[]
}) {
  const [mo, setMo] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!mo) return
    const off = (e: MouseEvent) =>
      !ref.current?.contains(e.target as Node) && setMo(false)
    const esc = (e: KeyboardEvent) =>
      e.key === 'Escape' && (e.stopPropagation(), setMo(false))
    document.addEventListener('mousedown', off)
    document.addEventListener('keydown', esc, true)
    return () => {
      document.removeEventListener('mousedown', off)
      document.removeEventListener('keydown', esc, true)
    }
  }, [mo])
  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button"
        aria-label="Việc khác"
        aria-expanded={mo}
        className={`${NUT} border-[var(--line)] bg-[var(--surface-card)] px-2.5`}
        onClick={() => setMo((x) => !x)}
      >
        {' '}
        ⋯
      </button>
      {mo && (
        <span
          role="menu"
          className="absolute top-full right-0 z-20 mt-1 min-w-[200px] border border-[var(--line)] bg-[var(--surface-card)] py-1 shadow-[0_6px_18px_rgba(15,20,28,.12)]"
        >
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              title={it.khoa}
              disabled={!!it.khoa}
              className="block w-full px-3 py-1.5 text-left text-[13px] hover:bg-[var(--act-wash)] disabled:cursor-not-allowed disabled:text-[var(--ink-3)]"
              onClick={() => (setMo(false), it.onClick())}
            >
              {it.label}
              {it.khoa && <span className="block text-[11px]">{it.khoa}</span>}
            </button>
          ))}
        </span>
      )}
    </span>
  )
}

/** Hàng công cụ lọc dưới đầu trang. */
export function HangLoc({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2 border-b border-[var(--hair)] bg-[var(--surface-card)] px-4 py-2 text-[12px] text-[var(--ink-2)]">{children}</div> // prettier-ignore
}

/** Chip lọc: viền gạch khi tắt, nền nhạt màu hành động khi bật. */
export function ChipLoc({
  on,
  count,
  onClick,
  children,
}: {
  on: boolean
  count?: number
  onClick: () => void
  children: ReactNode
}) {
  // prettier-ignore
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-[3px] border px-2.5 py-[5px] text-[12px] font-semibold whitespace-nowrap ${on ? 'border-[var(--act-line)] bg-[var(--act-wash)] text-[var(--act-text)]' : 'border-dashed border-[var(--line)] bg-[var(--surface-raised)] text-[var(--ink-2)]'}`} // prettier-ignore
    >
      {children}
      {count != null && <span className="font-mono">· {count}</span>}
    </button>
  )
}

/** Ô chọn gốc (select), vuông — nhãn đứng trước giá trị: "Loại: tất cả ▾". */
export function ChonLoc({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  // prettier-ignore
  return (
    <label className="inline-flex items-center gap-1 rounded-[3px] border border-[var(--line)] bg-[var(--surface-card)] px-2 py-[3px] text-[12px] font-semibold">
      <span className="text-[var(--ink-3)]">{label}:</span>
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="bg-transparent font-semibold outline-none">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

/** Thanh tỉ lệ (dữ liệu, không bấm được). Từ ngưỡng `canh` trở lên tô màu cảnh báo. */
export function Thanh({ pct, canh = 90 }: { pct: number; canh?: number }) {
  return (
    <span className="block h-1.5 w-full bg-[#e3e7ee]" aria-hidden>
      <span
        className="block h-full"
        style={{
          width: `${Math.max(0, Math.min(pct, 100))}%`,
          background: pct >= canh ? 'var(--warn)' : 'var(--act)',
        }}
      />{' '}
    </span>
  )
}

/** Dải ô số — một hàng, ngăn vạch mảnh. */
export function DaiSo({ children, cot = 5 }: { children: ReactNode; cot?: number }) {
  return (
    <div
      className="grid border-b border-[var(--line)] bg-[var(--surface-card)]"
      style={{ gridTemplateColumns: `repeat(${cot}, minmax(0, 1fr))` }}
    >
      {' '}
      {children}
    </div>
  )
}

/** Ô số: nhãn · giá trị · dòng mẫu số (bắt buộc — số không có mẫu số là số không kiểm được). */
export function OSo({
  k,
  v,
  sub,
  tone,
  thanh,
}: {
  k: string
  v: ReactNode
  sub: ReactNode
  tone?: 'warn' | 'stop'
  thanh?: number
}) {
  // prettier-ignore
  return (
    <div className="grid gap-0.5 border-r border-[var(--hair)] px-4 py-2.5 last:border-r-0">
      <span className="text-[10.5px] font-bold uppercase tracking-[.05em] text-[var(--ink-3)]">{k}</span>
      <span className={`font-mono text-[17px] font-bold tabular-nums ${tone === 'warn' ? 'text-[var(--warn)]' : tone === 'stop' ? 'text-[var(--stop)]' : ''}`}>{v}</span>
      <span className="text-[11.5px] text-[var(--ink-3)]">{sub}</span>
      {thanh != null && <span className="mt-1"><Thanh pct={thanh} /></span>}
    </div>
  )
}

/** Thanh trạng thái đáy trang. */
export function ThanhDuoi({ left, right }: { left: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex gap-3.5 border-t border-[var(--line)] bg-[var(--surface)] px-4 py-1.5 text-[11.5px] text-[var(--ink-3)]">
      <span className="flex flex-wrap gap-3.5">{left}</span>
      {right && <span className="ml-auto">{right}</span>}
    </div>
  )
}

/**
 * Hộp thoại nổi (chép "sheet" của bản vẽ): thanh tên · thân · chân Thôi/Lưu.
 * Esc đóng và KHÔNG lọt ra trang (màn soạn đơn dùng Esc làm phím Huỷ).
 */
export function HopThoai({
  title,
  aside,
  onClose,
  footer,
  children,
  width = 520,
}: {
  title: string
  aside?: ReactNode
  onClose: () => void
  footer: ReactNode
  children: ReactNode
  width?: number
}) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    document.addEventListener('keydown', esc, true)
    return () => document.removeEventListener('keydown', esc, true)
  }, [onClose])
  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-[rgba(15,20,28,.28)] pt-[12vh]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      {' '}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-w-[calc(100vw-32px)] border border-[var(--line)] bg-[var(--surface-card)] text-[13px] text-[var(--ink)] shadow-[0_8px_24px_rgba(15,20,28,.14)]"
        style={{ width }}
      >
        <div className="flex items-center border-b border-[var(--hair)] px-3.5 py-2.5 font-bold">
          {title}
          {aside && (
            <span className="ml-auto font-medium text-[var(--ink-3)]">{aside}</span>
          )}
        </div>
        <div className="grid gap-2.5 px-3.5 py-3">{children}</div>
        <div className="flex items-center justify-end gap-2 border-t border-[var(--hair)] bg-[var(--surface-raised)] px-3.5 py-2.5">
          {footer}
        </div>
      </div>
    </div>
  )
}

/** Một ô trong hộp thoại: nhãn hoa nhỏ trên, ô dưới, dòng giúp nhạt. */
export function O({
  label,
  help,
  children,
}: {
  label: string
  help?: ReactNode
  children: ReactNode
}) {
  // prettier-ignore
  return (
    <div className="grid gap-1">
      <span className="text-[11px] font-bold uppercase tracking-[.04em] text-[var(--ink-2)]">{label}</span>
      {children}
      {help && <span className="text-[11.5px] text-[var(--ink-3)]">{help}</span>}
    </div>
  )
}

/** Lớp của ô gõ trong hộp thoại. */
export const INPUT =
  'w-full rounded-[3px] border border-[var(--line)] bg-[var(--surface-card)] px-2.5 py-[7px] text-[13px] outline-none focus:border-[var(--act)] focus:shadow-[0_0_0_2px_var(--act-line)]'
