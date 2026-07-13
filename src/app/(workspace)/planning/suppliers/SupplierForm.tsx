'use client'

import { useState } from 'react'
import { Spinner } from '@/components/erp/Spinner'

/** Hồ sơ NCC để đổ vào form (Vendor Master M1). Tất cả optional trừ tên. */
export type SupplierFormInitial = Partial<{
  code: string | null
  name: string
  short_name: string | null
  type: string | null
  status: string | null
  company_name: string | null
  tax_no: string | null
  business_license: string | null
  founded_on: string | null
  legal_rep: string | null
  country: string | null
  registered_address: string | null
  email: string | null
  phone: string | null
  address: string | null
  trading_address: string | null
  warehouse_address: string | null
  website: string | null
  payment_terms: string | null
  currency: string | null
  bank_name: string | null
  bank_account: string | null
  swift_code: string | null
  invoice_terms: string | null
  moq: string | null
  lead_time_days: number | null
  incoterms: string | null
  delivery_method: string | null
  return_policy: string | null
  warranty_policy: string | null
  region: string | null
  import_export: string | null
  priority: string | null
  rating: string | null
  note: string | null
}>

const TYPES = ['Nguyên vật liệu', 'Bao bì', 'Máy móc', 'Dịch vụ', 'Logistics', 'Khác']
const cls =
  'w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'

export function SupplierForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: SupplierFormInitial
  submitLabel: string
  onSubmit: (body: Record<string, unknown>) => Promise<void> | void
}) {
  const [busy, setBusy] = useState(false)

  async function handle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const s = (k: string) => String(fd.get(k) ?? '').trim() || null
    const body: Record<string, unknown> = {
      code: s('code'),
      name: String(fd.get('name') ?? '').trim(),
      short_name: s('short_name'),
      type: s('type'),
      status: s('status') ?? 'active',
      company_name: s('company_name'),
      tax_no: s('tax_no'),
      business_license: s('business_license'),
      founded_on: s('founded_on'),
      legal_rep: s('legal_rep'),
      country: s('country'),
      registered_address: s('registered_address'),
      email: String(fd.get('email') ?? '').trim(),
      phone: s('phone'),
      address: s('address'),
      warehouse_address: s('warehouse_address'),
      website: s('website'),
      payment_terms: s('payment_terms'),
      currency: s('currency'),
      bank_name: s('bank_name'),
      bank_account: s('bank_account'),
      swift_code: s('swift_code'),
      invoice_terms: s('invoice_terms'),
      moq: s('moq'),
      lead_time_days: s('lead_time_days') ? Number(fd.get('lead_time_days')) : null,
      incoterms: s('incoterms'),
      delivery_method: s('delivery_method'),
      return_policy: s('return_policy'),
      warranty_policy: s('warranty_policy'),
      region: s('region'),
      import_export: s('import_export'),
      priority: s('priority'),
      rating: s('rating'),
      note: s('note'),
    }
    setBusy(true)
    await onSubmit(body)
    setBusy(false)
  }

  return (
    <form onSubmit={handle} className="flex flex-col gap-5">
      <Section title="Cơ bản">
        <Field label="Mã NCC">
          <input
            name="code"
            maxLength={50}
            defaultValue={initial?.code ?? ''}
            className={`${cls} font-mono`}
          />
        </Field>
        <Field label="Trạng thái">
          <select
            name="status"
            defaultValue={initial?.status ?? 'active'}
            className={cls}
          >
            <option value="active">Hoạt động</option>
            <option value="suspended">Tạm ngưng</option>
            <option value="terminated">Ngừng hợp tác</option>
          </select>
        </Field>
        <Field label="Tên NCC *" full>
          <input
            name="name"
            required
            maxLength={200}
            defaultValue={initial?.name ?? ''}
            className={cls}
          />
        </Field>
        <Field label="Tên viết tắt">
          <input
            name="short_name"
            maxLength={100}
            defaultValue={initial?.short_name ?? ''}
            className={cls}
          />
        </Field>
        <Field label="Loại NCC">
          <select name="type" defaultValue={initial?.type ?? ''} className={cls}>
            <option value="">— chọn —</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      <Section title="Pháp lý">
        <Field label="Tên công ty">
          <input
            name="company_name"
            maxLength={200}
            defaultValue={initial?.company_name ?? ''}
            className={cls}
          />
        </Field>
        <Field label="Mã số thuế">
          <input
            name="tax_no"
            maxLength={30}
            defaultValue={initial?.tax_no ?? ''}
            className={`${cls} font-mono`}
          />
        </Field>
        <Field label="Giấy phép KD">
          <input
            name="business_license"
            maxLength={100}
            defaultValue={initial?.business_license ?? ''}
            className={cls}
          />
        </Field>
        <Field label="Ngày thành lập">
          <input
            name="founded_on"
            type="date"
            defaultValue={initial?.founded_on ?? ''}
            className={cls}
          />
        </Field>
        <Field label="Người đại diện PL">
          <input
            name="legal_rep"
            maxLength={150}
            defaultValue={initial?.legal_rep ?? ''}
            className={cls}
          />
        </Field>
        <Field label="Quốc gia">
          <input
            name="country"
            maxLength={100}
            defaultValue={initial?.country ?? ''}
            className={cls}
          />
        </Field>
        <Field label="Địa chỉ đăng ký" full>
          <input
            name="registered_address"
            maxLength={500}
            defaultValue={initial?.registered_address ?? ''}
            className={cls}
          />
        </Field>
      </Section>

      <Section title="Liên hệ">
        <Field label="Điện thoại">
          <input
            name="phone"
            maxLength={30}
            defaultValue={initial?.phone ?? ''}
            className={cls}
          />
        </Field>
        <Field label="Email">
          <input
            name="email"
            type="email"
            defaultValue={initial?.email ?? ''}
            className={cls}
          />
        </Field>
        <Field label="Website">
          <input
            name="website"
            maxLength={200}
            defaultValue={initial?.website ?? ''}
            className={cls}
          />
        </Field>
        <Field label="Địa chỉ giao dịch" full>
          <input
            name="address"
            maxLength={500}
            defaultValue={initial?.address ?? ''}
            className={cls}
          />
        </Field>
        <Field label="Địa chỉ kho giao hàng" full>
          <input
            name="warehouse_address"
            maxLength={500}
            defaultValue={initial?.warehouse_address ?? ''}
            className={cls}
          />
        </Field>
      </Section>

      <Section title="Thanh toán">
        <Field label="Điều khoản TT">
          <input
            name="payment_terms"
            maxLength={100}
            placeholder="COD / NET30 / NET45…"
            defaultValue={initial?.payment_terms ?? ''}
            className={cls}
          />
        </Field>
        <Field label="Tiền tệ">
          <select name="currency" defaultValue={initial?.currency ?? ''} className={cls}>
            <option value="">—</option>
            {['VND', 'USD', 'EUR', 'CNY', 'JPY'].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Ngân hàng">
          <input
            name="bank_name"
            maxLength={200}
            defaultValue={initial?.bank_name ?? ''}
            className={cls}
          />
        </Field>
        <Field label="Số tài khoản">
          <input
            name="bank_account"
            maxLength={50}
            defaultValue={initial?.bank_account ?? ''}
            className={`${cls} font-mono`}
          />
        </Field>
        <Field label="SWIFT (nhập khẩu)">
          <input
            name="swift_code"
            maxLength={30}
            defaultValue={initial?.swift_code ?? ''}
            className={`${cls} font-mono`}
          />
        </Field>
        <Field label="ĐK xuất hoá đơn">
          <input
            name="invoice_terms"
            maxLength={200}
            defaultValue={initial?.invoice_terms ?? ''}
            className={cls}
          />
        </Field>
      </Section>

      <Section title="Mua hàng">
        <Field label="MOQ (tối thiểu)">
          <input
            name="moq"
            maxLength={200}
            defaultValue={initial?.moq ?? ''}
            className={cls}
          />
        </Field>
        <Field label="Lead time (ngày)">
          <input
            name="lead_time_days"
            type="number"
            min={0}
            defaultValue={initial?.lead_time_days ?? ''}
            className={cls}
          />
        </Field>
        <Field label="Incoterms">
          <input
            name="incoterms"
            maxLength={30}
            placeholder="EXW / FOB / CIF…"
            defaultValue={initial?.incoterms ?? ''}
            className={cls}
          />
        </Field>
        <Field label="Phương thức giao">
          <input
            name="delivery_method"
            maxLength={100}
            defaultValue={initial?.delivery_method ?? ''}
            className={cls}
          />
        </Field>
        <Field label="Chính sách đổi trả" full>
          <input
            name="return_policy"
            maxLength={1000}
            defaultValue={initial?.return_policy ?? ''}
            className={cls}
          />
        </Field>
        <Field label="Chính sách bảo hành" full>
          <input
            name="warranty_policy"
            maxLength={1000}
            defaultValue={initial?.warranty_policy ?? ''}
            className={cls}
          />
        </Field>
      </Section>

      <Section title="Phân loại">
        <Field label="Khu vực">
          <input
            name="region"
            maxLength={100}
            placeholder="Việt Nam / Trung Quốc…"
            defaultValue={initial?.region ?? ''}
            className={cls}
          />
        </Field>
        <Field label="Hình thức">
          <select
            name="import_export"
            defaultValue={initial?.import_export ?? ''}
            className={cls}
          >
            <option value="">—</option>
            <option value="domestic">Nội địa</option>
            <option value="import">Nhập khẩu</option>
          </select>
        </Field>
        <Field label="Mức ưu tiên">
          <select name="priority" defaultValue={initial?.priority ?? ''} className={cls}>
            <option value="">—</option>
            <option value="primary">Chính</option>
            <option value="backup">Dự phòng</option>
          </select>
        </Field>
        <Field label="Xếp hạng">
          <select name="rating" defaultValue={initial?.rating ?? ''} className={cls}>
            <option value="">—</option>
            {['A', 'B', 'C', 'D'].map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      <label className="flex flex-col gap-1 text-sm">
        Ghi chú
        <textarea
          name="note"
          rows={2}
          maxLength={2000}
          defaultValue={initial?.note ?? ''}
          className={cls}
        />
      </label>

      <div className="flex justify-end">
        <button
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {busy && <Spinner size={14} />}
          {busy ? 'Đang lưu…' : submitLabel}
        </button>
      </div>
    </form>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
        {title}
      </legend>
      <div className="grid gap-3 sm:grid-cols-3">{children}</div>
    </fieldset>
  )
}

function Field({
  label,
  full,
  children,
}: {
  label: string
  full?: boolean
  children: React.ReactNode
}) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${full ? 'sm:col-span-3' : ''}`}>
      {label}
      {children}
    </label>
  )
}
