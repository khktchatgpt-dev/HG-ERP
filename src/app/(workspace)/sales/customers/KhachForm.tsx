'use client'

import { useState, type ReactNode } from 'react'
import { Save, X } from 'lucide-react'
import { BTN_PRI, BTN_SUB, INPUT } from '../orders/_form/don-form.shared'
import type { CustomerView, MemberOption } from './khach.shared'

type Draft = {
  name: string
  code: string
  owner_id: string
  contact_person: string
  representative_title: string
  email: string
  phone: string
  fax: string
  address: string
  country: string
  tax_code: string
  fsc_cert: string
  default_currency: string
  default_price_term: string
  default_payment_terms: string
  port_of_discharge: string
  notes: string
  is_active: boolean
}

const fromInitial = (c: Partial<CustomerView> | undefined, me: string): Draft => ({
  name: c?.name ?? '',
  code: c?.code ?? '',
  owner_id: c?.owner_id ?? (c ? '' : me),
  contact_person: c?.contact_person ?? '',
  representative_title: c?.representative_title ?? '',
  email: c?.email ?? '',
  phone: c?.phone ?? '',
  fax: c?.fax ?? '',
  address: c?.address ?? '',
  country: c?.country ?? '',
  tax_code: c?.tax_code ?? '',
  fsc_cert: c?.fsc_cert ?? '',
  default_currency: c?.default_currency ?? 'USD',
  default_price_term: c?.default_price_term ?? '',
  default_payment_terms: c?.default_payment_terms ?? '',
  port_of_discharge: c?.port_of_discharge ?? '',
  notes: c?.notes ?? '',
  is_active: c?.is_active ?? true,
})

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Form hồ sơ khách — dùng chung cho ngăn "Thêm khách" ở sổ và "Sửa hồ sơ" ở hồ
 * sơ, để hai chỗ không lệch nhau mỗi lần thêm trường. Lưới 12 cột cố định (ô
 * cùng hàng thẳng nhau, nhãn trên, lỗi ngay dưới ô), bốn nhóm: Định danh ·
 * Liên hệ · Pháp lý & địa chỉ · Điều khoản mặc định (nguồn tự điền báo giá/đơn).
 */
export function KhachForm({
  members,
  currentUserId,
  initial,
  submitLabel,
  saving,
  withActive,
  existing = [],
  onCancel,
  onSubmit,
}: {
  members: MemberOption[]
  currentUserId: string
  initial?: Partial<CustomerView>
  submitLabel: string
  saving: boolean
  /** Hiện ô "đang giao dịch" — chỉ có nghĩa khi SỬA. */
  withActive?: boolean
  /** Khách đã có (mọi trạng thái) — báo trùng tên / mã trước khi lưu, trừ chính mình. */
  existing?: { id: string; name: string; code: string | null }[]
  onCancel?: () => void
  onSubmit: (body: Record<string, unknown>) => Promise<void> | void
}) {
  const [d, setD] = useState<Draft>(() => fromInitial(initial, currentUserId))
  const [touched, setTouched] = useState<Set<keyof Draft>>(new Set())
  const set =
    (k: keyof Draft) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setD((x) => ({ ...x, [k]: e.target.value }))
  const touch = (k: keyof Draft) => () => setTouched((s) => new Set(s).add(k))

  /* ── kiểm tra: lỗi theo ô + cảnh báo trùng tên ─────────────────────── */
  const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, ' ')
  const dupName = existing.find(
    (x) => x.id !== initial?.id && norm(x.name) === norm(d.name),
  )
  const dupCode = d.code.trim()
    ? existing.find(
        (x) =>
          x.id !== initial?.id &&
          (x.code ?? '').toLowerCase() === d.code.trim().toLowerCase(),
      )
    : undefined
  const errors: Partial<Record<keyof Draft, string>> = {}
  if (!d.name.trim()) errors.name = 'Bắt buộc'
  if (dupCode) errors.code = `Mã đã của ${dupCode.name}`
  if (d.email && !EMAIL_RE.test(d.email)) errors.email = 'Email chưa đúng dạng'
  if (d.default_currency && d.default_currency.trim().length !== 3)
    errors.default_currency = '3 ký tự (USD, EUR…)'
  const errorList = Object.values(errors)
  const show = (k: keyof Draft) => (touched.has(k) ? errors[k] : undefined)

  function submit() {
    setTouched(new Set(Object.keys(d) as (keyof Draft)[]))
    if (errorList.length) return
    const s = (v: string) => v.trim() || null
    const body: Record<string, unknown> = {
      name: d.name.trim(),
      code: s(d.code),
      owner_id: d.owner_id || null,
      contact_person: s(d.contact_person),
      representative_title: s(d.representative_title),
      email: s(d.email),
      phone: s(d.phone),
      fax: s(d.fax),
      address: s(d.address),
      country: s(d.country),
      tax_code: s(d.tax_code),
      fsc_cert: s(d.fsc_cert),
      default_currency: d.default_currency.trim()
        ? d.default_currency.trim().toUpperCase()
        : null,
      default_price_term: s(d.default_price_term),
      default_payment_terms: s(d.default_payment_terms),
      port_of_discharge: s(d.port_of_discharge),
      notes: s(d.notes),
    }
    if (withActive) body.is_active = d.is_active
    void onSubmit(body)
  }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit()
    if (e.key === 'Escape' && onCancel) onCancel()
  }

  return (
    <div className="flex flex-col gap-3" onKeyDown={onKey}>
      <Nhom title="Định danh">
        <F
          label="Tên khách hàng"
          required
          span={5}
          err={show('name')}
          warn={dupName ? `Đã có khách tên “${dupName.name}”` : undefined}
        >
          <input
            id="kh-name"
            className={INPUT}
            value={d.name}
            onChange={set('name')}
            onBlur={touch('name')}
            maxLength={200}
            autoFocus
            placeholder="Tên trên hợp đồng / hoá đơn"
          />
        </F>
        <F label="Mã KH" span={2} err={show('code')} hint="để trống nếu chưa có mã riêng">
          <input
            className={`${INPUT} font-mono uppercase`}
            value={d.code}
            onChange={set('code')}
            onBlur={touch('code')}
            maxLength={50}
            placeholder="VD: MERXX"
          />
        </F>
        <F
          label="Người phụ trách"
          span={3}
          hint="người của phòng Sale theo dõi khách này"
        >
          <select className={INPUT} value={d.owner_id} onChange={set('owner_id')}>
            <option value="">— chưa gán —</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
                {m.id === currentUserId ? ' (tôi)' : ''}
              </option>
            ))}
          </select>
        </F>
        <F label="Quốc gia" span={2}>
          <input
            className={INPUT}
            value={d.country}
            onChange={set('country')}
            maxLength={100}
            placeholder="Germany"
          />
        </F>
      </Nhom>

      <Nhom title="Liên hệ">
        <F label="Người liên hệ" span={3}>
          <input
            className={INPUT}
            value={d.contact_person}
            onChange={set('contact_person')}
            maxLength={200}
          />
        </F>
        <F label="Chức danh" span={3} hint="in ở phần ký của hợp đồng">
          <input
            className={INPUT}
            value={d.representative_title}
            onChange={set('representative_title')}
            maxLength={100}
            placeholder="Purchasing Manager"
          />
        </F>
        <F label="Email" span={3} err={show('email')}>
          <input
            className={INPUT}
            type="email"
            value={d.email}
            onChange={set('email')}
            onBlur={touch('email')}
          />
        </F>
        <F label="Điện thoại" span={2}>
          <input
            className={`${INPUT} font-mono`}
            value={d.phone}
            onChange={set('phone')}
            maxLength={30}
          />
        </F>
        <F label="Fax" span={1}>
          <input
            className={`${INPUT} font-mono`}
            value={d.fax}
            onChange={set('fax')}
            maxLength={50}
          />
        </F>
      </Nhom>

      <Nhom title="Pháp lý & địa chỉ" note="in lên hợp đồng, packing list, invoice">
        <F label="Địa chỉ" span={6}>
          <input
            className={INPUT}
            value={d.address}
            onChange={set('address')}
            maxLength={500}
          />
        </F>
        <F label="Mã số thuế / VAT" span={3}>
          <input
            className={`${INPUT} font-mono`}
            value={d.tax_code}
            onChange={set('tax_code')}
            maxLength={50}
          />
        </F>
        <F label="FSC Cert của khách" span={3}>
          <input
            className={`${INPUT} font-mono`}
            value={d.fsc_cert}
            onChange={set('fsc_cert')}
            maxLength={100}
          />
        </F>
      </Nhom>

      <Nhom
        title="Điều khoản mặc định"
        note="tự điền vào báo giá và đơn mới của khách này — vẫn sửa được từng tờ"
      >
        <F label="Tiền tệ" span={1} err={show('default_currency')}>
          <input
            className={`${INPUT} font-mono uppercase`}
            value={d.default_currency}
            onChange={set('default_currency')}
            onBlur={touch('default_currency')}
            maxLength={3}
          />
        </F>
        <F label="Điều kiện giá (Incoterm)" span={3}>
          <input
            className={INPUT}
            value={d.default_price_term}
            onChange={set('default_price_term')}
            maxLength={100}
            placeholder="FOB Quy Nhon"
          />
        </F>
        <F label="Điều khoản thanh toán" span={5}>
          <input
            className={INPUT}
            value={d.default_payment_terms}
            onChange={set('default_payment_terms')}
            maxLength={500}
            placeholder="T/T 30% deposit, 70% before shipment"
          />
        </F>
        <F label="Cảng đích (POD)" span={3}>
          <input
            className={INPUT}
            value={d.port_of_discharge}
            onChange={set('port_of_discharge')}
            maxLength={200}
            placeholder="Hamburg"
          />
        </F>
        <F label="Ghi chú nội bộ" span={withActive ? 10 : 12} hint="không in ra ngoài">
          <textarea
            className={`${INPUT} h-12 resize-y py-1`}
            value={d.notes}
            onChange={set('notes')}
            maxLength={2000}
          />
        </F>
        {withActive && (
          <F label="Trạng thái" span={2}>
            <label className="flex h-7 items-center gap-1.5 text-[13px]">
              <input
                type="checkbox"
                checked={d.is_active}
                onChange={(e) => setD((x) => ({ ...x, is_active: e.target.checked }))}
              />
              Đang giao dịch
            </label>
          </F>
        )}
      </Nhom>

      <div className="border-border flex flex-wrap items-center gap-2 border-t pt-2">
        <button
          type="button"
          className={BTN_PRI}
          disabled={saving || errorList.length > 0}
          onClick={submit}
        >
          <Save className="size-4" strokeWidth={1.8} />
          {saving ? 'Đang lưu…' : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className={BTN_SUB} onClick={onCancel} disabled={saving}>
            <X className="size-3.5" strokeWidth={1.8} /> Huỷ
          </button>
        )}
        {errorList.length > 0 ? (
          <span className="text-xs text-[var(--stop)]">
            Còn {errorList.length} ô chưa hợp lệ — xem lỗi dưới ô.
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">
            Ctrl+Enter để lưu · Esc để huỷ
          </span>
        )}
      </div>
    </div>
  )
}

/** Nhóm ô: tiêu đề nhỏ + lưới 12 cột, ô cùng hàng thẳng đáy. */
function Nhom({
  title,
  note,
  children,
}: {
  title: string
  note?: string
  children: ReactNode
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline gap-2">
        <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          {title}
        </span>
        {note && <span className="text-muted-foreground text-[11px]">· {note}</span>}
      </div>
      <div className="grid grid-cols-12 gap-x-3 gap-y-2">{children}</div>
    </div>
  )
}

const SPAN: Record<number, string> = {
  1: 'col-span-1',
  2: 'col-span-2',
  3: 'col-span-3',
  4: 'col-span-4',
  5: 'col-span-5',
  6: 'col-span-6',
  10: 'col-span-10',
  12: 'col-span-12',
}

/** Một ô: nhãn trên (chiều cao cố định), ô nhập, dòng lỗi / cảnh báo / gợi ý dưới (luôn giữ chỗ 16px). */
function F({
  label,
  required,
  span,
  err,
  warn,
  hint,
  children,
}: {
  label: string
  required?: boolean
  span: number
  err?: string
  warn?: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className={`flex min-w-0 flex-col ${SPAN[span] ?? 'col-span-3'}`}>
      <span className="text-muted-foreground h-4 truncate text-[11px] leading-4">
        {label}
        {required && <span className="text-[var(--stop)]"> *</span>}
      </span>
      <span
        className={
          err ? '[&>input]:border-[var(--stop)] [&>select]:border-[var(--stop)]' : ''
        }
      >
        {children}
      </span>
      <span
        className={`h-4 truncate text-[11px] leading-4 ${err ? 'text-[var(--stop)]' : warn ? 'text-[var(--warn)]' : 'text-muted-foreground'}`}
        title={err ?? warn ?? hint}
      >
        {err ?? warn ?? hint ?? ''}
      </span>
    </label>
  )
}
