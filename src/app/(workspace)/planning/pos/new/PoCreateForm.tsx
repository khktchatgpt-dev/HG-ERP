'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/erp/PageHeader'
import { TopProgressBar } from '@/components/erp/Spinner'
import { MaterialPicker, type PoMaterial } from '@/components/supply/MaterialPicker'
import { poTemplateMeta, type PoTemplate, type PoTerms } from '@/lib/po-template'
import { PoLineTable } from './PoLineTable'
import { QuickAddMaterial } from './QuickAddMaterial'
import {
  buildPoPayload,
  draftProblem,
  poTotals,
  readyLineCount,
  templateDefaults,
  type PoHeader,
} from './po-draft'
import { ContextStrip } from './sections/ContextStrip'
import { TemplatePicker } from './sections/TemplatePicker'
import { NeedsPanel, type Need } from './sections/NeedsPanel'
import { TermsSection } from './sections/TermsSection'
import { TotalsBar } from './sections/TotalsBar'
import { newLine, type Line } from './po-line'

type SupplierOption = {
  id: string
  name: string
  rating: string | null
  lead_time_days: number | null
  payment_terms: string | null
}
type LsxOption = { id: string; code: string; order_code: string; customer_name: string }

/** Đơn đang mở sẵn — server page dựng từ `posService.detail`. */
export type PoInitial = {
  mode: 'edit' | 'duplicate'
  po: {
    id: string
    code: string
    template: PoTemplate
    production_order_id: string | null
    supplier_id: string
    currency: string
    vat_rate: number | null
    price_includes_vat: boolean
    discount_amount: number | null
    contract_no: string | null
    expected_at: string | null
    note: string | null
    signer_role: string | null
    terms: PoTerms
  }
  lines: Line[]
}

const field =
  'h-[32px] w-full rounded-md border border-zinc-300 px-2 text-[13px] focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'

/**
 * SOẠN ĐƠN ĐẶT HÀNG — trục là MẪU ĐƠN THEO LOẠI HÀNG.
 *
 * Phòng Cung ứng không dùng một mẫu đơn: rà 8 file đơn thật ra 5 mẫu khác nhau cả
 * bộ cột dòng hàng lẫn công thức tiền, VAT và khối chữ ký (bảng đối chiếu trong
 * `@/lib/po-template`). Form cũ nhồi chung một bảng 10 cột nên dòng nhôm phải
 * mượn ô của dòng vít, và nhân viên tự bấm máy tính ra tổng kg.
 *
 * Ở đây: chọn LSX → chọn mẫu → chọn NCC, rồi bảng tự đổi cột theo mẫu. Ô tính sẵn
 * (tổng kg, m², thành tiền) nền xám không gõ được; hai ô luôn phải gõ là SL đặt
 * và Đơn giá. Dòng nhập nhanh nằm cuối bảng, chọn xong vật tư là con trỏ ở lại ô
 * tìm nên thêm dòng liên tiếp không cần rời bàn phím.
 */
export function PoCreateForm({
  suppliers,
  lsxs,
  defaultSupplierId,
  initial,
  initialProducts = [],
}: {
  suppliers: SupplierOption[]
  lsxs: LsxOption[]
  defaultSupplierId?: string
  /** Có = mở đơn có sẵn: 'edit' ghi đè đơn cũ, 'duplicate' tạo đơn mới từ nó. */
  initial?: PoInitial
  /** Mã SP của LSX gắn với đơn đang mở — server nạp sẵn cho form sửa. */
  initialProducts?: { code: string; name: string }[]
}) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const isEdit = initial?.mode === 'edit'
  const start = initial?.po
  const startMeta = poTemplateMeta(start?.template ?? 'accessory')

  const [template, setTemplate] = useState<PoTemplate>(start?.template ?? 'accessory')
  const [poType, setPoType] = useState<'lsx' | 'standalone'>(
    start ? (start.production_order_id ? 'lsx' : 'standalone') : 'lsx',
  )
  const [lsxId, setLsxId] = useState(start?.production_order_id ?? '')
  const [supplierId, setSupplierId] = useState(
    start?.supplier_id ??
      (defaultSupplierId && suppliers.some((s) => s.id === defaultSupplierId)
        ? defaultSupplierId
        : ''),
  )
  const [expectedAt, setExpectedAt] = useState(start?.expected_at ?? '')
  const [contractNo, setContractNo] = useState(start?.contract_no ?? '')
  const [currency, setCurrency] = useState(start?.currency ?? 'VND')
  const [note, setNote] = useState(start?.note ?? '')
  const [discount, setDiscount] = useState<number | ''>(start?.discount_amount ?? '')

  const meta = poTemplateMeta(template)
  // VAT và điều khoản đi theo mẫu, nhưng phải sửa được: cùng mẫu vẫn có NCC chào
  // khác. Đổi mẫu thì nạp lại mặc định của mẫu mới (xem selectTemplate). Mở đơn có
  // sẵn thì giữ nguyên số đã chốt với NCC, không áp lại mặc định của mẫu.
  const [vat, setVat] = useState<number | ''>(start?.vat_rate ?? startMeta.vatRate ?? '')
  const [inclVat, setInclVat] = useState(
    start?.price_includes_vat ?? startMeta.priceIncludesVat,
  )
  const [terms, setTerms] = useState(start?.terms ?? startMeta.terms)
  const [signerRole, setSignerRole] = useState(start?.signer_role ?? startMeta.signerRole)
  const [showTerms, setShowTerms] = useState(false)

  const [lines, setLines] = useState<Line[]>(initial?.lines ?? [])
  const [needs, setNeeds] = useState<Need[]>([])
  /**
   * Mã SP của lệnh đang chọn — đổ vào ô "Mã SP" từng dòng (mua gộp nhiều SP).
   * Mở form SỬA thì server đã nạp sẵn (`initialProducts`), khỏi chờ người dùng
   * chọn lại đúng cái LSX đang hiện trên form thì ô mới có danh sách.
   */
  const [lsxProducts, setLsxProducts] =
    useState<{ code: string; name: string }[]>(initialProducts)
  const [loadingNeeds, setLoadingNeeds] = useState(false)
  const [showNeeds, setShowNeeds] = useState(true)

  const usedIds = useMemo(() => new Set(lines.map((l) => l.material_id)), [lines])
  const suggestions = useMemo(
    () => new Map(needs.map((n) => [n.material_id, n.suggest])),
    [needs],
  )
  const lsx = lsxs.find((l) => l.id === lsxId)
  const supplier = suppliers.find((s) => s.id === supplierId)

  /** Đổi mẫu → nạp lại VAT + điều khoản + chữ ký mặc định của mẫu mới. */
  /** Đổi mẫu → nạp lại VAT + điều khoản + chữ ký mặc định (quy tắc ở `po-draft`). */
  function selectTemplate(t: PoTemplate) {
    const d = templateDefaults(t)
    setTemplate(t)
    setVat(d.vat)
    setInclVat(d.inclVat)
    setTerms(d.terms)
    setSignerRole(d.signerRole)
  }

  async function selectLsx(id: string) {
    setLsxId(id)
    setNeeds([])
    setLsxProducts([])
    if (!id) return
    setLoadingNeeds(true)
    try {
      const data = await api<{
        needs: Need[]
        products: { code: string; name: string }[]
      }>(`/api/dept/supply/needs?production_order_id=${id}`)
      setNeeds(data.needs)
      setLsxProducts(data.products ?? [])
    } catch (e) {
      toast.error('Không tải được nhu cầu', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setLoadingNeeds(false)
    }
  }

  function addMaterial(m: PoMaterial) {
    if (usedIds.has(m.id)) return
    setLines((ls) => [...ls, newLine(template, m)])
  }

  /**
   * Thêm từ nhu cầu BOM. Nhu cầu chỉ có id/tên/ĐVT nên phải nạp hồ sơ vật tư để
   * lấy kg/m, dài cây, quy cách — thiếu chúng thì dòng nhôm không tính được tiền.
   */
  async function addFromNeeds(list: Need[]) {
    const ids = list.map((n) => n.material_id).filter((id) => !usedIds.has(id))
    if (ids.length === 0) return
    try {
      const { materials } = await api<{ materials: PoMaterial[] }>(
        `/api/dept/supply/po-materials?ids=${ids.join(',')}`,
      )
      const byId = new Map(materials.map((m) => [m.id, m]))
      setLines((ls) => {
        const have = new Set(ls.map((l) => l.material_id))
        const add: Line[] = []
        for (const n of list) {
          if (have.has(n.material_id)) continue
          const m = byId.get(n.material_id)
          if (!m) continue
          // Nhu cầu BOM đổ vào cột "SL đơn hàng" của mẫu phụ kiện; SL đặt vẫn để
          // trống, nhân viên bấm nút gợi ý hoặc tự gõ.
          add.push({ ...newLine(template, m), qty_demand: n.qty_needed })
        }
        return [...ls, ...add]
      })
    } catch (e) {
      toast.error('Không thêm được vật tư', e instanceof ApiError ? e.message : 'Có lỗi')
    }
  }

  function patchLine(i: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }
  function removeLine(i: number) {
    setLines((ls) => ls.filter((_, idx) => idx !== i))
  }

  /** Gom đầu đơn lại để đưa cho các hàm thuần ở `po-draft.ts` (có test riêng). */
  const header: PoHeader = {
    template,
    poType,
    lsxId,
    supplierId,
    expectedAt,
    contractNo,
    currency,
    note,
    discount,
    vat,
    inclVat,
    terms,
    signerRole,
  }
  const { subtotal, vatAmount, grandTotal } = poTotals(header, lines)
  const readyLines = readyLineCount(template, lines)
  const problem = draftProblem(header, lines)

  async function submit() {
    if (problem || busy) return
    setBusy(true)
    try {
      const { po } = await api<{ po: { code: string } }>(
        isEdit ? `/api/dept/supply/pos/${initial!.po.id}` : '/api/dept/supply/pos',
        {
          // Route sửa đơn là PATCH (`/api/dept/supply/pos/[id]`), không phải PUT.
          method: isEdit ? 'PATCH' : 'POST',
          body: buildPoPayload(header, lines),
        },
      )
      toast.success(
        isEdit ? `Đã lưu ${po.code}` : `Đã tạo ${po.code}`,
        'Đơn đang chờ Giám đốc duyệt',
      )
      router.push('/planning/pos')
      router.refresh()
    } catch (err) {
      toast.error(
        isEdit ? 'Lưu đơn thất bại' : 'Tạo đơn thất bại',
        err instanceof ApiError ? err.message : 'Có lỗi',
      )
      setBusy(false)
    }
  }

  const pendingNeeds = needs.filter((n) => n.suggest > 0 && !usedIds.has(n.material_id))

  return (
    <div className="flex flex-col gap-3.5 pb-24">
      <TopProgressBar active={busy} />
      <PageHeader
        breadcrumbs={[
          { label: 'Kế hoạch - Cung ứng', href: '/planning' },
          { label: 'Đơn đặt vật tư', href: '/planning/pos' },
          {
            label: isEdit
              ? `Sửa ${initial!.po.code}`
              : initial
                ? `Nhân bản ${initial.po.code}`
                : 'Soạn đơn',
          },
        ]}
        title={isEdit ? `Sửa đơn ${initial!.po.code}` : 'Soạn đơn đặt hàng'}
        description="Chọn mẫu đơn theo loại hàng — bảng tự đổi cột, ô nền xám hệ thống tự tính. Bạn chỉ nhập SL đặt và đơn giá."
        actions={
          <Link
            href="/planning/pos"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            ← Về danh sách
          </Link>
        }
      />

      <ContextStrip
        templateLabel={meta.label}
        lsxLabel={poType === 'standalone' ? 'ngoài LSX' : (lsx?.code ?? '— chưa chọn —')}
        supplierName={supplier?.name ?? null}
        readyLines={readyLines}
        totalLines={lines.length}
      />

      <TemplatePicker
        value={template}
        lineCount={lines.length}
        onChange={selectTemplate}
      />

      {/* ── Bối cảnh đơn ── */}
      <section className="rounded-xl border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-3 inline-flex rounded-lg border border-zinc-200 p-0.5 text-[13px] dark:border-zinc-700">
          {(
            [
              ['lsx', 'Theo lệnh sản xuất'],
              ['standalone', 'Ngoài LSX'],
            ] as const
          ).map(([t, label]) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setPoType(t)
                if (t === 'standalone') {
                  setLsxId('')
                  setNeeds([])
                }
              }}
              className={
                'rounded-md px-3 py-1 font-medium transition-colors ' +
                (poType === t
                  ? 'bg-sky-600 text-white'
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300')
              }
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {poType === 'lsx' && (
            <label className="flex flex-col gap-1 text-sm">
              <span>
                LSX <span className="text-red-500">*</span>
              </span>
              <select
                value={lsxId}
                onChange={(e) => void selectLsx(e.target.value)}
                className={field}
              >
                <option value="">— chọn LSX đã duyệt —</option>
                {lsxs.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.code} — {l.customer_name}
                  </option>
                ))}
              </select>
              {lsx && (
                <span className="text-xs text-zinc-400">
                  Đơn hàng <b className="font-mono text-zinc-500">{lsx.order_code}</b>
                </span>
              )}
            </label>
          )}
          <label className="flex flex-col gap-1 text-sm">
            <span>
              Nhà cung cấp <span className="text-red-500">*</span>
            </span>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className={field}
            >
              <option value="">— chọn NCC —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.rating ? ` (hạng ${s.rating})` : ''}
                </option>
              ))}
            </select>
            {supplier && (
              <span className="text-xs text-zinc-400">
                {[
                  supplier.lead_time_days != null
                    ? `lead ${supplier.lead_time_days} ngày`
                    : null,
                  supplier.payment_terms,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            )}
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Hẹn giao
            <input
              type="date"
              value={expectedAt}
              onChange={(e) => setExpectedAt(e.target.value)}
              className={field}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Theo HĐ số
            <input
              maxLength={100}
              value={contractNo}
              onChange={(e) => setContractNo(e.target.value)}
              className={field}
            />
          </label>
        </div>
      </section>

      {/* ── Nhu cầu LSX: đường tắt, không phải cửa bắt buộc ── */}
      {poType === 'lsx' && lsxId && (
        <NeedsPanel
          needs={needs}
          pending={pendingNeeds}
          loading={loadingNeeds}
          open={showNeeds}
          onToggle={() => setShowNeeds((v) => !v)}
          onAdd={(list) => void addFromNeeds(list)}
        />
      )}

      {/* ── Bảng dòng: cột đổi theo mẫu ── */}
      <section className="min-w-0 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-2 border-b border-zinc-100 px-3.5 py-2.5 dark:border-zinc-800">
          <b className="text-[13px]">Dòng hàng</b>
          <span className="rounded bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
            mẫu {meta.label}
          </span>
          <span className="ml-auto text-[11px] text-zinc-400">
            {readyLines}/{lines.length} dòng đủ số
          </span>
        </div>
        <PoLineTable
          template={template}
          lines={lines}
          suggestions={suggestions}
          products={lsxProducts}
          currency={currency}
          onPatch={patchLine}
          onRemove={removeLine}
          addRow={
            <MaterialPicker
              template={template}
              usedIds={usedIds}
              onPick={addMaterial}
              needs={suggestions}
            />
          }
        />
        <div className="border-t border-zinc-100 p-3 dark:border-zinc-800">
          <QuickAddMaterial
            template={template}
            onCreated={(m) =>
              // NCC chào loại mới ngay lúc đặt — khai vật tư tại chỗ rồi vào thẳng
              // dòng, khỏi chạy sang danh mục Kho khai trước. Lấy ĐÚNG số server
              // vừa ghi (mẫu đơn, kg/m…) chứ không suy lại ở client: suy lại thì
              // dòng vẫn đẹp kể cả khi server ghi hụt, và lệch chỉ lộ ở lần sau.
              addMaterial({
                id: m.id,
                code: m.code,
                name: m.name,
                unit: m.unit,
                group_name: m.group_name,
                spec: m.spec,
                po_template: m.po_template,
                kg_per_m: m.kg_per_m,
                default_bar_length_m: m.default_bar_length_m,
                vat_rate: null,
                default_supplier_id: null,
                last_purchase_price: null,
                on_hand: 0,
              })
            }
          />
        </div>
      </section>

      {/* ── Điều khoản: mặc định theo mẫu, sửa được ── */}
      <TermsSection
        templateLabel={meta.label}
        open={showTerms}
        onToggle={() => setShowTerms((v) => !v)}
        terms={terms}
        onTermsChange={setTerms}
        signerRole={signerRole}
        onSignerChange={setSignerRole}
        note={note}
        onNoteChange={setNote}
      />

      <TotalsBar
        subtotal={subtotal}
        vat={vat}
        vatAmount={vatAmount}
        inclVat={inclVat}
        discount={discount}
        hasDiscount={meta.hasDiscount}
        grandTotal={grandTotal}
        currency={currency}
        problem={problem}
        busy={busy}
        submitLabel={isEdit ? 'Lưu thay đổi' : 'Tạo đơn → gửi GĐ duyệt'}
        onVatChange={setVat}
        onInclVatChange={setInclVat}
        onDiscountChange={setDiscount}
        onCurrencyChange={setCurrency}
        onSubmit={() => void submit()}
      />
    </div>
  )
}
