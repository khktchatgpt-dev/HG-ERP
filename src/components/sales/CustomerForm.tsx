'use client'

import { Button } from '@/components/ui/Button'

/** Khách hàng như giao diện Sales cần — khớp `CustomerWithOwner` phía server. */
export type CustomerView = {
  id: string
  code: string | null
  name: string
  email: string | null
  phone: string | null
  address: string | null
  notes: string | null
  owner_id: string | null
  owner_name: string | null
  owner_email: string | null
  tax_code: string | null
  country: string | null
  contact_person: string | null
  default_currency: string | null
  default_price_term: string | null
  default_payment_terms: string | null
  port_of_discharge: string | null
  fax: string | null
  representative_title: string | null
  fsc_cert: string | null
  is_active: boolean
  created_at: string
}

export type MemberOption = { id: string; label: string }

const cls =
  'w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'

/**
 * Form hồ sơ khách hàng — dùng chung cho hộp Thêm/Sửa ở danh sách VÀ nút Sửa trên
 * trang hồ sơ KH, để hai chỗ không lệch nhau mỗi lần thêm trường.
 *
 * Điều khoản mặc định ở đây là nguồn auto-fill của báo giá (`quotesService.create`
 * lấy `default_price_term` / `default_payment_terms` khi báo giá không nêu rõ), nên
 * khai đủ ở đây = đỡ gõ lại mỗi lần chào giá.
 *
 * Hộp chứa phải rộng (`maxWidth="sm:max-w-3xl"`): 20 trường nhồi vào hộp mặc định
 * `sm:max-w-lg` (512px) thì mỗi ô còn ~60px và nhãn gãy thành 3 dòng.
 */
export function CustomerForm({
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
  function handle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const str = (k: string) => String(fd.get(k) ?? '').trim() || null
    const body: Record<string, unknown> = {
      name: String(fd.get('name') ?? '').trim(),
      code: str('code'),
      owner_id: String(fd.get('owner_id') ?? '') || null,
      contact_person: str('contact_person'),
      email: str('email'),
      phone: str('phone'),
      address: str('address'),
      country: str('country'),
      tax_code: str('tax_code'),
      fax: str('fax'),
      representative_title: str('representative_title'),
      fsc_cert: str('fsc_cert'),
      default_currency: str('default_currency')?.toUpperCase() ?? null,
      default_price_term: str('default_price_term'),
      default_payment_terms: str('default_payment_terms'),
      port_of_discharge: str('port_of_discharge'),
      notes: str('notes'),
    }
    if (withActive) body.is_active = fd.get('is_active') === 'on'
    void onSubmit(body)
  }

  return (
    /*
     * `@container` + biến thể `@xl:` — chia 2 cột theo BỀ RỘNG CỦA HỘP, không theo
     * bề rộng cửa sổ. Dùng `sm:grid-cols-2` (breakpoint viewport) thì trên desktop
     * hộp rộng 460px vẫn bị ép 2 cột và mọi ô co lại còn vài chục pixel.
     *
     * Vùng trường cuộn riêng, thanh nút nằm NGOÀI vùng cuộn: form dài mà để nút Lưu
     * trôi theo thì phải cuộn xuống đáy mới bấm được.
     */
    <form onSubmit={handle} className="@container flex flex-col">
      <div className="-mr-2 flex max-h-[65vh] flex-col gap-5 overflow-y-auto pr-2">
        <Section title="Cơ bản">
          <Row>
            <L label="Tên khách hàng" required grow>
              <input
                name="name"
                required
                maxLength={200}
                autoFocus
                placeholder="Möbel Hali GmbH"
                defaultValue={initial?.name ?? ''}
                className={cls}
              />
            </L>
          </Row>
          <Row>
            <L label="Mã KH" hint="không trùng KH khác">
              <input
                name="code"
                maxLength={50}
                placeholder="KH-001"
                defaultValue={initial?.code ?? ''}
                className={`${cls} font-mono`}
              />
            </L>
            <L label="Phụ trách">
              <select
                name="owner_id"
                defaultValue={initial?.owner_id ?? currentUserId}
                className={cls}
              >
                <option value="">— chưa gán —</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </L>
          </Row>
        </Section>

        <Section title="Liên hệ">
          <Row>
            <L label="Người liên hệ">
              <input
                name="contact_person"
                maxLength={200}
                defaultValue={initial?.contact_person ?? ''}
                className={cls}
              />
            </L>
            <L label="Chức danh" hint="in trên hợp đồng">
              <input
                name="representative_title"
                maxLength={100}
                placeholder="Director"
                defaultValue={initial?.representative_title ?? ''}
                className={cls}
              />
            </L>
          </Row>
          <Row>
            <L label="Email">
              <input
                name="email"
                type="email"
                placeholder="info@moebel-hali.de"
                defaultValue={initial?.email ?? ''}
                className={cls}
              />
            </L>
            <L label="Điện thoại">
              <input
                name="phone"
                maxLength={30}
                defaultValue={initial?.phone ?? ''}
                className={cls}
              />
            </L>
          </Row>
          <Row>
            <L label="Địa chỉ" grow>
              <input
                name="address"
                maxLength={500}
                defaultValue={initial?.address ?? ''}
                className={cls}
              />
            </L>
          </Row>
          <Row>
            <L label="Quốc gia">
              <input
                name="country"
                maxLength={100}
                placeholder="Germany"
                defaultValue={initial?.country ?? ''}
                className={cls}
              />
            </L>
            <L label="Fax">
              <input
                name="fax"
                maxLength={50}
                defaultValue={initial?.fax ?? ''}
                className={cls}
              />
            </L>
          </Row>
          <Row>
            <L label="Mã số thuế">
              <input
                name="tax_code"
                maxLength={50}
                defaultValue={initial?.tax_code ?? ''}
                className={`${cls} font-mono`}
              />
            </L>
            <L label="FSC Cert của KH">
              <input
                name="fsc_cert"
                maxLength={100}
                placeholder="SCS-COC-001485"
                defaultValue={initial?.fsc_cert ?? ''}
                className={`${cls} font-mono`}
              />
            </L>
          </Row>
        </Section>

        <Section
          title="Điều khoản mặc định"
          note="Báo giá cho khách này sẽ tự điền các ô dưới đây — khai một lần, đỡ gõ lại mỗi lần chào giá."
        >
          <Row>
            <L label="Tiền tệ" hint="3 ký tự">
              <input
                name="default_currency"
                maxLength={3}
                placeholder="USD"
                defaultValue={initial?.default_currency ?? ''}
                className={`${cls} uppercase`}
              />
            </L>
            <L label="Điều kiện giá" hint="Incoterm">
              <input
                name="default_price_term"
                maxLength={100}
                placeholder="FOB Quy Nhon"
                defaultValue={initial?.default_price_term ?? ''}
                className={cls}
              />
            </L>
          </Row>
          <Row>
            <L label="Thanh toán" grow>
              <input
                name="default_payment_terms"
                maxLength={500}
                placeholder="L/C at sight · 30% deposit, 70% balance"
                defaultValue={initial?.default_payment_terms ?? ''}
                className={cls}
              />
            </L>
          </Row>
          <Row>
            <L label="Cảng đích" hint="POD" grow>
              <input
                name="port_of_discharge"
                maxLength={200}
                placeholder="Hamburg, Germany"
                defaultValue={initial?.port_of_discharge ?? ''}
                className={cls}
              />
            </L>
          </Row>
        </Section>

        <Section title="Khác">
          <Row>
            <L label="Ghi chú nội bộ" grow>
              <textarea
                name="notes"
                rows={2}
                maxLength={2000}
                defaultValue={initial?.notes ?? ''}
                className={cls}
              />
            </L>
          </Row>
          {withActive && (
            <label className="flex items-start gap-2 rounded-md bg-zinc-50 p-2.5 text-sm dark:bg-zinc-900">
              <input
                type="checkbox"
                name="is_active"
                defaultChecked={initial?.is_active ?? true}
                className="mt-0.5"
              />
              <span>
                Đang giao dịch
                <span className="mt-0.5 block text-xs text-zinc-500">
                  Bỏ chọn = ngừng giao dịch: KH bị ẩn khỏi danh sách mặc định và không
                  chọn được khi lập báo giá, nhưng lịch sử vẫn giữ và mở lại được.
                </span>
              </span>
            </label>
          )}
        </Section>
      </div>

      <div className="mt-4 flex justify-end gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        {onCancel && (
          <Button type="button" onClick={onCancel}>
            Huỷ
          </Button>
        )}
        <Button variant="primary" loading={saving}>
          {saving ? 'Đang lưu…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}

/**
 * Nhóm trường: tiêu đề nhỏ + gạch chân. KHÔNG dùng `fieldset`/`legend` — legend
 * trong một fieldset `display:grid` bị trình duyệt xếp thành một ô của lưới, làm
 * lệch toàn bộ hàng phía sau.
 */
function Section({
  title,
  note,
  children,
}: {
  title: string
  note?: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="border-b border-zinc-200 pb-1.5 dark:border-zinc-800">
        <h3 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
          {title}
        </h3>
        {note && <p className="mt-1 text-xs text-zinc-400">{note}</p>}
      </div>
      {children}
    </section>
  )
}

/** Một hàng trường — 2 cột khi hộp rộng ≥36rem, xếp dọc khi hẹp (mobile). */
function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 @xl:grid-cols-2">{children}</div>
}

function L({
  label,
  hint,
  required,
  grow,
  children,
}: {
  label: string
  hint?: string
  required?: boolean
  /** Chiếm cả hàng — dành cho nội dung dài (tên KH, địa chỉ, ghi chú). */
  grow?: boolean
  children: React.ReactNode
}) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${grow ? '@xl:col-span-2' : ''}`}>
      <span className="text-zinc-700 dark:text-zinc-300">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
        {hint && <span className="ml-1.5 text-xs text-zinc-400">({hint})</span>}
      </span>
      {children}
    </label>
  )
}
