'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/erp/PageHeader'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'
import { MaterialPicker, type PoMaterial } from '@/components/supply/MaterialPicker'
import {
  PO_TEMPLATES,
  poTemplateMeta,
  type PoTemplate,
  type PoTerms,
} from '@/lib/po-template'
import { PoLineTable } from './PoLineTable'
import { QuickAddMaterial } from './QuickAddMaterial'
import { draftOf, lineAmount, lineReady, newLine, type Line } from './po-line'

type SupplierOption = {
  id: string
  name: string
  rating: string | null
  lead_time_days: number | null
  payment_terms: string | null
}
type LsxOption = { id: string; code: string; order_code: string; customer_name: string }

/** Nhu cầu vật tư của LSX từ BOM — API /dept/supply/needs. */
type Need = {
  material_id: string
  material_code: string
  material_name: string
  unit: string
  qty_needed: number
  available: number
  suggest: number
}

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

const num = (n: number) => n.toLocaleString('vi-VN')
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
}: {
  suppliers: SupplierOption[]
  lsxs: LsxOption[]
  defaultSupplierId?: string
  /** Có = mở đơn có sẵn: 'edit' ghi đè đơn cũ, 'duplicate' tạo đơn mới từ nó. */
  initial?: PoInitial
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
  function selectTemplate(t: PoTemplate) {
    const m = poTemplateMeta(t)
    setTemplate(t)
    setVat(m.vatRate ?? '')
    setInclVat(m.priceIncludesVat)
    setTerms(m.terms)
    setSignerRole(m.signerRole)
  }

  async function selectLsx(id: string) {
    setLsxId(id)
    setNeeds([])
    if (!id) return
    setLoadingNeeds(true)
    try {
      const data = await api<{ needs: Need[] }>(
        `/api/dept/supply/needs?production_order_id=${id}`,
      )
      setNeeds(data.needs)
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

  // ── Tổng tiền: cộng hàng → trừ chiết khấu → VAT (đúng thứ tự trên phiếu thật).
  // Làm tròn về đồng NGAY ở tiền hàng: tiền dòng lẻ vô hạn (kg × đơn giá) mà để
  // trôi xuống thì tổng thanh toán in ra "44.477.168,4" — không ai ký được.
  const subtotal = Math.round(lines.reduce((s, l) => s + lineAmount(template, l), 0))
  const discountAmount = discount === '' ? 0 : Number(discount)
  const base = Math.max(0, subtotal - discountAmount)
  const vatRate = vat === '' ? 0 : Number(vat)
  const vatAmount = inclVat
    ? Math.round((base * vatRate) / (100 + vatRate))
    : Math.round((base * vatRate) / 100)
  const grandTotal = inclVat ? base : base + vatAmount

  const readyLines = lines.filter((l) => lineReady(template, l)).length
  const problem =
    poType === 'lsx' && !lsxId
      ? 'chưa chọn LSX'
      : !supplierId
        ? 'chưa chọn nhà cung cấp'
        : lines.length === 0
          ? 'chưa có dòng vật tư nào'
          : readyLines < lines.length
            ? `${lines.length - readyLines} dòng còn thiếu số`
            : null

  async function submit() {
    if (problem || busy) return
    setBusy(true)
    try {
      const { po } = await api<{ po: { code: string } }>(
        isEdit ? `/api/dept/supply/pos/${initial!.po.id}` : '/api/dept/supply/pos',
        {
          // Route sửa đơn là PATCH (`/api/dept/supply/pos/[id]`), không phải PUT.
          method: isEdit ? 'PATCH' : 'POST',
          body: {
            production_order_id: poType === 'lsx' ? lsxId : null,
            supplier_id: supplierId,
            template,
            currency,
            vat_rate: vat === '' ? null : Number(vat),
            price_includes_vat: inclVat,
            discount_amount: discountAmount || null,
            contract_no: contractNo.trim() || null,
            expected_at: expectedAt || null,
            terms_quality: terms.quality || null,
            terms_delivery_place: terms.delivery_place || null,
            terms_payment: terms.payment || null,
            terms_invoice: terms.invoice || null,
            terms_lead_time: terms.lead_time || null,
            signer_role: signerRole || null,
            note: note.trim() || null,
            lines: lines.map((l) => {
              const d = draftOf(l)
              return {
                material_id: l.material_id,
                qty_ordered: d.qty_ordered,
                unit_price: l.price === '' ? null : Number(l.price),
                spec: l.spec.trim() || null,
                note: l.note.trim() || null,
                material_grade: l.material_grade.trim() || null,
                product_code: l.product_code.trim() || null,
                dm_per_sp: l.dm_per_sp === '' ? null : Number(l.dm_per_sp),
                qty_demand: l.qty_demand === '' ? null : Number(l.qty_demand),
                qty_on_hand: l.qty_on_hand === '' ? null : Number(l.qty_on_hand),
                waste_pct: l.waste_pct === '' ? null : Number(l.waste_pct),
                die_code: l.die_code.trim() || null,
                weight_per_m: d.weight_per_m,
                bar_length_m: d.bar_length_m,
                bar_surplus: l.bar_surplus === '' ? null : Number(l.bar_surplus),
                dimension_text: l.dimension_text.trim() || null,
                finish: l.finish.trim() || null,
                weight_per_unit: d.weight_per_unit,
                open_style: l.open_style || null,
                pcs_per_ctn: l.pcs_per_ctn === '' ? null : Number(l.pcs_per_ctn),
                inner_l_mm: l.inner_l_mm === '' ? null : Number(l.inner_l_mm),
                inner_w_mm: l.inner_w_mm === '' ? null : Number(l.inner_w_mm),
                inner_h_mm: l.inner_h_mm === '' ? null : Number(l.inner_h_mm),
                area_m2: d.area_m2,
                carton_basis: template === 'carton' ? l.carton_basis : null,
              }
            }),
          },
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

      {/* ── Mẫu đơn: quyết định cột nhập, công thức tiền, VAT và phiếu in ── */}
      <section className="rounded-xl border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-2 text-[11px] font-semibold tracking-wide text-zinc-400 uppercase">
          Loại hàng / mẫu đơn
        </div>
        <div className="flex flex-wrap gap-2">
          {PO_TEMPLATES.map((t) => {
            const m = poTemplateMeta(t)
            const on = t === template
            return (
              <button
                key={t}
                type="button"
                onClick={() => selectTemplate(t)}
                aria-pressed={on}
                className={
                  'rounded-lg border px-3 py-2 text-left transition-colors ' +
                  (on
                    ? 'border-sky-500 bg-sky-50 dark:border-sky-600 dark:bg-sky-950/40'
                    : 'border-zinc-200 hover:border-sky-300 dark:border-zinc-800')
                }
              >
                <div
                  className={
                    'text-[13px] font-semibold ' +
                    (on ? 'text-sky-700 dark:text-sky-300' : '')
                  }
                >
                  {m.label}
                </div>
                <div className="mt-0.5 max-w-[230px] text-[11px] text-zinc-400">
                  {m.hint}
                </div>
              </button>
            )
          })}
        </div>
        {lines.length > 0 && (
          <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-500">
            Đổi mẫu giữ nguyên {lines.length} dòng đang có — cột và cách tính tiền đổi
            theo mẫu mới, kiểm lại số trước khi gửi.
          </p>
        )}
      </section>

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
        <section className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-2 px-3.5 py-2.5 text-[13px]">
            <b>Nhu cầu từ BOM của LSX</b>
            <span className="text-zinc-400">
              {loadingNeeds
                ? 'đang tải…'
                : `${pendingNeeds.length} vật tư cần mua / ${needs.length} trong BOM`}
            </span>
            {pendingNeeds.length > 0 && (
              <button
                type="button"
                onClick={() => void addFromNeeds(pendingNeeds)}
                className="ml-auto rounded-md border border-dashed border-zinc-300 px-2.5 py-1 text-xs text-zinc-600 hover:border-sky-400 hover:text-sky-600 dark:border-zinc-700 dark:text-zinc-400"
              >
                ＋ Thêm tất cả ({pendingNeeds.length})
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowNeeds((v) => !v)}
              className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs dark:border-zinc-700"
            >
              {showNeeds ? 'Thu gọn' : 'Xem'}
            </button>
          </div>
          {showNeeds && pendingNeeds.length > 0 && (
            <div className="grid gap-2 border-t border-zinc-100 p-3 sm:grid-cols-2 lg:grid-cols-3 dark:border-zinc-800">
              {pendingNeeds.slice(0, 24).map((n) => (
                <div
                  key={n.material_id}
                  className="flex items-center gap-2 rounded-lg border border-zinc-200 px-2.5 py-1.5 dark:border-zinc-800"
                >
                  <div className="min-w-0 flex-1">
                    <div
                      className="truncate text-xs font-semibold"
                      title={n.material_name}
                    >
                      {n.material_name}
                    </div>
                    <div className="font-mono text-[10px] text-zinc-400">
                      {n.material_code} · cần {num(n.qty_needed)} · KD {num(n.available)}
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-[10px] text-zinc-400">
                    đề xuất
                    <div className="text-xs font-bold text-zinc-700 dark:text-zinc-200">
                      {num(n.suggest)} {n.unit}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void addFromNeeds([n])}
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-zinc-300 text-sm font-bold text-sky-600 hover:border-sky-400 hover:bg-sky-50 dark:border-zinc-700"
                    aria-label={`Thêm ${n.material_name}`}
                  >
                    +
                  </button>
                </div>
              ))}
              {pendingNeeds.length > 24 && (
                <p className="col-span-full text-[11px] text-zinc-400">
                  … và {pendingNeeds.length - 24} vật tư nữa — dùng “Thêm tất cả” hoặc gõ
                  tìm ở dòng cuối bảng.
                </p>
              )}
            </div>
          )}
        </section>
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
          currency={currency}
          onPatch={patchLine}
          onRemove={removeLine}
          addRow={
            <MaterialPicker template={template} usedIds={usedIds} onPick={addMaterial} />
          }
        />
        <div className="border-t border-zinc-100 p-3 dark:border-zinc-800">
          <QuickAddMaterial
            template={template}
            onCreated={(m) =>
              // NCC chào loại mới ngay lúc đặt — khai vật tư tại chỗ rồi vào thẳng
              // dòng, khỏi chạy sang danh mục Kho khai trước.
              addMaterial({
                id: m.id,
                code: m.code,
                name: m.name,
                unit: m.unit,
                group_name: null,
                spec: m.spec,
                po_template: template,
                kg_per_m: null,
                default_bar_length_m: null,
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
      <section className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <button
          type="button"
          onClick={() => setShowTerms((v) => !v)}
          className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[13px]"
        >
          <b>Điều khoản &amp; ghi chú</b>
          <span className="text-[11px] text-zinc-400">
            đã điền sẵn theo mẫu {meta.label.toLowerCase()}
          </span>
          <span className="ml-auto text-xs text-zinc-400">{showTerms ? '▲' : '▼'}</span>
        </button>
        {showTerms && (
          <div className="grid gap-3 border-t border-zinc-100 p-3.5 sm:grid-cols-2 dark:border-zinc-800">
            {(
              [
                ['quality', 'Tiêu chuẩn chất lượng'],
                ['delivery_place', 'Địa điểm giao hàng'],
                ['payment', 'Hình thức thanh toán'],
                ['invoice', 'Chứng từ thanh toán'],
                ['lead_time', 'Thời gian giao hàng'],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="flex flex-col gap-1 text-xs text-zinc-500">
                {label}
                <input
                  maxLength={1000}
                  value={terms[k]}
                  onChange={(e) => setTerms((t) => ({ ...t, [k]: e.target.value }))}
                  className={field}
                />
              </label>
            ))}
            <label className="flex flex-col gap-1 text-xs text-zinc-500">
              Chữ ký giữa phiếu
              <input
                maxLength={100}
                value={signerRole}
                onChange={(e) => setSignerRole(e.target.value)}
                className={field}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-zinc-500 sm:col-span-2">
              Ghi chú đơn
              <input
                maxLength={2000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className={field}
              />
            </label>
          </div>
        )}
      </section>

      {/* ── Thanh tổng dính đáy ── */}
      <div className="sticky bottom-0 z-20 -mx-1 rounded-xl border border-zinc-200 bg-white/95 px-3.5 py-2.5 shadow-lg backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
          <span className="text-zinc-400">
            Cộng tiền hàng{' '}
            <b className="text-zinc-700 tabular-nums dark:text-zinc-200">
              {num(subtotal)}
            </b>
          </span>
          {meta.hasDiscount && (
            <label className="flex items-center gap-1.5 text-zinc-400">
              Chiết khấu
              <input
                type="number"
                min="0"
                step="1000"
                value={discount}
                onChange={(e) =>
                  setDiscount(e.target.value === '' ? '' : Number(e.target.value))
                }
                className="h-[28px] w-[110px] rounded-md border border-zinc-300 px-2 text-right text-[13px] dark:border-zinc-700 dark:bg-zinc-900"
                aria-label="Chiết khấu"
              />
            </label>
          )}
          <label className="flex items-center gap-1.5 text-zinc-400">
            VAT %
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={vat}
              onChange={(e) =>
                setVat(e.target.value === '' ? '' : Number(e.target.value))
              }
              className="h-[28px] w-[62px] rounded-md border border-zinc-300 px-2 text-right text-[13px] dark:border-zinc-700 dark:bg-zinc-900"
              aria-label="VAT %"
            />
            <select
              value={inclVat ? 'in' : 'ex'}
              onChange={(e) => setInclVat(e.target.value === 'in')}
              className="h-[28px] rounded-md border border-zinc-300 px-1 text-[12px] dark:border-zinc-700 dark:bg-zinc-900"
              aria-label="Đơn giá đã gồm VAT chưa"
            >
              <option value="in">đã gồm</option>
              <option value="ex">chưa gồm</option>
            </select>
            <b className="text-zinc-700 tabular-nums dark:text-zinc-200">
              {num(vatAmount)}
            </b>
          </label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="h-[28px] rounded-md border border-zinc-300 px-1 text-[12px] dark:border-zinc-700 dark:bg-zinc-900"
            aria-label="Tiền tệ"
          >
            <option value="VND">VND</option>
            <option value="USD">USD</option>
          </select>

          <span className="ml-auto flex items-baseline gap-2">
            <span className="text-zinc-400">Tổng thanh toán</span>
            <b className="text-lg tabular-nums">{num(grandTotal)}</b>
          </span>
          {problem && (
            <span className="text-[12px] text-amber-600 dark:text-amber-500">
              {problem}
            </span>
          )}
          <button
            type="button"
            disabled={busy || !!problem}
            onClick={() => void submit()}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {busy && <Spinner size={14} />}
            {busy ? 'Đang lưu…' : isEdit ? 'Lưu thay đổi' : 'Tạo đơn → gửi GĐ duyệt'}
          </button>
        </div>
      </div>
    </div>
  )
}
