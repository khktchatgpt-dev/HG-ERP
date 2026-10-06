'use client'

import Link from 'next/link'
import type { ComponentType, ReactNode } from 'react'

/**
 * KHỐI GIAO DIỆN ERP CHUNG CỦA KHU BÁN HÀNG (06/10/2026).
 *
 * Chủ dự án: "thiên hướng UI/UX ERP", "đừng phụ thuộc quá vào bộ kit", "design-lab
 * không dùng nữa". Kiểu chép Dynamics 365 / SAP Fiori: thanh đầu trang + công cụ
 * góc phải, ô đếm vuông ngăn vạch mảnh, khung có thanh tiêu đề, lưới có tiêu đề
 * cột nền xám + chân tổng, nhãn tình trạng góc vuông, thanh trạng thái đáy.
 * Không thẻ bo tròn to, không bóng đổ. Chỉ Tailwind + token theme v3 (shell khu
 * Bán hàng đang phủ `.theme-v3`). Dùng chung cho Trang chủ, Kế hoạch xuất hàng,
 * Phân tích doanh số — để ba màn nói cùng một thứ tiếng.
 */

export type Tone = 'stop' | 'warn' | 'done' | 'neutral'

/** Ô tiêu đề cột của lưới. */
export const TH =
  'h-8 border-b border-border bg-muted px-3 text-left text-xs font-semibold whitespace-nowrap text-muted-foreground'
/** Ô dữ liệu của lưới. */
export const TD = 'h-9 border-b border-border px-3 align-middle text-[13px]'
/** Số: mono, căn phải, chữ số đều cột. */
export const NUM = 'text-right font-mono tabular-nums whitespace-nowrap'

export const SO_MAU: Record<Tone, string> = {
  stop: 'text-[var(--stop)]',
  warn: 'text-[var(--warn)]',
  done: 'text-[var(--done)]',
  neutral: 'text-foreground',
}

/** Khung trang tràn mép (bù padding của shell), cao tối thiểu trọn khung nhìn. */
export function ErpPage({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background -m-6 flex min-h-[calc(100dvh-3.5rem)] flex-col">
      {children}
    </div>
  )
}

/** Thanh đầu trang: đường dẫn · tên màn · dòng phụ — thanh công cụ ở GÓC PHẢI. */
export function ErpHeader({
  crumb,
  title,
  sub,
  actions,
}: {
  crumb: { label: string; href?: string }[]
  title: string
  sub?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="border-border bg-card flex flex-wrap items-center justify-between gap-3 border-b px-6 py-3">
      <div className="min-w-0">
        <div className="text-muted-foreground text-xs">
          {crumb.map((c, i) => (
            <span key={c.label}>
              {i > 0 && <span className="mx-1">›</span>}
              {c.href ? (
                <Link
                  href={c.href}
                  className="hover:text-[var(--primary)] hover:underline"
                >
                  {c.label}
                </Link>
              ) : (
                c.label
              )}
            </span>
          ))}
        </div>
        <h1 className="text-foreground text-[17px] leading-6 font-semibold">
          {title}
          {sub && (
            <span className="text-muted-foreground ml-2 text-[13px] font-normal">
              {sub}
            </span>
          )}
        </h1>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/** Nút thanh công cụ — `href` thì là link, không thì là nút. Góc vuông nhỏ. */
export function ToolBtn({
  href,
  onClick,
  icon: Icon,
  primary,
  children,
}: {
  href?: string
  onClick?: () => void
  icon?: ComponentType<{ className?: string; strokeWidth?: number }>
  primary?: boolean
  children: ReactNode
}) {
  const cls = `inline-flex h-8 items-center gap-1.5 rounded-sm px-3 text-[13px] whitespace-nowrap ${
    primary
      ? 'bg-[var(--primary)] font-medium text-[var(--primary-foreground)] hover:opacity-90'
      : 'border border-border bg-card text-foreground hover:bg-muted'
  }`
  const inner = (
    <>
      {Icon && <Icon className="h-4 w-4" strokeWidth={1.8} />}
      {children}
    </>
  )
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  )
}

/** Dải ô đếm: một hàng, ngăn vạch mảnh. */
export function CountStrip({ children }: { children: ReactNode }) {
  return (
    <div className="border-border bg-card flex overflow-x-auto border-b">{children}</div>
  )
}

/**
 * Ô đếm. `onClick` → nút chọn (gạch trên màu chính khi `on`); `href` → link;
 * không có cả hai → ô chỉ đọc. `value` null = chưa đo được (in chữ, không in 0).
 */
export function CountCell({
  label,
  value,
  sub,
  tone = 'neutral',
  on,
  onClick,
  href,
  title,
  width = 'min-w-[150px] flex-1 basis-0',
}: {
  label: string
  value: ReactNode | null
  sub?: ReactNode
  tone?: Tone
  on?: boolean
  onClick?: () => void
  href?: string
  title?: string
  width?: string
}) {
  const cls = `${width} border-t-2 border-r border-r-border px-4 py-2.5 text-left transition-colors ${
    on ? 'border-t-[var(--primary)] bg-[var(--accent)]' : 'border-t-transparent'
  } ${onClick || href ? 'hover:bg-muted' : ''}`
  const body = (
    <>
      <span className="text-muted-foreground block text-xs leading-4">{label}</span>
      {value == null ? (
        <span className="text-muted-foreground mt-1 block text-[13px] italic">
          chưa đo được
        </span>
      ) : (
        <span
          className={`block font-mono text-[20px] leading-7 font-semibold tabular-nums ${SO_MAU[tone]}`}
        >
          {value}
        </span>
      )}
      {sub && (
        <span className="text-muted-foreground block text-xs leading-4">{sub}</span>
      )}
    </>
  )
  if (onClick)
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={on}
        title={title}
        className={cls}
      >
        {body}
      </button>
    )
  if (href)
    return (
      <Link href={href} title={title} className={cls}>
        {body}
      </Link>
    )
  return (
    <div title={title} className={cls}>
      {body}
    </div>
  )
}

/** Hàng lọc dưới dải ô đếm. */
export function FilterRow({ children }: { children: ReactNode }) {
  return (
    <div className="border-border bg-card flex flex-wrap items-center gap-3 border-b px-6 py-2">
      {children}
    </div>
  )
}

/** Nút chọn liền khối (segmented) — đổi cách xem / chiều phân tích. */
export function Seg<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; count?: number }[]
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground text-xs">{label}</span>
      <div
        role="radiogroup"
        aria-label={label}
        className="border-border inline-flex overflow-hidden rounded-sm border"
      >
        {options.map((o, i) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={`h-7 px-3 text-[13px] whitespace-nowrap ${i > 0 ? 'border-border border-l' : ''} ${
              value === o.value
                ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                : 'bg-card text-foreground hover:bg-muted'
            }`}
          >
            {o.label}
            {o.count != null && (
              <span className="ml-1.5 font-mono text-xs tabular-nums opacity-75">
                {o.count}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Ô chọn kiểu ERP (select gốc, vuông, nhãn trái). */
export function Chon({
  label,
  value,
  onChange,
  options,
  width = 200,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  width?: number
}) {
  return (
    <label className="text-muted-foreground flex items-center gap-2 text-xs">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width }}
        className="border-border bg-card text-foreground h-7 rounded-sm border px-2 text-[13px] focus:border-[var(--primary)] focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

/** Công tắc lọc dạng ô tick. */
export function Tick({
  checked,
  onChange,
  children,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  children: ReactNode
}) {
  return (
    <label className="text-foreground flex cursor-pointer items-center gap-1.5 text-[13px] select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 accent-[var(--primary)]"
      />
      {children}
    </label>
  )
}

/** Khung có thanh tiêu đề (tên · số · ghi chú · việc bên phải) — chứa một lưới. */
export function Panel({
  title,
  count,
  note,
  actions,
  children,
  label,
}: {
  title: ReactNode
  count?: ReactNode
  note?: ReactNode
  actions?: ReactNode
  children: ReactNode
  label?: string
}) {
  return (
    <section
      aria-label={label}
      className="border-border bg-card min-w-0 self-start rounded-sm border"
    >
      <div className="border-border flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
        <div className="min-w-0">
          <h2 className="text-foreground text-[14px] font-semibold">
            {title}
            {count != null && (
              <span className="text-muted-foreground ml-2 font-mono tabular-nums">
                {count}
              </span>
            )}
          </h2>
          {note && <p className="text-muted-foreground text-xs">{note}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  )
}

/** Nhãn tình trạng: góc vuông nhỏ, viền mảnh, màu theo nghĩa vòng đời. */
export function Nhan({ tone, children }: { tone: Tone; children: ReactNode }) {
  const cls =
    tone === 'stop'
      ? 'border-[var(--stop)]/30 bg-[var(--stop)]/10 text-[var(--stop)]'
      : tone === 'warn'
        ? 'border-[var(--warn)]/30 bg-[var(--warn)]/10 text-[var(--warn)]'
        : tone === 'done'
          ? 'border-[var(--done)]/30 bg-[var(--done)]/10 text-[var(--done)]'
          : 'border-border bg-muted text-muted-foreground'
  return (
    <span
      className={`inline-flex items-center rounded-sm border px-1.5 text-[11px] leading-[18px] font-medium whitespace-nowrap ${cls}`}
    >
      {children}
    </span>
  )
}

/** Thanh tỉ lệ trong ô lưới (dữ liệu, không bấm được). */
export function Thanh({
  ratio,
  label,
  tone,
  width = 96,
}: {
  ratio: number
  label: string
  tone?: 'done'
  width?: number
}) {
  const r = Math.max(0, Math.min(1, ratio))
  return (
    <span className="flex items-center justify-end gap-2" title={label}>
      <span aria-hidden className="bg-muted h-1.5 shrink-0" style={{ width }}>
        <span
          className={`block h-full ${tone === 'done' ? 'bg-[var(--done)]' : 'bg-[var(--primary)]/70'}`}
          style={{ width: `${r * 100}%` }}
        />
      </span>
      <span className="text-foreground w-[44px] text-right font-mono text-xs tabular-nums">
        {label}
      </span>
    </span>
  )
}

/** Thanh trạng thái đáy trang. */
export function ErpStatusBar({ left, right }: { left: ReactNode; right?: ReactNode }) {
  return (
    <div className="border-border bg-card text-muted-foreground mt-auto flex flex-wrap items-center justify-between gap-2 border-t px-6 py-1.5 text-xs">
      <span>{left}</span>
      {right && <span>{right}</span>}
    </div>
  )
}
