'use client'

import {
  BadgeCheck,
  Banknote,
  ChevronDown,
  Clock,
  FileText,
  MapPin,
  PenLine,
  StickyNote,
  type LucideIcon,
} from 'lucide-react'
import type { PoTerms } from '@/lib/po-template'

const field =
  'h-9 w-full rounded-lg border border-zinc-300 bg-white px-2.5 pl-8 text-[13px] shadow-xs focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950'
const fieldLabel = 'text-[11px] font-semibold tracking-wide text-zinc-400 uppercase'
const fieldIcon =
  'pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-zinc-400'

/** Icon theo từng điều khoản — neo mắt khi quét, cùng khuôn khối Bối cảnh đơn. */
const TERM_ROWS: readonly [keyof PoTerms, string, LucideIcon][] = [
  ['quality', 'Tiêu chuẩn chất lượng', BadgeCheck],
  ['delivery_place', 'Địa điểm giao hàng', MapPin],
  ['payment', 'Hình thức thanh toán', Banknote],
  ['invoice', 'Chứng từ thanh toán', FileText],
  ['lead_time', 'Thời gian giao hàng', Clock],
]

/**
 * Năm điều khoản in thành năm dòng riêng trên phiếu + khối chữ ký giữa phiếu.
 *
 * Điền sẵn theo mẫu đơn (mỗi loại hàng một bộ điều khoản khác nhau — xem
 * `poTemplateMeta`), người dùng sửa khi thoả thuận riêng. Gập lại mặc định vì
 * phần lớn đơn dùng nguyên bản mặc định.
 */
export function TermsSection({
  templateLabel,
  open,
  onToggle,
  terms,
  onTermsChange,
  signerRole,
  onSignerChange,
  note,
  onNoteChange,
}: {
  templateLabel: string
  open: boolean
  onToggle: () => void
  terms: PoTerms
  onTermsChange: (t: PoTerms) => void
  signerRole: string
  onSignerChange: (v: string) => void
  note: string
  onNoteChange: (v: string) => void
}) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[13px]"
      >
        <b>Điều khoản &amp; chữ ký</b>
        <span className="text-[11px] text-zinc-400">
          đã điền sẵn theo mẫu {templateLabel.toLowerCase()} — bấm để sửa
        </span>
        <ChevronDown
          aria-hidden
          className={`ml-auto size-4 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="grid gap-3 border-t border-zinc-100 p-3.5 sm:grid-cols-2 dark:border-zinc-800">
          {TERM_ROWS.map(([k, label, Icon]) => (
            <label key={k} className="flex flex-col gap-1.5">
              <span className={fieldLabel}>{label}</span>
              <span className="relative">
                <Icon className={fieldIcon} aria-hidden />
                <input
                  maxLength={1000}
                  value={terms[k]}
                  onChange={(e) => onTermsChange({ ...terms, [k]: e.target.value })}
                  className={field}
                />
              </span>
            </label>
          ))}
          <label className="flex flex-col gap-1.5">
            <span className={fieldLabel}>Chữ ký giữa phiếu</span>
            <span className="relative">
              <PenLine className={fieldIcon} aria-hidden />
              <input
                maxLength={100}
                value={signerRole}
                onChange={(e) => onSignerChange(e.target.value)}
                className={field}
              />
            </span>
          </label>
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className={fieldLabel}>Ghi chú đơn</span>
            <span className="relative">
              <StickyNote className={fieldIcon} aria-hidden />
              <input
                maxLength={2000}
                value={note}
                onChange={(e) => onNoteChange(e.target.value)}
                placeholder="lời dặn in nghiêng cuối phiếu…"
                className={field}
              />
            </span>
          </label>
        </div>
      )}
    </section>
  )
}
