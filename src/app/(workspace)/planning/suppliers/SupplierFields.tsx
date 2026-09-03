'use client'

import { useId, useMemo, useState } from 'react'
import {
  Banknote,
  Building2,
  Contact,
  Scale,
  ShoppingCart,
  Tags,
  TriangleAlert,
} from 'lucide-react'
import { SectionToggle } from '@/components/erp/SectionToggle'
import { ToolbarSelect } from '@/components/erp/Toolbar'
import { DateField } from '@/components/erp/DateField'
import { Input } from '@/components/shadcn/input'
import { Textarea } from '@/components/shadcn/textarea'
import { PO_CURRENCIES } from '@/lib/po-line'
import { nextSupplierCode } from '@/lib/supplier-code'

/**
 * BỘ Ô HỒ SƠ NHÀ CUNG CẤP — cho cả TẠO MỚI và SỬA (03/09/2026).
 *
 * Trước đây tạo NCC là "thêm nhanh" 6 ô (tên, mã, loại, MST, ĐT, email) rồi đá
 * sang trang hồ sơ để điền tiếp — mà không ai quay lại điền, vì lúc đó việc đã
 * xong. Hệ quả đo được trong dữ liệu: phần lớn NCC trống điều khoản thanh toán,
 * tiền tệ và lead time, đúng ba thứ form soạn đơn đọc để mồi cho dòng hàng.
 *
 * Nay hỏi đủ ngay lúc tạo. Để "đủ" không thành "dài": hai mảng đầu (Cơ bản,
 * Liên hệ) luôn mở — chừng đó là tạo được; bốn mảng sau gập lại và thanh gập kể
 * luôn nội dung đã điền, nên không phải mở từng cái để dò.
 *
 * Form CÓ KIỂM SOÁT (state ở component cha) chứ không đọc FormData: ô chọn của
 * kit là component có kiểm soát, ghép với FormData thì phải rải input ẩn —
 * đúng thứ cổng lint chặn, và cũng là mầm lệch giữa cái người ta thấy và cái
 * được gửi đi.
 */
export type SupplierFormValues = {
  code?: string | null
  name?: string
  short_name?: string | null
  type?: string | null
  status?: string | null
  company_name?: string | null
  tax_no?: string | null
  business_license?: string | null
  founded_on?: string | null
  legal_rep?: string | null
  country?: string | null
  registered_address?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  warehouse_address?: string | null
  website?: string | null
  payment_terms?: string | null
  currency?: string | null
  bank_name?: string | null
  bank_account?: string | null
  swift_code?: string | null
  invoice_terms?: string | null
  moq?: string | null
  lead_time_days?: number | null
  incoterms?: string | null
  delivery_method?: string | null
  return_policy?: string | null
  warranty_policy?: string | null
  region?: string | null
  import_export?: string | null
  priority?: string | null
  rating?: string | null
  note?: string | null
}

export const SUPPLIER_TYPES = [
  'Nguyên vật liệu',
  'Bao bì',
  'Máy móc',
  'Dịch vụ',
  'Logistics',
  'Khác',
]

/** Từ vựng MỞ — gợi ý cái hay dùng, gõ mới vẫn được. */
const PAYMENT_TERMS = ['COD', 'Trả trước 100%', 'NET 15', 'NET 30', 'NET 45', 'NET 60']
const INCOTERMS = ['EXW', 'FOB', 'CIF', 'CFR', 'DAP', 'DDP']

/** Giá trị mặc định cho form tạo mới. */
export const emptySupplier: SupplierFormValues = { status: 'active', country: 'Việt Nam' }

/** State → payload API: cắt khoảng trắng, '' → null (cột ghi rõ là "chưa có"). */
export function toSupplierPayload(v: SupplierFormValues): Record<string, unknown> {
  const s = (x: string | null | undefined) => (x ?? '').trim() || null
  return {
    ...v,
    name: (v.name ?? '').trim(),
    code: s(v.code),
    short_name: s(v.short_name),
    type: s(v.type),
    status: s(v.status) ?? 'active',
    company_name: s(v.company_name),
    tax_no: s(v.tax_no),
    business_license: s(v.business_license),
    founded_on: s(v.founded_on),
    legal_rep: s(v.legal_rep),
    country: s(v.country),
    registered_address: s(v.registered_address),
    email: (v.email ?? '').trim(),
    phone: s(v.phone),
    address: s(v.address),
    warehouse_address: s(v.warehouse_address),
    website: s(v.website),
    payment_terms: s(v.payment_terms),
    currency: s(v.currency),
    bank_name: s(v.bank_name),
    bank_account: s(v.bank_account),
    swift_code: s(v.swift_code),
    invoice_terms: s(v.invoice_terms),
    moq: s(v.moq),
    lead_time_days: v.lead_time_days ?? null,
    incoterms: s(v.incoterms),
    delivery_method: s(v.delivery_method),
    return_policy: s(v.return_policy),
    warranty_policy: s(v.warranty_policy),
    region: s(v.region),
    import_export: s(v.import_export),
    priority: s(v.priority),
    rating: s(v.rating),
    note: s(v.note),
  }
}

export function SupplierFields({
  value,
  onChange,
  /** Tạo mới: gập bốn mảng sau. Sửa: mở hết — vào đây là để soi từng ô. */
  mode,
  /** NCC đã có, để cảnh báo trùng ngay lúc gõ tên / MST. */
  existing = [],
}: {
  value: SupplierFormValues
  onChange: (patch: SupplierFormValues) => void
  mode: 'create' | 'edit'
  existing?: { id: string; name: string; tax_no?: string | null; code?: string | null }[]
}) {
  const uid = useId()
  const codes = useMemo(
    () => existing.map((s) => s.code ?? '').filter(Boolean),
    [existing],
  )
  const [open, setOpen] = useState({
    payment: mode === 'edit',
    buying: mode === 'edit',
    legal: mode === 'edit',
    tags: mode === 'edit',
  })
  const set = <K extends keyof SupplierFormValues>(k: K, x: SupplierFormValues[K]) =>
    onChange({ [k]: x } as SupplierFormValues)
  const txt = (k: keyof SupplierFormValues) => String(value[k] ?? '')

  /*
   * TRÙNG NCC — dò trên danh sách đang có, không tốn thêm truy vấn. Danh mục
   * thật đã có những cặp kiểu "Cty TNHH Tiến Đạt" / "Tiến Đạt" trỏ cùng một nơi;
   * mỗi bản giữ một nửa lịch sử đặt hàng nên không ai nhìn ra công nợ thật.
   * CHỈ CẢNH BÁO, không chặn: có khi hai pháp nhân trùng tên thật.
   */
  /** Mã server sẽ cấp nếu để trống — bày trước cho người khai thấy. */
  const autoCode = useMemo(
    () =>
      mode === 'create' && !(value.code ?? '').trim()
        ? nextSupplierCode(value.name ?? '', codes)
        : '',
    [mode, value.code, value.name, codes],
  )

  const dup = useMemo(() => {
    const n = (value.name ?? '').trim().toLowerCase()
    const t = (value.tax_no ?? '').trim()
    if (n.length < 3 && !t) return null
    const byTax = t ? existing.find((s) => s.tax_no?.trim() === t) : undefined
    if (byTax) return byTax
    if (n.length < 3) return null
    return (
      existing.find((s) => s.name.trim().toLowerCase() === n) ??
      (n.length >= 4
        ? (existing.find((s) => s.name.trim().toLowerCase().includes(n)) ?? null)
        : null)
    )
  }, [value.name, value.tax_no, existing])

  return (
    <div className="flex flex-col gap-3">
      <Block icon={Building2} title="Cơ bản">
        <Field label="Tên NCC" required span>
          <Input
            required
            maxLength={200}
            autoFocus={mode === 'create'}
            value={txt('name')}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Công ty TNHH …"
          />
          {dup && (
            <span
              className="mt-1 flex items-start gap-1.5 text-[12px]"
              style={{ color: 'var(--warn)' }}
            >
              <TriangleAlert size={13} strokeWidth={1.8} className="mt-0.5 shrink-0" />
              <span>
                Đã có NCC <b>{dup.name}</b>
                {dup.tax_no ? ` (MST ${dup.tax_no})` : ''} — kiểm lại trước khi tạo bản
                thứ hai.
              </span>
            </span>
          )}
        </Field>
        {/*
          Mã bỏ trống thì SERVER tự cấp (nextSupplierCode). Ở đây chạy đúng hàm
          đó để bày trước cái mã sẽ ra — người khai thấy ngay và sửa được nếu
          không ưng, thay vì tạo xong mới phát hiện mã lạ.
        */}
        <Field
          label="Mã NCC"
          hint={
            txt('code')
              ? 'Dùng để đối chiếu sổ tay.'
              : autoCode
                ? `Để trống thì hệ thống cấp mã ${autoCode}.`
                : 'Để trống thì hệ thống tự cấp theo tên.'
          }
        >
          <Input
            maxLength={50}
            className="t-data"
            placeholder={autoCode || 'tự cấp theo tên'}
            value={txt('code')}
            onChange={(e) => set('code', e.target.value)}
          />
        </Field>
        <Field label="Tên viết tắt" hint="Hiện ở ô chọn NCC lúc soạn đơn.">
          <Input
            maxLength={100}
            value={txt('short_name')}
            onChange={(e) => set('short_name', e.target.value)}
          />
        </Field>
        <Field label="Loại NCC">
          <Picker
            value={txt('type')}
            onChange={(x) => set('type', x)}
            options={SUPPLIER_TYPES}
            listId={`${uid}-type`}
            placeholder="chọn hoặc gõ mới…"
          />
        </Field>
        <Field label="Trạng thái">
          <ToolbarSelect
            className="h-9 w-full"
            aria-label="Trạng thái NCC"
            value={txt('status') || 'active'}
            onChange={(x) => set('status', x)}
            options={[
              { value: 'active', label: 'Hoạt động' },
              { value: 'suspended', label: 'Tạm ngưng' },
              { value: 'terminated', label: 'Ngừng hợp tác' },
            ]}
          />
        </Field>
      </Block>

      <Block icon={Contact} title="Liên hệ">
        <Field label="Điện thoại">
          <Input
            maxLength={30}
            className="t-data"
            value={txt('phone')}
            onChange={(e) => set('phone', e.target.value)}
          />
        </Field>
        <Field label="Email">
          <Input
            type="email"
            value={txt('email')}
            onChange={(e) => set('email', e.target.value)}
          />
        </Field>
        <Field label="Website">
          <Input
            maxLength={200}
            value={txt('website')}
            onChange={(e) => set('website', e.target.value)}
          />
        </Field>
        <Field label="Mã số thuế">
          <Input
            maxLength={30}
            className="t-data"
            value={txt('tax_no')}
            onChange={(e) => set('tax_no', e.target.value)}
          />
        </Field>
        <Field label="Địa chỉ giao dịch" span>
          <Input
            maxLength={500}
            value={txt('address')}
            onChange={(e) => set('address', e.target.value)}
          />
        </Field>
        <Field
          label="Địa chỉ kho giao hàng"
          span
          hint="Chỗ mình tới lấy hàng, nếu khác địa chỉ giao dịch."
        >
          <Input
            maxLength={500}
            value={txt('warehouse_address')}
            onChange={(e) => set('warehouse_address', e.target.value)}
          />
        </Field>
      </Block>

      <Collapsible
        icon={Banknote}
        title="Thanh toán"
        summary={
          [txt('payment_terms'), txt('currency') || 'VND'].filter(Boolean).join(' · ') ||
          'chưa khai'
        }
        open={open.payment}
        onToggle={() => setOpen((o) => ({ ...o, payment: !o.payment }))}
      >
        <Field label="Điều khoản thanh toán" hint="Đơn đặt lấy sẵn dòng này.">
          <Picker
            value={txt('payment_terms')}
            onChange={(x) => set('payment_terms', x)}
            options={PAYMENT_TERMS}
            listId={`${uid}-pay`}
            placeholder="COD / NET 30…"
          />
        </Field>
        <Field label="Tiền tệ" hint="Chọn NCC là đơn tự chuyển sang tiền này.">
          <ToolbarSelect
            className="t-data h-9 w-full"
            aria-label="Tiền tệ"
            value={txt('currency')}
            onChange={(x) => set('currency', x)}
            options={[
              { value: '', label: '— VND (mặc định) —' },
              ...PO_CURRENCIES.map((c) => ({ value: c, label: c })),
            ]}
          />
        </Field>
        <Field label="Ngân hàng">
          <Input
            maxLength={200}
            value={txt('bank_name')}
            onChange={(e) => set('bank_name', e.target.value)}
          />
        </Field>
        <Field label="Số tài khoản">
          <Input
            maxLength={50}
            className="t-data"
            value={txt('bank_account')}
            onChange={(e) => set('bank_account', e.target.value)}
          />
        </Field>
        <Field label="SWIFT" hint="Chỉ cần khi chuyển tiền quốc tế.">
          <Input
            maxLength={30}
            className="t-data"
            value={txt('swift_code')}
            onChange={(e) => set('swift_code', e.target.value)}
          />
        </Field>
        <Field label="Điều kiện xuất hoá đơn">
          <Input
            maxLength={200}
            value={txt('invoice_terms')}
            onChange={(e) => set('invoice_terms', e.target.value)}
          />
        </Field>
      </Collapsible>

      <Collapsible
        icon={ShoppingCart}
        title="Mua hàng"
        summary={
          [
            value.lead_time_days != null ? `${value.lead_time_days} ngày` : '',
            txt('incoterms'),
            txt('moq'),
          ]
            .filter(Boolean)
            .join(' · ') || 'chưa khai'
        }
        open={open.buying}
        onToggle={() => setOpen((o) => ({ ...o, buying: !o.buying }))}
      >
        <Field label="Lead time (ngày)" hint="Dùng để tính ngày hẹn giao khi lên đơn.">
          <Input
            inputMode="numeric"
            className="t-data"
            value={value.lead_time_days == null ? '' : String(value.lead_time_days)}
            onChange={(e) => {
              const d = e.target.value.replace(/[^\d]/g, '')
              set('lead_time_days', d ? Number(d) : null)
            }}
          />
        </Field>
        <Field label="Đặt tối thiểu (MOQ)">
          <Input
            maxLength={200}
            placeholder="500 cái / 1 tấn…"
            value={txt('moq')}
            onChange={(e) => set('moq', e.target.value)}
          />
        </Field>
        <Field label="Incoterms">
          <Picker
            value={txt('incoterms')}
            onChange={(x) => set('incoterms', x)}
            options={INCOTERMS}
            listId={`${uid}-inco`}
            placeholder="FOB / CIF…"
          />
        </Field>
        <Field label="Phương thức giao">
          <Input
            maxLength={100}
            placeholder="NCC giao tận kho / mình tới lấy…"
            value={txt('delivery_method')}
            onChange={(e) => set('delivery_method', e.target.value)}
          />
        </Field>
        <Field label="Chính sách đổi trả" span>
          <Textarea
            rows={2}
            maxLength={1000}
            value={txt('return_policy')}
            onChange={(e) => set('return_policy', e.target.value)}
          />
        </Field>
        <Field label="Chính sách bảo hành" span>
          <Textarea
            rows={2}
            maxLength={1000}
            value={txt('warranty_policy')}
            onChange={(e) => set('warranty_policy', e.target.value)}
          />
        </Field>
      </Collapsible>

      <Collapsible
        icon={Scale}
        title="Pháp lý"
        summary={
          [txt('company_name'), txt('business_license')].filter(Boolean).join(' · ') ||
          'chưa khai'
        }
        open={open.legal}
        onToggle={() => setOpen((o) => ({ ...o, legal: !o.legal }))}
      >
        <Field label="Tên công ty trên hoá đơn" span>
          <Input
            maxLength={200}
            value={txt('company_name')}
            onChange={(e) => set('company_name', e.target.value)}
          />
        </Field>
        <Field label="Giấy phép kinh doanh">
          <Input
            maxLength={100}
            className="t-data"
            value={txt('business_license')}
            onChange={(e) => set('business_license', e.target.value)}
          />
        </Field>
        <Field label="Ngày thành lập">
          <DateField
            value={txt('founded_on')}
            onChange={(iso) => set('founded_on', iso)}
            aria-label="Ngày thành lập"
          />
        </Field>
        <Field label="Người đại diện pháp luật">
          <Input
            maxLength={150}
            value={txt('legal_rep')}
            onChange={(e) => set('legal_rep', e.target.value)}
          />
        </Field>
        <Field label="Quốc gia">
          <Input
            maxLength={100}
            value={txt('country')}
            onChange={(e) => set('country', e.target.value)}
          />
        </Field>
        <Field label="Địa chỉ đăng ký" span>
          <Input
            maxLength={500}
            value={txt('registered_address')}
            onChange={(e) => set('registered_address', e.target.value)}
          />
        </Field>
      </Collapsible>

      <Collapsible
        icon={Tags}
        title="Phân loại & ghi chú"
        summary={
          [txt('region'), txt('priority'), txt('rating') && `hạng ${txt('rating')}`]
            .filter(Boolean)
            .join(' · ') || 'chưa khai'
        }
        open={open.tags}
        onToggle={() => setOpen((o) => ({ ...o, tags: !o.tags }))}
      >
        <Field label="Khu vực">
          <Input
            maxLength={100}
            placeholder="Bình Dương…"
            value={txt('region')}
            onChange={(e) => set('region', e.target.value)}
          />
        </Field>
        <Field label="Hình thức">
          <ToolbarSelect
            className="h-9 w-full"
            aria-label="Hình thức"
            value={txt('import_export')}
            onChange={(x) => set('import_export', x)}
            options={[
              { value: '', label: '— chưa xác định —' },
              { value: 'domestic', label: 'Trong nước' },
              { value: 'import', label: 'Nhập khẩu' },
            ]}
          />
        </Field>
        <Field label="Mức ưu tiên">
          <ToolbarSelect
            className="h-9 w-full"
            aria-label="Mức ưu tiên"
            value={txt('priority')}
            onChange={(x) => set('priority', x)}
            options={[
              { value: '', label: '— chưa xếp —' },
              { value: 'primary', label: 'Chính' },
              { value: 'backup', label: 'Dự phòng' },
            ]}
          />
        </Field>
        <Field label="Xếp hạng" hint="Hiện cạnh tên NCC ở mọi màn chọn.">
          <ToolbarSelect
            className="h-9 w-full"
            aria-label="Xếp hạng"
            value={txt('rating')}
            onChange={(x) => set('rating', x)}
            options={[
              { value: '', label: '— chưa chấm —' },
              ...['A', 'B', 'C', 'D'].map((r) => ({ value: r, label: r })),
            ]}
          />
        </Field>
        <Field label="Ghi chú" span>
          <Textarea
            rows={2}
            maxLength={2000}
            value={txt('note')}
            onChange={(e) => set('note', e.target.value)}
          />
        </Field>
      </Collapsible>
    </div>
  )
}

/** Ô có nhãn — lưới 2 cột, `span` chiếm cả hàng. */
function Field({
  label,
  hint,
  required,
  span,
  children,
}: {
  label: string
  hint?: string
  required?: boolean
  span?: boolean
  children: React.ReactNode
}) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${span ? 'sm:col-span-2' : ''}`}>
      <span className="text-muted-foreground text-[12px] font-medium">
        {label}
        {required && <span className="ml-0.5 text-[var(--stop)]">*</span>}
      </span>
      {children}
      {hint && (
        <span className="text-muted-foreground text-[11px] leading-snug">{hint}</span>
      )}
    </label>
  )
}

function Block({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Building2
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="bg-card rounded-lg border">
      <header className="flex items-center gap-2 border-b px-3.5 py-2.5">
        <Icon size={16} strokeWidth={1.8} className="text-muted-foreground" />
        <h3 className="text-[13px] font-semibold">{title}</h3>
      </header>
      <div className="grid gap-3 p-3.5 sm:grid-cols-2">{children}</div>
    </section>
  )
}

function Collapsible({
  icon,
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  icon: typeof Building2
  title: string
  summary: React.ReactNode
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <section className="bg-card overflow-hidden rounded-lg border">
      <SectionToggle
        icon={icon}
        title={title}
        summary={summary}
        open={open}
        onToggle={onToggle}
        openLabel="Khai thêm"
      />
      {open && <div className="grid gap-3 border-t p-3.5 sm:grid-cols-2">{children}</div>}
    </section>
  )
}

/**
 * Ô CHỌN NHƯNG GÕ MỚI VẪN ĐƯỢC — loại NCC, điều khoản, incoterms là từ vựng mở:
 * gợi ý cái hay dùng để đỡ gõ và đỡ lệch chính tả, nhưng không chặn cái mới.
 */
function Picker({
  value,
  onChange,
  options,
  listId,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
  listId: string
  placeholder?: string
}) {
  return (
    <>
      <Input
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={100}
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </>
  )
}
