'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  FileText,
  Package,
  ScrollText,
  type LucideIcon,
} from 'lucide-react'
import { DateField } from '@/components/erp/DateField'
import { SupplierPicker } from '@/components/supply/SupplierPicker'
import { PO_CURRENCIES } from '@/lib/po-line'
import { PO_TEMPLATES, poTemplateMeta, type PoTemplate } from '@/lib/po-template'

/**
 * THANH CHIP ĐẦU ĐƠN — gộp ba khối của màn cũ về MỘT dòng.
 *
 * Màn cũ (`../new`) có `ContextStrip` (dính đầu, chỉ ĐỌC) + `TemplatePicker` +
 * card "Bối cảnh đơn": ba khối, ~220px chiều dọc, và cùng nói lại một bộ thông
 * tin — thanh ngữ cảnh nhắc lại đúng mẫu/LSX/NCC vừa nhập ngay bên dưới nó.
 *
 * Ở đây mỗi chip vừa HIỆN giá trị vừa SỬA được tại chỗ, nên không còn phần lặp.
 * Chip bỏ trống mang viền `--stop` — nhìn thanh là biết còn thiếu gì.
 */
export type HeaderChipsProps = {
  template: PoTemplate
  onTemplate: (t: PoTemplate) => void
  lineCount: number

  poType: 'lsx' | 'standalone'
  onPoType: (t: 'lsx' | 'standalone') => void
  lsxId: string
  onLsx: (id: string) => void
  lsxs: { id: string; code: string; order_codes: string[]; customer_name: string }[]
  extraLsxIds: string[]
  onToggleExtraLsx: (id: string, on: boolean) => void

  supplierId: string
  onSupplier: (id: string) => void
  suppliers: {
    id: string
    name: string
    rating: string | null
    lead_time_days: number | null
    payment_terms: string | null
  }[]

  expectedAt: string
  onExpectedAt: (v: string) => void
  contractNo: string
  onContractNo: (v: string) => void
  currency: string
  onCurrency: (v: string) => void

  /** Lý do chưa lưu được — hiện ở mép phải thanh, nói ĐÚNG MỘT LẦN cho cả form. */
  problem: string | null
  lineReady: number
}

const field =
  'border-input bg-card h-9 w-full rounded-lg border px-2.5 text-[13px] shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'
/** Nhãn TRƯỜNG trong popover — cùng một mức đậm với tiêu đề cột của bảng. */
const label = 't-label text-foreground font-bold'

export function HeaderChips(p: HeaderChipsProps) {
  const [open, setOpen] = useState<string | null>(null)
  const meta = poTemplateMeta(p.template)
  const lsx = p.lsxs.find((l) => l.id === p.lsxId)
  const supplier = p.suppliers.find((s) => s.id === p.supplierId)
  const extraCodes = p.extraLsxIds.map(
    (id) => p.lsxs.find((l) => l.id === id)?.code ?? '?',
  )
  const lsxLabel =
    p.poType === 'standalone'
      ? 'ngoài LSX'
      : lsx
        ? [lsx.code, ...extraCodes].join(' + ')
        : '— chưa chọn —'

  const toggle = (k: string) => setOpen(open === k ? null : k)

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-3 py-2">
      {/* ── MẪU ĐƠN: thứ quyết định cột nhập, công thức tiền, VAT, mẫu in ── */}
      <Chip
        icon={Package}
        name="Mẫu"
        value={meta.label}
        open={open === 'tpl'}
        onOpen={() => toggle('tpl')}
      >
        <div className="w-[440px] p-2">
          <div className="flex flex-wrap gap-1.5">
            {PO_TEMPLATES.map((t) => {
              const m = poTemplateMeta(t)
              const on = t === p.template
              return (
                <button
                  key={t}
                  type="button"
                  title={m.hint}
                  onClick={() => {
                    p.onTemplate(t)
                    setOpen(null)
                  }}
                  aria-pressed={on}
                  className={
                    'rounded-md border px-2.5 py-1.5 text-[13px] transition-colors ' +
                    (on
                      ? 'border-[var(--primary)] bg-[var(--accent)] font-semibold text-[var(--accent-foreground)]'
                      : 'border-input hover:bg-accent')
                  }
                >
                  {m.label}
                  {on && <Check className="ml-1 inline size-3" strokeWidth={3} />}
                </button>
              )
            })}
          </div>
          <p className="text-muted-foreground mt-2 text-[11.5px]">{meta.hint}</p>
          {p.lineCount > 0 && (
            <p className="mt-1 text-[11.5px] text-[var(--warn)]">
              Đổi mẫu giữ nguyên {p.lineCount} dòng — cột và cách tính tiền đổi theo mẫu
              mới, kiểm lại số trước khi gửi.
            </p>
          )}
        </div>
      </Chip>

      {/* ── LSX (kèm gộp lệnh phụ — 0125) ── */}
      <Chip
        icon={FileText}
        name="LSX"
        value={lsxLabel}
        mono
        missing={p.poType === 'lsx' && !p.lsxId}
        open={open === 'lsx'}
        onOpen={() => toggle('lsx')}
      >
        <div className="w-[340px] p-2">
          <div className="mb-2 flex gap-1">
            {(
              [
                ['lsx', 'Theo lệnh SX'],
                ['standalone', 'Ngoài LSX'],
              ] as const
            ).map(([v, t]) => (
              <button
                key={v}
                type="button"
                onClick={() => p.onPoType(v)}
                className={
                  'flex-1 rounded-md border px-2 py-1 text-[12.5px] transition-colors ' +
                  (p.poType === v
                    ? 'border-[var(--primary)] bg-[var(--accent)] font-semibold text-[var(--accent-foreground)]'
                    : 'border-input hover:bg-accent')
                }
              >
                {t}
              </button>
            ))}
          </div>
          {p.poType === 'lsx' && (
            <>
              <label className="grid gap-1">
                <span className={label}>Lệnh chính</span>
                <select
                  value={p.lsxId}
                  onChange={(e) => p.onLsx(e.target.value)}
                  className={field}
                >
                  <option value="">— chọn LSX đã duyệt —</option>
                  {p.lsxs.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.code} — {l.customer_name}
                    </option>
                  ))}
                </select>
              </label>
              {lsx && lsx.order_codes.length > 0 && (
                <p className="text-muted-foreground mt-1 text-[11.5px]">
                  Đơn hàng{' '}
                  <b className="t-data text-[11.5px]">{lsx.order_codes.join(', ')}</b>
                </p>
              )}
              {p.lsxId && (
                <div className="mt-2 grid gap-1">
                  <span className={label}>Gộp thêm lệnh (0125)</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {p.extraLsxIds.map((id) => (
                      <span
                        key={id}
                        className="border-input bg-muted t-data inline-flex items-center gap-1 rounded-full border py-0.5 pr-1 pl-2 text-[11px]"
                      >
                        {p.lsxs.find((l) => l.id === id)?.code ?? '?'}
                        <button
                          type="button"
                          onClick={() => p.onToggleExtraLsx(id, false)}
                          className="text-muted-foreground grid size-4 place-items-center rounded-full hover:text-[var(--stop)]"
                          aria-label="Bỏ lệnh phụ khỏi đơn"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) p.onToggleExtraLsx(e.target.value, true)
                      }}
                      className="border-input text-muted-foreground h-7 rounded-md border border-dashed bg-transparent px-1.5 text-[11.5px]"
                      aria-label="Gộp thêm LSX vào đơn"
                    >
                      <option value="">＋ gộp thêm lệnh…</option>
                      {p.lsxs
                        .filter((l) => l.id !== p.lsxId && !p.extraLsxIds.includes(l.id))
                        .map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.code} — {l.customer_name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </Chip>

      {/* ── NCC: ô TÌM (150+ NCC, <select> không gõ nhảy tiếng Việt được) ── */}
      <Chip
        icon={Building2}
        name="NCC"
        value={supplier?.name ?? '— chưa chọn —'}
        missing={!p.supplierId}
        open={open === 'ncc'}
        onOpen={() => toggle('ncc')}
      >
        <div className="w-[420px] p-2.5">
          <label className="grid gap-1">
            <span className={label}>Nhà cung cấp</span>
            <SupplierPicker
              value={p.supplierId}
              onChange={(id) => {
                p.onSupplier(id)
                setOpen(null)
              }}
              suppliers={p.suppliers}
              className={field}
            />
          </label>
          {supplier && (
            <p className="text-muted-foreground mt-1.5 text-[11.5px]">
              {[
                supplier.lead_time_days != null
                  ? `lead ${supplier.lead_time_days} ngày`
                  : null,
                supplier.payment_terms,
              ]
                .filter(Boolean)
                .join(' · ') || 'chưa khai lead time / công nợ'}
            </p>
          )}
        </div>
      </Chip>

      <Chip
        icon={CalendarDays}
        name="Hẹn giao"
        value={
          p.expectedAt ? p.expectedAt.split('-').reverse().join('/') : '— chưa hẹn —'
        }
        mono
        open={open === 'date'}
        onOpen={() => toggle('date')}
      >
        <div className="w-[240px] p-2.5">
          <label className="grid gap-1">
            <span className={label}>Hẹn giao</span>
            <DateField
              value={p.expectedAt}
              onChange={p.onExpectedAt}
              aria-label="Hẹn giao"
              className={field}
            />
          </label>
        </div>
      </Chip>

      <Chip
        icon={ScrollText}
        name="Khác"
        value={`${p.currency}${p.contractNo ? ` · ${p.contractNo}` : ''}`}
        open={open === 'more'}
        onOpen={() => toggle('more')}
      >
        <div className="grid w-[320px] gap-2 p-2.5">
          <label className="grid gap-1">
            <span className={label}>Theo HĐ số</span>
            <input
              maxLength={100}
              value={p.contractNo}
              onChange={(e) => p.onContractNo(e.target.value)}
              placeholder="HĐ nguyên tắc 02/26…"
              className={field}
            />
          </label>
          <label className="grid gap-1">
            <span className={label}>Tiền tệ</span>
            <select
              value={p.currency}
              onChange={(e) => p.onCurrency(e.target.value)}
              className={field}
            >
              {(PO_CURRENCIES as readonly string[]).includes(p.currency) ? null : (
                <option value={p.currency}>{p.currency}</option>
              )}
              {PO_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Chip>

      <span className="ml-auto shrink-0">
        {p.problem ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--warn)]/12 px-2.5 py-1 text-[11.5px] font-medium text-[var(--warn)]">
            <AlertTriangle className="size-3.5" strokeWidth={1.8} aria-hidden />
            {p.problem}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--done)]/12 px-2.5 py-1 text-[11.5px] font-medium text-[var(--done)]">
            <Check className="size-3.5" strokeWidth={2.4} aria-hidden />
            {p.lineReady} dòng đủ số
          </span>
        )}
      </span>
    </div>
  )
}

function Chip({
  icon: Icon,
  name,
  value,
  mono,
  missing,
  open,
  onOpen,
  children,
}: {
  icon: LucideIcon
  name: string
  value: string
  mono?: boolean
  missing?: boolean
  open: boolean
  onOpen: () => void
  children: ReactNode
}) {
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  /*
   * BÀN PHÍM. Popover tự viết nên phải tự lo phần Radix vẫn làm hộ:
   *  · Esc đóng và TRẢ CON TRỎ về chip (không trả thì con trỏ rơi về <body>,
   *    người dùng bàn phím mất dấu giữa thanh đầu đơn).
   *  · Mở ra thì đưa con trỏ vào ô/nút đầu tiên — chip "NCC" mở là gõ tìm được
   *    ngay, không phải Tab thêm một nhịp.
   * Bấm ra ngoài đã có lớp nền bắt click bên dưới.
   */
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onOpen()
      btnRef.current?.focus()
    }
    document.addEventListener('keydown', onKey)
    const t = setTimeout(() => {
      panelRef.current
        ?.querySelector<HTMLElement>(
          'input:not([type=hidden]), select, textarea, button, [tabindex]:not([tabindex="-1"])',
        )
        ?.focus()
    }, 0)
    return () => {
      document.removeEventListener('keydown', onKey)
      clearTimeout(t)
    }
  }, [open, onOpen])

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={onOpen}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`${name}: ${value} — bấm để sửa`}
        className={
          'inline-flex max-w-[300px] items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[13px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]/50 ' +
          (missing
            ? 'border-[var(--stop)]/50 bg-[var(--stop)]/8 text-[var(--stop)]'
            : open
              ? 'border-[var(--primary)] bg-[var(--accent)]'
              : 'border-input hover:bg-accent')
        }
      >
        <Icon className="size-4 shrink-0" strokeWidth={1.8} aria-hidden />
        <span className="text-muted-foreground shrink-0 text-[11.5px]">{name}</span>
        <b className={'min-w-0 truncate ' + (mono ? 't-data text-[12.5px]' : '')}>
          {value}
        </b>
        <ChevronDown className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
      </button>
      {open && (
        <>
          {/* Nền bắt click để đóng — popover trong form, không dùng Radix portal
              nên không dính bẫy theme-v3 ở *Content. */}
          <div className="fixed inset-0 z-40" onClick={onOpen} aria-hidden />
          <div
            ref={panelRef}
            role="dialog"
            aria-label={name}
            /* Chip cuối thanh mà popover neo trái thì tràn khỏi mép phải màn
               hình — `max-w` + `right-0` cho chip nằm ở nửa phải. */
            className="border-border bg-popover absolute top-full left-0 z-50 mt-1.5 max-w-[calc(100vw-2rem)] rounded-lg border shadow-lg"
          >
            {children}
          </div>
        </>
      )}
    </div>
  )
}
