'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/erp/PageHeader'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'
import { Modal } from '@/components/Modal'
import {
  type ConversionProfile,
  PROFILE_SHORT,
  hasQty2,
  suggestQty2,
  profileLineMapping,
} from '@/lib/material-profile'
import { QuickAddMaterial } from './QuickAddMaterial'

type SupplierOption = {
  id: string
  name: string
  rating: string | null
  lead_time_days: number | null
  payment_terms: string | null
  phone: string | null
  open_po_count: number
}
type LsxOption = { id: string; code: string; order_code: string; customer_name: string }
type MaterialOption = {
  id: string
  code: string
  name: string
  unit: string
  on_hand: number
  min_stock: number
  /** Quy cách (0056) — tự điền vào dòng đơn khi chọn. */
  spec?: string | null
  /** Loại quy đổi A/B/C (0055) — lái ô nhập của dòng. */
  conversion_profile: ConversionProfile
  /** Giá đv kép (0053): 'kg'/'m²' = giá tính theo đv này thay vì ĐVT mua. */
  price_unit: string | null
  /** B: hệ số cứng; C: định mức kg/đơn-vị-đặt. */
  unit2_factor: number | null
  /** Tự-điền lên đơn (0055). */
  vat_rate?: number | null
  default_supplier_id?: string | null
  last_purchase_price?: number | null
}

/** Nhu cầu vật tư của LSX từ BOM/bảng chi tiết — API /dept/supply/needs. */
type Need = {
  material_id: string
  material_code: string
  material_name: string
  unit: string
  qty_needed: number
  qty_issued: number
  qty_remaining: number
  on_hand: number
  reserved_others: number
  available: number
  ordered: number
  pending: number
  suggest: number
  enough: boolean
  has_pending: boolean
  kg_needed?: number | null
  bars_needed?: number | null
  incomplete?: boolean
  source?: 'components' | 'bom'
}

/** Gợi ý mua bù tồn cho PO ngoài LSX (nghiệp vụ ①) — API /dept/supply/reorder. */
type ReorderItem = {
  material_id: string
  code: string
  name: string
  unit: string
  available: number
  ordered: number
  pending: number
  threshold: number
  position: number
  suggest: number
  has_pending: boolean
  default_supplier_id: string | null
}

/** So giá khi soạn đơn (FR-SUP-06) — API /dept/supply/price-compare. */
type PriceOffer = {
  supplier_id: string
  supplier_name: string
  price: number
  currency: string
  valid_from: string
  note: string | null
}
type PriceCompareEntry = {
  material_id: string
  offers: PriceOffer[]
  last_purchase: {
    unit_price: number
    currency: string
    po_code: string
    supplier_name: string
    at: string
  } | null
}

/** Dòng CHỨNG TỪ — chỉ dữ liệu của phiếu đặt; cần/tồn sống ở vùng nhu cầu. */
type Line = {
  material_id: string
  code: string
  name: string
  unit: string
  on_hand: number
  min_stock: number
  profile: ConversionProfile
  price_unit: string | null
  unit2_factor: number | null
  spec: string
  qty: number | ''
  qty2: number | ''
  qty2Touched: boolean
  price: number | ''
  note: string
  /** Thông tin quyết định SL đặt (chỉ hiển thị, không auto-điền). */
  suggest: number | null
  qty_needed: number | null
  available: number | null
}

const inputCls =
  'h-[30px] w-full rounded-md border border-zinc-300 px-2 text-[13px] focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'
const num = (n: number) => n.toLocaleString('vi-VN')
const GRADE_BG: Record<string, string> = {
  A: 'bg-green-600',
  B: 'bg-blue-600',
  C: 'bg-amber-500',
  D: 'bg-red-600',
}

/**
 * BÀN SOẠN đơn đặt vật tư — 3 vùng theo trình tự nghiệp vụ (mockup đã duyệt):
 *   A (trái)  : nhu cầu từ BOM của LSX (cần/khả dụng/đề xuất) + tìm kho + VT mới
 *   B (giữa)  : bảng chứng từ sạch như phiếu in, gợi ý giá ngay dưới ô nhập
 *   C (phải)  : NCC + tổng VAT + checklist + xem trước phiếu in + gửi duyệt
 * Tách "tính nhu cầu" khỏi "chứng từ" — mô hình requisition → PO của ERP thật.
 * Đường tạo PO duy nhất (modal tạo cũ trong danh sách đã bỏ).
 */
export function PoCreateForm({
  suppliers,
  lsxs,
  materials,
  defaultSupplierId,
}: {
  suppliers: SupplierOption[]
  lsxs: LsxOption[]
  materials: MaterialOption[]
  defaultSupplierId?: string
}) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  /** 'lsx' = PO theo lệnh SX; 'standalone' = PO ngoài LSX (tiêu hao/dùng chung — 0076). */
  const [poType, setPoType] = useState<'lsx' | 'standalone'>('lsx')
  const [lsxId, setLsxId] = useState('')
  const [supplierId, setSupplierId] = useState(
    defaultSupplierId && suppliers.some((s) => s.id === defaultSupplierId)
      ? defaultSupplierId
      : '',
  )
  const [expectedAt, setExpectedAt] = useState('')
  const [currency, setCurrency] = useState('VND')
  const [vat, setVat] = useState('')
  const [inclVat, setInclVat] = useState('true')
  const [terms, setTerms] = useState('')
  const [note, setNote] = useState('')

  const [needs, setNeeds] = useState<Need[]>([])
  const [loadingNeeds, setLoadingNeeds] = useState(false)
  // Ngoài LSX: gợi ý mua bù tồn (nạp 1 lần khi chuyển chế độ).
  const [reorder, setReorder] = useState<ReorderItem[] | null>(null)
  const [loadingReorder, setLoadingReorder] = useState(false)
  const [priceMap, setPriceMap] = useState<Record<string, PriceCompareEntry>>({})
  const [lines, setLines] = useState<Line[]>([])
  const [filter, setFilter] = useState('')
  const [preview, setPreview] = useState(false)

  const matById = useMemo(() => new Map(materials.map((m) => [m.id, m])), [materials])
  const usedIds = useMemo(() => new Set(lines.map((l) => l.material_id)), [lines])
  const lsx = lsxs.find((l) => l.id === lsxId)
  const supplier = suppliers.find((s) => s.id === supplierId)

  // ── Vùng A: nhu cầu + tìm kho ────────────────────────────────────────
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
      void loadPrices(data.needs.map((n) => n.material_id))
    } catch (e) {
      toast.error('Không tải được nhu cầu', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setLoadingNeeds(false)
    }
  }

  /** Nạp so giá cho vật tư chưa có trong cache — lỗi thì im lặng (chỉ là gợi ý). */
  async function loadPrices(ids: string[]) {
    const missing = [...new Set(ids)].filter((id) => id && !priceMap[id])
    if (missing.length === 0) return
    try {
      const data = await api<{ entries: PriceCompareEntry[] }>(
        `/api/dept/supply/price-compare?material_ids=${missing.join(',')}`,
      )
      setPriceMap((m) => {
        const next = { ...m }
        for (const e of data.entries) next[e.material_id] = e
        return next
      })
    } catch {
      /* người mua vẫn nhập giá tay được */
    }
  }

  const offerFor = (materialId: string, sid = supplierId) =>
    priceMap[materialId]?.offers.find((o) => o.supplier_id === sid)

  /**
   * Thêm 1 dòng. CHỌN VẬT TƯ CHỈ TỰ ĐIỀN QUY CÁCH — nhân viên tự nhập SL đặt &
   * đơn giá; SL tính giá (kg) + thành tiền hệ thống tự tính. Không auto-điền
   * giá/VAT/NCC. `need` (nếu có từ BOM) chỉ để HIỂN THỊ gợi ý, không ghi vào ô.
   */
  function pushLine(
    m: MaterialOption,
    need?: {
      suggest?: number
      qty_needed?: number
      available?: number
      kg_needed?: number | null
    },
  ) {
    if (usedIds.has(m.id)) return
    setLines((ls) => [
      ...ls,
      {
        material_id: m.id,
        code: m.code,
        name: m.name,
        unit: m.unit,
        on_hand: m.on_hand,
        min_stock: m.min_stock,
        profile: m.conversion_profile,
        price_unit: m.price_unit,
        unit2_factor: m.unit2_factor,
        spec: m.spec ?? '', // ⭐ tự điền quy cách
        qty: '', // nhân viên nhập
        qty2: '', // nhân viên tự tính & nhập (vật tư cần quy đổi)
        qty2Touched: false,
        price: '', // nhân viên nhập
        note: '',
        suggest: need?.suggest ?? null,
        qty_needed: need?.qty_needed ?? null,
        available: need?.available ?? null,
      },
    ])
    void loadPrices([m.id]) // nạp gợi ý giá để HIỆN chip (không tự điền)
  }

  function addFromNeed(n: Need) {
    const m = matById.get(n.material_id)
    pushLine(
      m ?? {
        id: n.material_id,
        code: n.material_code,
        name: n.material_name,
        unit: n.unit,
        on_hand: n.on_hand,
        min_stock: 0,
        conversion_profile: 'A',
        price_unit: null,
        unit2_factor: null,
      },
      {
        suggest: n.suggest,
        qty_needed: n.qty_needed,
        available: n.available,
        kg_needed: n.kg_needed,
      },
    )
  }

  function addAllSuggested() {
    for (const n of needs)
      if (n.suggest > 0 && !usedIds.has(n.material_id)) addFromNeed(n)
  }

  // ── Vùng B: chứng từ ─────────────────────────────────────────────────
  function setLine(i: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }
  function setQty(i: number, raw: string) {
    // Chỉ set SL đặt. Cột SL tính giá (kg/m²) do nhân viên tự tính & nhập.
    const qty = raw === '' ? '' : Number(raw)
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, qty } : l)))
  }
  function removeLine(i: number) {
    setLines((ls) => ls.filter((_, idx) => idx !== i))
  }

  /** Đổi NCC → tự áp giá chào hiện hành vào các dòng đang trống giá. */
  function selectSupplier(id: string) {
    setSupplierId(id)
    if (!id) return
    setLines((ls) =>
      ls.map((l) => {
        if (l.price !== '') return l
        const offer = offerFor(l.material_id, id)
        return offer ? { ...l, price: offer.price } : l
      }),
    )
  }

  /** Thành tiền dòng — B/C: SL tính giá × giá; A: SL đặt × giá. */
  function lineAmount(l: Line): number {
    const price = Number(l.price) || 0
    if (hasQty2(l.profile)) return (Number(l.qty2) || 0) * price
    return (Number(l.qty) || 0) * price
  }

  const subtotal = lines.reduce((s, l) => s + lineAmount(l), 0)
  const vatRate = vat.trim() === '' ? 0 : Number(vat) || 0
  const priceIncludesVat = inclVat === 'true'
  const vatAmount = priceIncludesVat
    ? Math.round((subtotal * vatRate) / (100 + vatRate))
    : Math.round((subtotal * vatRate) / 100)
  const grandTotal = priceIncludesVat ? subtotal : subtotal + vatAmount

  const linesOk =
    lines.length > 0 &&
    lines.every(
      (l) =>
        l.qty !== '' &&
        Number(l.qty) > 0 &&
        (!hasQty2(l.profile) || (l.qty2 !== '' && Number(l.qty2) > 0)),
    )
  const invalid = (poType === 'lsx' && !lsxId) || !supplierId || !linesOk

  /** Đổi loại đơn: sang "ngoài LSX" thì bỏ LSX + nhu cầu BOM, nạp gợi ý bù tồn. */
  function selectPoType(t: 'lsx' | 'standalone') {
    setPoType(t)
    if (t === 'standalone') {
      setLsxId('')
      setNeeds([])
      if (reorder === null) void loadReorder()
    }
  }

  /** Vật tư dưới ngưỡng đặt lại (①) — lỗi thì im lặng, vẫn tìm kho tay được. */
  async function loadReorder() {
    setLoadingReorder(true)
    try {
      const data = await api<{ items: ReorderItem[] }>('/api/dept/supply/reorder')
      setReorder(data.items)
      void loadPrices(data.items.map((i) => i.material_id))
    } catch {
      setReorder([])
    } finally {
      setLoadingReorder(false)
    }
  }

  function addFromReorder(it: ReorderItem) {
    const m = matById.get(it.material_id)
    if (!m) return
    pushLine(m, { suggest: it.suggest, available: it.available })
  }

  function addAllReorder() {
    for (const it of reorder ?? []) {
      if (it.suggest > 0 && !usedIds.has(it.material_id)) addFromReorder(it)
    }
  }

  // Giá khớp chào NCC — informational, không chặn gửi.
  const offMatch = lines.filter((l) => {
    const o = offerFor(l.material_id)
    return o && l.price !== '' && Number(l.price) !== o.price
  }).length

  const needSuggestCount = needs.filter((n) => n.suggest > 0).length
  const offerCount = supplierId ? needs.filter((n) => offerFor(n.material_id)).length : 0

  // Lọc vùng A: nhu cầu khớp filter + vật tư kho ngoài BOM (tối đa 6 gợi ý).
  const q = filter.trim().toLowerCase()
  const reorderItems = poType === 'standalone' ? (reorder ?? []) : []
  const filteredReorder = q
    ? reorderItems.filter((i) => `${i.code} ${i.name}`.toLowerCase().includes(q))
    : reorderItems
  const needIds = new Set(
    poType === 'lsx'
      ? needs.map((n) => n.material_id)
      : reorderItems.map((i) => i.material_id),
  )
  const filteredNeeds = q
    ? needs.filter((n) =>
        `${n.material_code} ${n.material_name}`.toLowerCase().includes(q),
      )
    : needs
  const stockMatches = q
    ? materials
        .filter(
          (m) =>
            !needIds.has(m.id) &&
            !usedIds.has(m.id) &&
            `${m.code} ${m.name}`.toLowerCase().includes(q),
        )
        .slice(0, 6)
    : []

  async function submit() {
    if (invalid || busy) return
    setBusy(true)
    try {
      const { po } = await api<{ po: { code: string } }>('/api/dept/supply/pos', {
        method: 'POST',
        body: {
          production_order_id: poType === 'lsx' ? lsxId : null,
          supplier_id: supplierId,
          currency,
          vat_rate: vat.trim() ? Number(vat) : null,
          price_includes_vat: priceIncludesVat,
          expected_at: expectedAt || null,
          terms: terms.trim() || null,
          note: note.trim() || null,
          lines: lines.map((l) => {
            const { price_basis, unit2 } = profileLineMapping(l.profile, l.price_unit)
            return {
              material_id: l.material_id,
              qty_ordered: Number(l.qty),
              unit_price: l.price === '' ? null : Number(l.price),
              price_basis,
              spec: l.spec.trim() || null,
              qty2: hasQty2(l.profile) && l.qty2 !== '' ? Number(l.qty2) : null,
              unit2,
              note: l.note.trim() || null,
            }
          }),
        },
      })
      toast.success(`Đã tạo ${po.code}`, 'Đơn đang chờ Giám đốc duyệt')
      router.push('/planning/pos')
      router.refresh()
    } catch (err) {
      toast.error('Tạo đơn thất bại', err instanceof ApiError ? err.message : 'Có lỗi')
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <TopProgressBar active={busy} />
      <PageHeader
        breadcrumbs={[
          { label: 'Kế hoạch - Cung ứng', href: '/planning' },
          { label: 'Đơn đặt vật tư', href: '/planning/pos' },
          { label: 'Tạo đơn đặt' },
        ]}
        title="Tạo đơn đặt vật tư"
        description="Theo LSX: chọn lệnh → thêm từ nhu cầu BOM. Ngoài LSX: mua tiêu hao/dùng chung, tìm thẳng từ kho. Chọn vật tư tự điền cấu hình theo Loại quy đổi A/B/C — chỉ nhập SL, kg cân thực, đơn giá. Mỗi đơn = 1 NCC."
        actions={
          <Link
            href="/planning/pos"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            ← Về danh sách
          </Link>
        }
      />

      {/* Bối cảnh: loại đơn + LSX + NCC + hẹn giao */}
      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        {/* Loại đơn: theo lệnh SX / ngoài LSX (0076) */}
        <div className="mb-3 inline-flex rounded-lg border border-zinc-200 p-0.5 text-[13px] dark:border-zinc-700">
          {(
            [
              ['lsx', 'Theo lệnh sản xuất'],
              ['standalone', 'Ngoài LSX (tiêu hao / dùng chung)'],
            ] as const
          ).map(([t, label]) => (
            <button
              key={t}
              type="button"
              onClick={() => selectPoType(t)}
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
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_150px]">
          {poType === 'lsx' ? (
            <label className="flex flex-col gap-1 text-sm">
              <span>
                LSX <span className="text-red-500">*</span>
              </span>
              <select
                value={lsxId}
                onChange={(e) => void selectLsx(e.target.value)}
                className={inputCls}
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
                  {needs.length > 0 &&
                    ` · ${needs.length} vật tư trong BOM · ${needSuggestCount} cần mua`}
                </span>
              )}
            </label>
          ) : (
            <div className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-500">Loại đơn</span>
              <div className="flex h-[30px] items-center rounded-md border border-dashed border-zinc-300 px-2 text-[13px] text-zinc-500 dark:border-zinc-700">
                Ngoài LSX — không gắn lệnh sản xuất
              </div>
              <span className="text-xs text-zinc-400">
                Mua vật tư tiêu hao/dùng chung, bù tồn kho. Tìm vật tư ở vùng A.
              </span>
            </div>
          )}
          <label className="flex flex-col gap-1 text-sm">
            <span>
              Nhà cung cấp <span className="text-red-500">*</span>
            </span>
            <select
              value={supplierId}
              onChange={(e) => selectSupplier(e.target.value)}
              className={inputCls}
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
                {offerCount > 0 && (
                  <b className="text-sky-600 dark:text-sky-400">
                    {' '}
                    · có giá chào {offerCount} vật tư — tự điền vào dòng trống
                  </b>
                )}
              </span>
            )}
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Hẹn giao
            <input
              type="date"
              value={expectedAt}
              onChange={(e) => setExpectedAt(e.target.value)}
              className={inputCls}
            />
          </label>
        </div>
      </section>

      {/* Xếp dọc full-width: A (nhu cầu) → B (chứng từ) → tóm tắt. Bảng không trượt ngang. */}
      <div className="flex flex-col gap-3.5">
        {/* ── A: NGUỒN NHU CẦU ── */}
        <section className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-2 border-b border-zinc-100 px-3.5 py-2.5 dark:border-zinc-800">
            <ZoneBadge>A</ZoneBadge>
            <b className="text-[13px]">
              {poType === 'lsx' ? 'Nhu cầu từ LSX' : 'Cần mua bù tồn'}
            </b>
            {poType === 'lsx' && needs.length > 0 && (
              <span className="ml-auto text-[11px] text-zinc-400">
                {needSuggestCount} cần mua / {needs.length}
              </span>
            )}
            {poType === 'standalone' && reorderItems.length > 0 && (
              <span className="ml-auto text-[11px] text-zinc-400">
                {reorderItems.length} vật tư dưới ngưỡng đặt lại
              </span>
            )}
          </div>
          <div className="p-3 pb-0">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="🔍 Lọc / tìm thêm từ kho…"
              className={inputCls}
            />
          </div>
          <div className="mt-2 max-h-[300px] overflow-y-auto p-3 pt-0">
            {poType === 'lsx' && !lsxId && (
              <p className="py-5 text-center text-xs text-zinc-400">
                Chưa chọn LSX — gõ tên/mã ở ô trên để tìm vật tư từ kho, hoặc chọn LSX để
                xem nhu cầu BOM.
              </p>
            )}
            {(loadingNeeds || loadingReorder) && (
              <p className="py-5 text-center text-xs text-zinc-400">Đang tải nhu cầu…</p>
            )}
            {poType === 'lsx' && lsxId && !loadingNeeds && needs.length === 0 && (
              <p className="py-5 text-center text-xs text-zinc-400">
                LSX chưa có bảng chi tiết/BOM — tìm vật tư từ kho ở ô trên.
              </p>
            )}
            {poType === 'standalone' && !loadingReorder && reorderItems.length === 0 && (
              <p className="py-5 text-center text-xs text-zinc-400">
                Không có vật tư nào dưới ngưỡng đặt lại 👍 — cần gì thì gõ tên/mã ở ô trên
                để tìm từ kho.
              </p>
            )}
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredReorder.map((it) => {
                const added = usedIds.has(it.material_id)
                return (
                  <div
                    key={it.material_id}
                    className={
                      'flex items-center gap-2 rounded-lg border px-2.5 py-2 ' +
                      (added
                        ? 'border-green-200 bg-green-50/60 dark:border-green-900 dark:bg-green-950/20'
                        : 'border-zinc-200 dark:border-zinc-800')
                    }
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold" title={it.name}>
                        {it.name}
                      </div>
                      <div className="font-mono text-[10px] text-zinc-400">
                        {it.code} · KD {num(it.available)} / ngưỡng {num(it.threshold)}
                        {it.ordered > 0 && ` · đang về ${num(it.ordered)}`}
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {it.has_pending && (
                          <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-600 dark:bg-amber-950/50 dark:text-amber-500">
                            có PO chờ duyệt
                          </span>
                        )}
                        {supplierId && it.default_supplier_id === supplierId && (
                          <span className="rounded-full bg-violet-50 px-1.5 py-0.5 text-[9px] font-semibold text-violet-600 dark:bg-violet-950/50 dark:text-violet-400">
                            NCC đang chọn
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-[10px] text-zinc-400">
                      đề xuất
                      <div className="text-xs font-bold text-zinc-700 tabular-nums dark:text-zinc-200">
                        {num(it.suggest)} {it.unit}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={added}
                      onClick={() => addFromReorder(it)}
                      className={
                        'grid h-6 w-6 shrink-0 place-items-center rounded-md border text-sm font-bold ' +
                        (added
                          ? 'border-green-200 bg-green-50 text-green-600 dark:border-green-900 dark:bg-green-950/50'
                          : 'border-zinc-300 text-sky-600 hover:border-sky-400 hover:bg-sky-50 dark:border-zinc-700 dark:hover:bg-sky-950/40')
                      }
                      aria-label={added ? 'Đã thêm' : `Thêm ${it.name}`}
                    >
                      {added ? '✓' : '+'}
                    </button>
                  </div>
                )
              })}
              {filteredNeeds.map((n) => {
                const added = usedIds.has(n.material_id)
                return (
                  <div
                    key={n.material_id}
                    className={
                      'flex items-center gap-2 rounded-lg border px-2.5 py-2 ' +
                      (added
                        ? 'border-green-200 bg-green-50/60 dark:border-green-900 dark:bg-green-950/20'
                        : 'border-zinc-200 dark:border-zinc-800')
                    }
                  >
                    <div className="min-w-0 flex-1">
                      <div
                        className="truncate text-xs font-semibold"
                        title={n.material_name}
                      >
                        {n.material_name}
                      </div>
                      <div className="font-mono text-[10px] text-zinc-400">
                        {n.material_code} · cần {num(n.qty_needed)} · khả dụng{' '}
                        {num(n.available)}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      {n.suggest > 0 ? (
                        <div className="text-[10px] text-zinc-400">
                          đề xuất
                          <div className="text-xs font-bold text-zinc-700 tabular-nums dark:text-zinc-200">
                            {num(n.suggest)} {n.unit}
                          </div>
                        </div>
                      ) : n.ordered > 0 ? (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:bg-amber-950/50 dark:text-amber-500">
                          PO đang về
                        </span>
                      ) : (
                        <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-600 dark:bg-green-950/50 dark:text-green-400">
                          tồn đủ
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={added}
                      onClick={() => addFromNeed(n)}
                      className={
                        'grid h-6 w-6 shrink-0 place-items-center rounded-md border text-sm font-bold ' +
                        (added
                          ? 'border-green-200 bg-green-50 text-green-600 dark:border-green-900 dark:bg-green-950/50'
                          : 'border-zinc-300 text-sky-600 hover:border-sky-400 hover:bg-sky-50 dark:border-zinc-700 dark:hover:bg-sky-950/40')
                      }
                      aria-label={added ? 'Đã thêm' : `Thêm ${n.material_name}`}
                    >
                      {added ? '✓' : '+'}
                    </button>
                  </div>
                )
              })}
              {stockMatches.length > 0 && (
                <>
                  <div className="col-span-full pt-1 text-[10px] font-semibold tracking-wide text-zinc-400 uppercase">
                    Từ kho (ngoài BOM)
                  </div>
                  {stockMatches.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center gap-2 rounded-lg border border-zinc-200 px-2.5 py-2 dark:border-zinc-800"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-semibold" title={m.name}>
                          {m.name}
                        </div>
                        <div className="font-mono text-[10px] text-zinc-400">
                          {m.code} · tồn {num(m.on_hand)} {m.unit}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => pushLine(m)}
                        className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-zinc-300 text-sm font-bold text-sky-600 hover:border-sky-400 hover:bg-sky-50 dark:border-zinc-700 dark:hover:bg-sky-950/40"
                        aria-label={`Thêm ${m.name}`}
                      >
                        +
                      </button>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2 border-t border-zinc-100 p-3 dark:border-zinc-800">
            {poType === 'lsx' && needSuggestCount > 0 && (
              <button
                type="button"
                onClick={addAllSuggested}
                className="rounded-md border border-dashed border-zinc-300 py-1.5 text-xs text-zinc-600 hover:border-sky-400 hover:text-sky-600 dark:border-zinc-700 dark:text-zinc-400"
              >
                ＋ Thêm tất cả đề xuất ({needSuggestCount})
              </button>
            )}
            {poType === 'standalone' && reorderItems.length > 0 && (
              <button
                type="button"
                onClick={addAllReorder}
                className="rounded-md border border-dashed border-zinc-300 py-1.5 text-xs text-zinc-600 hover:border-sky-400 hover:text-sky-600 dark:border-zinc-700 dark:text-zinc-400"
              >
                ＋ Thêm tất cả cần bù tồn ({reorderItems.length})
              </button>
            )}
            <QuickAddMaterial
              existing={materials}
              onCreated={(m) =>
                pushLine({
                  id: m.id,
                  code: m.code,
                  name: m.name,
                  unit: m.unit,
                  on_hand: 0,
                  min_stock: 0,
                  spec: m.spec,
                  conversion_profile: m.conversion_profile,
                  price_unit: m.price_unit,
                  unit2_factor: m.unit2_factor,
                })
              }
            />
          </div>
        </section>

        {/* ── B: CHỨNG TỪ ── */}
        <section className="min-w-0 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-2 border-b border-zinc-100 px-3.5 py-2.5 dark:border-zinc-800">
            <ZoneBadge>B</ZoneBadge>
            <b className="text-[13px]">Dòng đặt hàng</b>
            <span className="ml-auto text-[11px] text-zinc-400">{lines.length} dòng</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[940px] text-[13px] tabular-nums">
              <thead className="bg-zinc-50 dark:bg-zinc-900/50">
                <tr className="text-left text-[10px] text-zinc-500 uppercase">
                  <th className="w-7 py-2 pl-3 text-center">#</th>
                  <th className="min-w-[200px] py-2 pr-2">Vật tư</th>
                  <th className="w-[110px] py-2 pr-2">Quy cách</th>
                  <th className="w-[104px] py-2 pr-2 text-right">Tồn kho</th>
                  <th className="w-[84px] py-2 pr-2 text-right">SL đặt</th>
                  <th className="w-[118px] py-2 pr-2 text-right">SL tính giá</th>
                  <th className="w-[118px] py-2 pr-2 text-right">Đơn giá</th>
                  <th className="w-[100px] py-2 pr-2 text-right">Thành tiền</th>
                  <th className="w-[92px] py-2 pr-2">Ghi chú</th>
                  <th className="w-7 py-2" />
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-xs text-zinc-400">
                      Bấm “+” ở vùng nhu cầu bên trái để đưa vật tư vào đơn.
                    </td>
                  </tr>
                )}
                {lines.map((l, i) => {
                  const entry = priceMap[l.material_id]
                  const offer = offerFor(l.material_id)
                  const last = entry?.last_purchase
                  const priceMatches =
                    offer && l.price !== '' && Number(l.price) === offer.price
                  const lineTotal = lineAmount(l)
                  return (
                    <tr
                      key={l.material_id}
                      className="border-t border-zinc-100 align-top dark:border-zinc-900"
                    >
                      <td className="py-2 pl-3 text-center text-xs text-zinc-400">
                        <div className="flex h-[30px] items-center justify-center">
                          {i + 1}
                        </div>
                      </td>
                      <td className="py-2 pr-2">
                        <div className="text-xs font-semibold" title={l.name}>
                          {l.name}
                        </div>
                        <div className="mt-0.5 font-mono text-[10px] text-zinc-400">
                          {l.code} · ĐVT: {l.unit} · tồn {num(l.on_hand)}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <span
                            className={
                              'rounded px-1.5 py-0.5 text-[9px] font-bold ' +
                              (l.profile === 'A'
                                ? 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                                : l.profile === 'B'
                                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300'
                                  : 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400')
                            }
                            title={`Loại quy đổi ${l.profile} — ${PROFILE_SHORT[l.profile]}`}
                          >
                            {l.profile} · {PROFILE_SHORT[l.profile]}
                          </span>
                          {hasQty2(l.profile) && l.price_unit && (
                            <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[9px] font-semibold text-violet-600 dark:bg-violet-950/50 dark:text-violet-400">
                              giá/{l.price_unit} · nhập {l.price_unit}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          value={l.spec}
                          maxLength={100}
                          placeholder="25×25×1.2…"
                          onChange={(e) => setLine(i, { spec: e.target.value })}
                          className={inputCls}
                          aria-label={`Quy cách ${l.name}`}
                        />
                      </td>
                      {/* Tồn kho — để quyết định SL đặt chính xác */}
                      <td className="py-2 pr-2 text-right">
                        <div className="flex flex-col items-end leading-tight">
                          <span
                            className={
                              'text-[13px] font-semibold ' +
                              (l.min_stock > 0 && l.on_hand < l.min_stock
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-zinc-700 dark:text-zinc-200')
                            }
                          >
                            {num(l.on_hand)}{' '}
                            <span className="text-[10px] font-normal text-zinc-400">
                              {l.unit}
                            </span>
                          </span>
                          {l.min_stock > 0 && (
                            <span className="text-[10px] text-zinc-400">
                              tối thiểu {num(l.min_stock)}
                            </span>
                          )}
                          {l.qty_needed != null && l.qty_needed > 0 && (
                            <span className="text-[10px] whitespace-nowrap text-amber-600 dark:text-amber-500">
                              cần {num(l.qty_needed)}
                              {l.available != null ? ` · KD ${num(l.available)}` : ''}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={l.qty}
                          onChange={(e) => setQty(i, e.target.value)}
                          className={`${inputCls} text-right font-medium`}
                          aria-label={`Số lượng đặt ${l.name}`}
                        />
                        {l.suggest != null && l.suggest > 0 && l.qty === '' && (
                          <button
                            type="button"
                            onClick={() => setQty(i, String(l.suggest))}
                            className="mt-0.5 block w-full text-right text-[10px] text-sky-600 hover:underline dark:text-sky-400"
                            title="Đề xuất từ BOM — bấm để dùng"
                          >
                            đề xuất {num(l.suggest)} ↩
                          </button>
                        )}
                      </td>
                      <td className="py-2 pr-2">
                        {hasQty2(l.profile) ? (
                          (() => {
                            // Vật tư cần quy đổi: nhân viên TỰ TÍNH & nhập kg/m².
                            const hint = suggestQty2(
                              l.profile,
                              l.unit2_factor,
                              l.qty === '' ? null : Number(l.qty),
                            )
                            return (
                              <>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={l.qty2}
                                    onChange={(e) =>
                                      setLine(i, {
                                        qty2:
                                          e.target.value === ''
                                            ? ''
                                            : Number(e.target.value),
                                        qty2Touched: true,
                                      })
                                    }
                                    className={`${inputCls} border-violet-300 text-right font-medium dark:border-violet-800`}
                                    aria-label={`Tổng ${l.price_unit ?? ''} ${l.name}`}
                                    title={
                                      l.unit2_factor
                                        ? `Nhân viên tự tính — tham khảo SL × ${l.unit2_factor} ${l.price_unit}/${l.unit}`
                                        : `Nhập tổng ${l.price_unit} theo báo giá/cân NCC`
                                    }
                                  />
                                  <span className="shrink-0 text-[10px] text-violet-500">
                                    {l.price_unit}
                                  </span>
                                </div>
                                {hint != null && l.qty2 === '' && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setLine(i, { qty2: hint, qty2Touched: true })
                                    }
                                    className="mt-0.5 block w-full text-right text-[10px] text-violet-500 hover:underline"
                                    title={`SL × ${l.unit2_factor} — bấm để dùng, sửa được`}
                                  >
                                    ≈ {num(hint)} ↩
                                  </button>
                                )}
                              </>
                            )
                          })()
                        ) : (
                          <div className="flex h-[30px] items-center justify-end text-zinc-300 dark:text-zinc-600">
                            —
                          </div>
                        )}
                      </td>
                      <td className="py-2 pr-2">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="1"
                            min="0"
                            value={l.price}
                            onChange={(e) =>
                              setLine(i, {
                                price:
                                  e.target.value === '' ? '' : Number(e.target.value),
                              })
                            }
                            className={`${inputCls} text-right`}
                            aria-label={`Đơn giá ${l.name}`}
                          />
                          {l.price_unit && (
                            <span className="shrink-0 text-[10px] text-violet-500">
                              /{l.price_unit}
                            </span>
                          )}
                        </div>
                        {(offer || last) && (
                          <div className="mt-0.5 text-[10px] whitespace-nowrap text-zinc-400">
                            {offer && (
                              <>
                                Chào:{' '}
                                {priceMatches ? (
                                  <b className="text-green-600 dark:text-green-400">
                                    {num(offer.price)} ✓
                                  </b>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setLine(i, { price: offer.price })}
                                    className="font-bold text-sky-600 hover:underline dark:text-sky-400"
                                    title="Bấm để áp giá chào"
                                  >
                                    {num(offer.price)} ↩
                                  </button>
                                )}
                              </>
                            )}
                            {offer && last && ' · '}
                            {last && (
                              <>
                                lần trước{' '}
                                <button
                                  type="button"
                                  onClick={() => setLine(i, { price: last.unit_price })}
                                  className="text-sky-600 hover:underline dark:text-sky-400"
                                  title={`${last.po_code} — ${last.supplier_name}. Bấm để áp`}
                                >
                                  {num(last.unit_price)}
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-2 pr-2 text-right">
                        <div className="flex h-[30px] items-center justify-end font-semibold whitespace-nowrap">
                          {lineTotal > 0 ? (
                            num(lineTotal)
                          ) : (
                            <span className="font-normal text-zinc-300 dark:text-zinc-600">
                              —
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          value={l.note}
                          maxLength={500}
                          placeholder="bộ phận…"
                          onChange={(e) => setLine(i, { note: e.target.value })}
                          className={inputCls}
                          aria-label={`Ghi chú ${l.name}`}
                        />
                      </td>
                      <td className="py-2 pr-1 text-center">
                        <button
                          type="button"
                          onClick={() => removeLine(i)}
                          className="mt-1 rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                          aria-label="Xoá dòng"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {lines.length > 0 && (
                <tfoot>
                  <tr className="border-t border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
                    <td
                      colSpan={7}
                      className="py-2 pr-2 text-right text-[10px] font-semibold text-zinc-500 uppercase"
                    >
                      Tổng cộng ({lines.length} dòng)
                    </td>
                    <td className="py-2 pr-2 text-right font-bold whitespace-nowrap">
                      {num(subtotal)}
                    </td>
                    <td colSpan={2} className="py-2 text-xs text-zinc-400">
                      {currency}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Điều khoản của đơn */}
          <div className="grid gap-3 border-t border-zinc-100 p-3.5 sm:grid-cols-[100px_90px_140px_1fr] dark:border-zinc-800">
            <label className="flex flex-col gap-1 text-xs text-zinc-500">
              Tiền tệ
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className={inputCls}
              >
                <option value="VND">VND</option>
                <option value="USD">USD</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-zinc-500">
              VAT (%)
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                placeholder="10"
                value={vat}
                onChange={(e) => setVat(e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-zinc-500">
              Đơn giá
              <select
                value={inclVat}
                onChange={(e) => setInclVat(e.target.value)}
                className={inputCls}
              >
                <option value="true">Đã gồm VAT</option>
                <option value="false">Chưa gồm VAT</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-zinc-500">
              Điều kiện / bảo hành
              <input
                maxLength={1000}
                placeholder="Bảo hành 24 tháng…"
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-zinc-500 sm:col-span-4">
              Ghi chú đơn
              <input
                maxLength={2000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className={inputCls}
              />
            </label>
          </div>
        </section>
      </div>

      {/* ── TÓM TẮT: thanh full-width dưới bảng (không ép hẹp chứng từ) ── */}
      <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1fr)_280px_300px]">
        <SideCard title="NCC đã chọn">
          {supplier ? (
            <>
              <div className="mb-1.5 flex items-center gap-2">
                <b className="text-[13px]">{supplier.name}</b>
                {supplier.rating && (
                  <span
                    className={`grid h-5 w-5 place-items-center rounded text-[11px] font-bold text-white ${GRADE_BG[supplier.rating] ?? 'bg-zinc-500'}`}
                  >
                    {supplier.rating}
                  </span>
                )}
              </div>
              <SideRow
                k="Lead time"
                v={
                  supplier.lead_time_days != null
                    ? `${supplier.lead_time_days} ngày`
                    : '—'
                }
              />
              <SideRow k="Thanh toán" v={supplier.payment_terms ?? '—'} />
              <SideRow k="PO đang mở" v={String(supplier.open_po_count)} />
            </>
          ) : (
            <p className="text-xs text-zinc-400">Chưa chọn NCC.</p>
          )}
        </SideCard>

        <SideCard title="Tổng đơn">
          <SideRow k="Tạm tính" v={num(subtotal)} />
          <SideRow
            k={
              vatRate
                ? priceIncludesVat
                  ? `VAT ${vatRate}% (đã gồm)`
                  : `VAT ${vatRate}%`
                : 'VAT'
            }
            v={vatRate ? num(vatAmount) : '—'}
          />
          <div className="mt-1.5 flex items-baseline justify-between border-t border-zinc-200 pt-2 dark:border-zinc-800">
            <span className="text-sm font-semibold">Sau VAT</span>
            <span className="text-base font-bold tabular-nums">
              {num(grandTotal)} <span className="text-xs font-medium">{currency}</span>
            </span>
          </div>
        </SideCard>

        <SideCard>
          <Check
            ok={(poType === 'standalone' || !!lsxId) && !!supplierId}
            label={poType === 'lsx' ? 'LSX + NCC đã chọn' : 'NCC đã chọn (đơn ngoài LSX)'}
          />
          <Check
            ok={linesOk}
            label={
              lines.length === 0
                ? 'Thêm ít nhất 1 dòng vật tư'
                : linesOk
                  ? `${lines.length} dòng đủ SL & SL tính giá`
                  : 'Có dòng thiếu SL đặt / SL tính giá'
            }
          />
          <Check
            ok={offMatch === 0}
            label={
              offMatch === 0
                ? 'Giá khớp giá chào NCC'
                : `${offMatch} dòng lệch giá chào (vẫn gửi được)`
            }
          />
          <div className="mt-3 flex flex-col gap-2">
            <button
              type="button"
              disabled={lines.length === 0}
              onClick={() => setPreview(true)}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              🖨 Xem trước phiếu in
            </button>
            <button
              type="button"
              disabled={busy || invalid}
              onClick={() => void submit()}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-sky-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {busy && <Spinner size={14} />}
              {busy ? 'Đang lưu…' : 'Tạo đơn → gửi GĐ duyệt'}
            </button>
          </div>
          <p className="mt-2 text-center text-[11px] text-zinc-400">
            Mỗi đơn = 1 NCC · gắn 1 LSX hoặc ngoài LSX
          </p>
        </SideCard>
      </div>

      {/* Xem trước phiếu in — đúng cột phiếu thật, chưa cần tạo đơn */}
      <Modal
        open={preview}
        onClose={() => setPreview(false)}
        title="Xem trước phiếu đặt hàng"
        maxWidth="sm:max-w-3xl"
      >
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex flex-wrap justify-between gap-2 text-xs text-zinc-500">
            <span>
              Kính gửi:{' '}
              <b className="text-zinc-800 dark:text-zinc-200">
                {supplier?.name ?? '— chưa chọn NCC —'}
              </b>
            </span>
            <span>
              {poType === 'lsx' ? (
                <>
                  LSX: <b className="font-mono">{lsx?.code ?? '—'}</b>
                </>
              ) : (
                'Đơn ngoài LSX'
              )}
              {expectedAt &&
                ` · Hẹn giao: ${new Date(expectedAt).toLocaleDateString('vi-VN')}`}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-zinc-400 text-center text-xs tabular-nums">
              <thead>
                <tr className="font-semibold">
                  <td className="border border-zinc-400 px-1 py-1">STT</td>
                  <td className="border border-zinc-400 px-2">Tên vật tư</td>
                  <td className="border border-zinc-400 px-1">Quy cách</td>
                  <td className="border border-zinc-400 px-1">ĐVT</td>
                  <td className="border border-zinc-400 px-1">SL</td>
                  <td className="border border-zinc-400 px-1">SL quy đổi</td>
                  <td className="border border-zinc-400 px-1">Đơn giá</td>
                  <td className="border border-zinc-400 px-1">Thành tiền</td>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={l.material_id}>
                    <td className="border border-zinc-400 px-1 py-0.5">{i + 1}</td>
                    <td className="border border-zinc-400 px-2 text-left">{l.name}</td>
                    <td className="border border-zinc-400 px-1">{l.spec || ''}</td>
                    <td className="border border-zinc-400 px-1">{l.unit}</td>
                    <td className="border border-zinc-400 px-1">
                      {l.qty === '' ? '' : num(Number(l.qty))}
                    </td>
                    <td className="border border-zinc-400 px-1">
                      {hasQty2(l.profile) && l.qty2 !== ''
                        ? `${num(Number(l.qty2))} ${l.price_unit ?? ''}`
                        : ''}
                    </td>
                    <td className="border border-zinc-400 px-1">
                      {l.price === ''
                        ? ''
                        : `${num(Number(l.price))}${l.price_unit ? `/${l.price_unit}` : ''}`}
                    </td>
                    <td className="border border-zinc-400 px-1">
                      {lineAmount(l) > 0 ? num(lineAmount(l)) : ''}
                    </td>
                  </tr>
                ))}
                <tr className="font-bold">
                  <td colSpan={7} className="border border-zinc-400 px-2 text-right">
                    Tổng cộng
                  </td>
                  <td className="border border-zinc-400 px-1">{num(subtotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-zinc-400">
            Phiếu in chính thức (mẫu đầy đủ chữ ký) có ở chi tiết đơn sau khi tạo.
          </p>
        </div>
      </Modal>
    </div>
  )
}

function ZoneBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="grid h-5 w-5 place-items-center rounded-full bg-violet-600 text-[11px] font-bold text-white">
      {children}
    </span>
  )
}

function SideCard({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      {title && (
        <div className="border-b border-zinc-100 px-4 py-2 text-[11px] font-semibold tracking-wide text-zinc-400 uppercase dark:border-zinc-800">
          {title}
        </div>
      )}
      <div className="px-4 py-3">{children}</div>
    </div>
  )
}

function SideRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2 py-1 text-[12.5px]">
      <span className="text-zinc-400">{k}</span>
      <span className="min-w-0 truncate text-right font-medium tabular-nums">{v}</span>
    </div>
  )
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 py-0.5 text-xs">
      <span
        className={
          ok
            ? 'font-bold text-green-600 dark:text-green-400'
            : 'text-zinc-300 dark:text-zinc-600'
        }
      >
        {ok ? '✓' : '○'}
      </span>
      <span className={ok ? 'text-zinc-600 dark:text-zinc-300' : 'text-zinc-400'}>
        {label}
      </span>
    </div>
  )
}
