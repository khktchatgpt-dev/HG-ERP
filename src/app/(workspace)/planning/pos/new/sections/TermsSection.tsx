'use client'

import {
  BadgeCheck,
  Banknote,
  Clock,
  FileText,
  MapPin,
  ScrollText,
  PenLine,
  StickyNote,
  type LucideIcon,
} from 'lucide-react'
import { Input } from '@/components/shadcn/input'
import { SectionToggle } from '@/components/erp/SectionToggle'
import type { PoTerms } from '@/lib/po-template'

/* Chỉ còn phần KHÁC mặc định của `Input`: chừa chỗ cho icon bên trái + cỡ chữ
 * của khối này. Viền/nền/focus-ring do kit lo — trước đây chép tay nên trôi. */
const field = 'bg-card rounded-lg pl-8 text-[13px]'
const fieldLabel =
  'text-[11px] font-semibold tracking-wide text-muted-foreground uppercase'
const fieldIcon =
  'pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground'

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
    <section className="border-border bg-card rounded-xl border">
      {/*
        28/08: khối này người dùng KHÔNG THẤY. Hai lý do, sửa cả hai:
        (1) nó dùng màu cứng zinc/white thay vì token nên nhạt hơn mọi thẻ khác;
        (2) đóng lại chỉ còn một dòng chữ xám nói "đã điền sẵn" — không hé lộ
        nội dung nào, nên mắt lướt qua như thể là chú thích chứ không phải một
        phần của đơn. Nay: icon neo mắt + CHÍNH câu thanh toán / nơi giao hiện
        ngay trên đầu, và nút "Sửa" thay cho mũi tên câm.
      */}
      <SectionToggle
        icon={ScrollText}
        title="Điều khoản & chữ ký"
        summary={
          [terms.payment, terms.delivery_place].filter(Boolean).join(' · ') ||
          `theo mẫu ${templateLabel.toLowerCase()}`
        }
        open={open}
        onToggle={onToggle}
        openLabel="Sửa"
      />
      {open && (
        <div className="border-border/70 grid gap-3 border-t p-3.5 sm:grid-cols-2">
          {TERM_ROWS.map(([k, label, Icon]) => (
            <label key={k} className="flex flex-col gap-1.5">
              <span className={fieldLabel}>{label}</span>
              <span className="relative">
                <Icon className={fieldIcon} aria-hidden />
                <Input
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
              <Input
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
              <Input
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
