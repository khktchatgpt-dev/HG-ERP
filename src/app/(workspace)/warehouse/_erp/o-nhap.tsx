'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { isoToVn, maskVnDate, vnToIso } from '@/lib/date-vn'

/**
 * Ô NHẬP CỦA KHU KHO (lối ERP, không kit — B2, 14/10/2026). Ba ô cho màn gõ
 * (Nhận hàng, Xuất kho…) + hộp thoại. Kiểu ở `kho.css` (`.kh-o`, `.kh-hop`).
 *
 * LUẬT CHỐT CHỮ: ô chữ / ô số giữ chữ RIÊNG trong lúc gõ, chỉ báo ra ngoài khi
 * rời ô hoặc Enter (`onCommit`) — để mỗi phím gõ không vẽ lại cả lưới. Màn nào
 * cần số mới nhất lúc Ctrl+Enter thì làm mờ ô đang đứng trước (blur → commit),
 * như `PhieuNhapScreen`.
 */

/** Giá trị từ ngoài đổi thì vẽ lại chữ — không giẫm lên tay người đang gõ. */
function useChuRieng(value: string) {
  const [text, setText] = useState(value)
  const [seen, setSeen] = useState(value)
  if (seen !== value) {
    setSeen(value)
    setText(value)
  }
  return [text, setText] as const
}

type ChungO = {
  id?: string
  value: string
  onCommit: (v: string) => void
  disabled?: boolean
  placeholder?: string
  /** Tên ô cho trình đọc màn hình (`aria-label`). */
  label: string
  title?: string
  /** `need` = bắt buộc mà còn trống (viền đỏ); `nen` = nên ghi (nền vàng nhạt). */
  tone?: 'need' | 'nen'
  className?: string
}

/** Ô chữ một dòng. */
export function OChu({
  id,
  value,
  onCommit,
  disabled,
  placeholder,
  label,
  title,
  tone,
  className,
  maxLength,
  mono,
  list,
}: ChungO & {
  maxLength?: number
  mono?: boolean
  /** id một `<datalist>` — gợi ý khi gõ. */
  list?: string
}) {
  const [text, setText] = useChuRieng(value)
  return (
    <input
      id={id}
      type="text"
      className={['kh-o', mono && 'mono', tone, className].filter(Boolean).join(' ')}
      value={text}
      disabled={disabled}
      placeholder={placeholder}
      maxLength={maxLength}
      list={list}
      aria-label={label}
      title={title}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => text !== value && onCommit(text)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && text !== value)
          onCommit(text)
      }}
    />
  )
}

/** Số kiểu VN: "1.390" = 1390 · "108,40" = 108,4. Trống / sai = 0. */
export const docSoVn = (v: string) => Number(v.replace(/\./g, '').replace(',', '.')) || 0
const vietSoVn = (v: string) => {
  const n = Number(v)
  return v === '' || !Number.isFinite(n)
    ? v
    : n.toLocaleString('vi-VN', { maximumFractionDigits: 4 })
}

/** Ô số canh phải, hiểu số kiểu VN; vào ô là chọn hết chữ (gõ đè nhanh). */
export function OSo({
  id,
  value,
  onCommit,
  disabled,
  placeholder,
  label,
  title,
  tone,
}: ChungO) {
  const [text, setText] = useChuRieng(vietSoVn(value))
  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      className={['kh-o num', tone].filter(Boolean).join(' ')}
      value={text}
      disabled={disabled}
      placeholder={placeholder}
      aria-label={label}
      title={title}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => text !== vietSoVn(value) && onCommit(text)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) onCommit(text)
      }}
    />
  )
}

/**
 * Ô ngày dd/mm/yyyy — gõ "141026" thành 14/10/2026 (`maskVnDate`, cùng luật với
 * ô ngày của kit). Báo ISO ngay khi chữ thành một ngày CÓ THẬT; gõ dở rồi rời ô
 * thì trả về ngày đang giữ.
 */
export function ONgay({
  value,
  onChange,
  disabled,
  label,
  tone,
}: {
  /** ISO yyyy-mm-dd, hoặc ''. */
  value: string
  onChange: (iso: string) => void
  disabled?: boolean
  label: string
  tone?: 'need'
}) {
  const [text, setText] = useState(() => isoToVn(value))
  const [seen, setSeen] = useState(value)
  if (seen !== value) {
    setSeen(value)
    if (vnToIso(text) !== (value || null)) setText(isoToVn(value))
  }
  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      maxLength={10}
      placeholder="dd/mm/yyyy"
      className={['kh-o num', tone].filter(Boolean).join(' ')}
      aria-label={label}
      disabled={disabled}
      value={text}
      onChange={(e) => {
        const next = maskVnDate(e.target.value)
        setText(next)
        const iso = vnToIso(next)
        if (iso) onChange(iso)
        else if (next === '') onChange('')
      }}
      onBlur={() => {
        if (!vnToIso(text) && text !== '') setText(isoToVn(value))
      }}
    />
  )
}

/** Câu nhắc nhỏ ngay dưới ô (thiếu, vượt, vào khoá…). Có `onClick` thì bấm được. */
export function GoiY({
  children,
  tone = 'mut',
  onClick,
  title,
  label,
}: {
  children: ReactNode
  tone?: 'mut' | 'warn' | 'stop'
  onClick?: () => void
  title?: string
  /** Tên đọc màn hình khi chữ hiện không đủ phân biệt giữa các dòng (vd. "điền đủ 80"). */
  label?: string
}) {
  return onClick ? (
    <button
      type="button"
      className={`kh-hint ${tone} bam`}
      onClick={onClick}
      title={title}
      aria-label={label}
    >
      {children}
    </button>
  ) : (
    <span className={`kh-hint ${tone}`} title={title}>
      {children}
    </span>
  )
}

/**
 * HỘP THOẠI của Kho — nổi giữa màn, nền mờ, Esc / ✕ đóng, con trỏ vào ô đầu
 * tiên (hoặc nút đầu tiên) khi mở. Phẳng, viền mảnh, không bo góc.
 */
export function HopThoai({
  title,
  subtitle,
  onClose,
  footer,
  children,
  width = 520,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  footer?: ReactNode
  children: ReactNode
  width?: number
}) {
  const hop = useRef<HTMLDivElement>(null)
  // onClose thường là hàm viết tại chỗ — giữ bản mới nhất trong ref để effect chỉ chạy lúc mở.
  const dong = useRef(onClose)
  useEffect(() => {
    dong.current = onClose
  })
  useEffect(() => {
    const el = hop.current
    const dau =
      el?.querySelector<HTMLElement>('.than input, .than textarea, .than select') ??
      el?.querySelector<HTMLElement>('.chan button')
    dau?.focus()
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && dong.current()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [])
  return (
    <div
      className="kh-hop-nen"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      /*
        Ctrl+Enter gõ TRONG hộp không được nổi lên màn sau lưng (vá 26/10/2026):
        màn gõ bắt Ctrl+Enter = Ghi sổ, nên gõ mô tả sự cố rồi Ctrl+Enter từng ghi
        luôn phiếu nhập của lô đang định từ chối. Chỉ chặn đúng tổ hợp đó — Esc
        đóng hộp đi qua listener trên window, chặn hết phím là hỏng Esc.
      */
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') e.stopPropagation()
      }}
    >
      <div
        ref={hop}
        className="kh-hop"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ width: `min(${width}px, calc(100vw - 32px))` }}
      >
        <div className="dau">
          <div>
            <b>{title}</b>
            {subtitle && <span>{subtitle}</span>}
          </div>
          <button type="button" className="dong" onClick={onClose} aria-label="Đóng">
            ✕
          </button>
        </div>
        <div className="than">{children}</div>
        {footer && <div className="chan">{footer}</div>}
      </div>
    </div>
  )
}
