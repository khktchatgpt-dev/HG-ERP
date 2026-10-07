'use client'

import { useState } from 'react'
import { Save, X } from 'lucide-react'
import { BTN_PRI, BTN_SUB, INPUT, O } from '../orders/_form/don-form.shared'
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

/**
 * Form hồ sơ khách — dùng chung cho ngăn "Thêm khách" ở sổ và "Sửa hồ sơ" ở hồ
 * sơ, để hai chỗ không lệch nhau mỗi lần thêm trường. Điều khoản mặc định ở đây
 * là nguồn tự điền của báo giá / đơn (ĐƠN → KHÁCH → MẶC ĐỊNH).
 */
export function KhachForm({
  members,
  currentUserId,
  initial,
  submitLabel,
  saving,
  withActive,
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
  onCancel?: () => void
  onSubmit: (body: Record<string, unknown>) => Promise<void> | void
}) {
  const [d, setD] = useState<Draft>(() => fromInitial(initial, currentUserId))
  const set =
    (k: keyof Draft) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setD((x) => ({ ...x, [k]: e.target.value }))
  const missing: string[] = []
  if (!d.name.trim()) missing.push('tên khách')
  if (d.default_currency && d.default_currency.trim().length !== 3)
    missing.push('tiền tệ 3 ký tự')
  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email))
    missing.push('email đúng dạng')

  function submit() {
    if (missing.length) return
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

  return (
    <div className="flex flex-col gap-3">
      <Nhom title="Hồ sơ">
        <O label="Tên khách hàng *" htmlFor="kh-name" w="min-w-[280px] flex-1">
          <input
            id="kh-name"
            className={INPUT}
            value={d.name}
            onChange={set('name')}
            maxLength={200}
            autoFocus
          />
        </O>
        <O label="Mã KH" w="w-[120px]" hint="không trùng">
          <input
            className={`${INPUT} font-mono`}
            value={d.code}
            onChange={set('code')}
            maxLength={50}
          />
        </O>
        <O label="Phụ trách" w="w-[200px]">
          <select className={INPUT} value={d.owner_id} onChange={set('owner_id')}>
            <option value="">— chưa gán —</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
                {m.id === currentUserId ? ' (tôi)' : ''}
              </option>
            ))}
          </select>
        </O>
        <O label="Quốc gia" w="w-[140px]">
          <input
            className={INPUT}
            value={d.country}
            onChange={set('country')}
            maxLength={100}
          />
        </O>
        <O label="Người liên hệ" w="w-[200px]">
          <input
            className={INPUT}
            value={d.contact_person}
            onChange={set('contact_person')}
            maxLength={200}
          />
        </O>
        <O label="Chức danh" w="w-[160px]" hint="in trên hợp đồng">
          <input
            className={INPUT}
            value={d.representative_title}
            onChange={set('representative_title')}
            maxLength={100}
          />
        </O>
        <O label="Email" w="w-[220px]">
          <input className={INPUT} type="email" value={d.email} onChange={set('email')} />
        </O>
        <O label="Điện thoại" w="w-[140px]">
          <input
            className={`${INPUT} font-mono`}
            value={d.phone}
            onChange={set('phone')}
            maxLength={30}
          />
        </O>
        <O label="Fax" w="w-[140px]">
          <input
            className={`${INPUT} font-mono`}
            value={d.fax}
            onChange={set('fax')}
            maxLength={50}
          />
        </O>
        <O label="Địa chỉ" w="min-w-[320px] flex-1">
          <input
            className={INPUT}
            value={d.address}
            onChange={set('address')}
            maxLength={500}
          />
        </O>
        <O label="Mã số thuế" w="w-[160px]">
          <input
            className={`${INPUT} font-mono`}
            value={d.tax_code}
            onChange={set('tax_code')}
            maxLength={50}
          />
        </O>
        <O label="FSC Cert của KH" w="w-[180px]">
          <input
            className={`${INPUT} font-mono`}
            value={d.fsc_cert}
            onChange={set('fsc_cert')}
            maxLength={100}
          />
        </O>
      </Nhom>
      <Nhom title="Điều khoản mặc định — tự điền vào báo giá & đơn">
        <O label="Tiền tệ" w="w-[80px]">
          <input
            className={`${INPUT} font-mono uppercase`}
            value={d.default_currency}
            onChange={set('default_currency')}
            maxLength={3}
          />
        </O>
        <O label="Điều kiện giá (Incoterm)" w="w-[160px]">
          <input
            className={INPUT}
            value={d.default_price_term}
            onChange={set('default_price_term')}
            maxLength={100}
            placeholder="FOB Quy Nhon"
          />
        </O>
        <O label="Thanh toán" w="min-w-[260px] flex-1">
          <input
            className={INPUT}
            value={d.default_payment_terms}
            onChange={set('default_payment_terms')}
            maxLength={500}
            placeholder="T/T 30% cọc, 70% trước giao"
          />
        </O>
        <O label="Cảng đích (POD)" w="w-[200px]">
          <input
            className={INPUT}
            value={d.port_of_discharge}
            onChange={set('port_of_discharge')}
            maxLength={200}
          />
        </O>
        <O label="Ghi chú nội bộ" w="w-full">
          <textarea
            className={`${INPUT} h-12 resize-y py-1`}
            value={d.notes}
            onChange={set('notes')}
            maxLength={2000}
          />
        </O>
        {withActive && (
          <label className="flex items-center gap-1.5 pb-1 text-[13px]">
            <input
              type="checkbox"
              checked={d.is_active}
              onChange={(e) => setD((x) => ({ ...x, is_active: e.target.checked }))}
            />
            Đang giao dịch
          </label>
        )}
      </Nhom>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={BTN_PRI}
          disabled={saving || missing.length > 0}
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
        {missing.length > 0 && (
          <span className="text-xs text-[var(--stop)]">
            Còn thiếu: {missing.join(' · ')}
          </span>
        )}
      </div>
    </div>
  )
}

function Nhom({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-muted-foreground mb-1 text-xs font-semibold tracking-wide uppercase">
        {title}
      </div>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">{children}</div>
    </div>
  )
}
