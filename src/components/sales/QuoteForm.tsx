'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/Badge'
import { api, apiErrorText } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/erp/PageHeader'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'
import { QuickAddProduct, type QuickProduct } from '@/components/sales/QuickAddProduct'

/** Quy cách đóng gói (từ Kỹ thuật) — mọi field optional, thiếu = chưa khai. */
export type Packing = {
  l_cm?: number
  w_cm?: number
  h_cm?: number
  carton_l_cm?: number
  carton_w_cm?: number
  carton_h_cm?: number
  qty_per_carton?: number
  loading_40hc?: number
  nw_kg?: number
  gw_kg?: number
  pack_unit_label?: string
}

export type ProductPick = {
  id: string
  code: string
  name: string
  unit: string
  customer_id: string | null
  customer_item_code: string | null
  bom_status: 'none' | 'drawing' | 'done'
  description_en: string | null
  has_image: boolean
  packing: Packing
}

export type CustomerOption = {
  id: string
  name: string
  default_currency: string | null
  default_price_term: string | null
  default_payment_terms: string | null
}

export type QuoteInitial = {
  id: string
  code: string
  customer_id: string
  currency: string
  valid_from: string | null
  valid_to: string | null
  price_term: string | null
  payment_terms: string | null
  note: string | null
}

export type QuoteLineInitial = {
  product_id: string
  unit_price: number
  discount_pct: number | null
  note: string | null
}

type LineDraft = { code: string; name: string; unit: string; itemCode: string }
type LineRow = {
  key: number
  productId: string
  draft: LineDraft | null
  unitPrice: number | ''
  discount: number | ''
  note: string
}

const BOM_LABEL = { none: 'Chưa có BOM', drawing: 'Đang vẽ', done: 'Đã vẽ' } as const
const BOM_TONE = { none: 'gray', drawing: 'amber', done: 'green' } as const

const cls =
  'w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'

/** "60.2×58.1×92.4" từ 3 chiều — thiếu bất kỳ chiều nào = null. */
function dimStr(a?: number, b?: number, c?: number): string | null {
  return a != null && b != null && c != null ? `${a}×${b}×${c}` : null
}
const cmToInch = (v?: number) => (v != null ? (v / 2.54).toFixed(1) : null)
function inchStr(a?: number, b?: number, c?: number): string | null {
  const [x, y, z] = [cmToInch(a), cmToInch(b), cmToInch(c)]
  return x && y && z ? `${x}×${y}×${z}` : null
}

export function QuoteForm(props: {
  mode: 'create' | 'edit'
  customers: CustomerOption[]
  products: ProductPick[]
  initial?: QuoteInitial
  initialLines?: QuoteLineInitial[]
}) {
  const { mode, customers, initial } = props
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const keyRef = useRef(props.initialLines?.length ?? 0)

  const [customerId, setCustomerId] = useState(initial?.customer_id ?? '')
  const [currency, setCurrency] = useState(initial?.currency ?? 'USD')
  const [priceTerm, setPriceTerm] = useState(initial?.price_term ?? '')
  const [payTerms, setPayTerms] = useState(initial?.payment_terms ?? '')
  const [validFrom, setValidFrom] = useState(initial?.valid_from ?? '')
  const [validTo, setValidTo] = useState(initial?.valid_to ?? '')
  const [note, setNote] = useState(initial?.note ?? '')

  const [productList, setProductList] = useState<ProductPick[]>(props.products)
  const [lines, setLines] = useState<LineRow[]>(() =>
    (props.initialLines ?? []).map((l, i) => ({
      key: i,
      productId: l.product_id,
      draft: null,
      unitPrice: l.unit_price,
      discount: l.discount_pct ?? '',
      note: l.note ?? '',
    })),
  )

  // Giá gần nhất theo khách (tự điền) + giá thị trường (gợi ý).
  const [lastPrices, setLastPrices] = useState<
    Map<string, { unit_price: number; quote_code: string }>
  >(new Map())
  const [marketPrices, setMarketPrices] = useState<
    Map<string, { unit_price: number; currency: string; customer_name: string }>
  >(new Map())

  useEffect(() => {
    api<{
      prices: {
        product_id: string
        unit_price: number
        currency: string
        customer_name: string
      }[]
    }>('/api/dept/sales/quotes/last-prices')
      .then((d) => setMarketPrices(new Map(d.prices.map((x) => [x.product_id, x]))))
      .catch(() => setMarketPrices(new Map()))
  }, [])

  async function loadLastPrices(cid: string) {
    if (!cid) return setLastPrices(new Map())
    try {
      const data = await api<{
        prices: { product_id: string; unit_price: number; quote_code: string }[]
      }>(`/api/dept/sales/quotes/last-prices?customer_id=${cid}`)
      setLastPrices(new Map(data.prices.map((x) => [x.product_id, x])))
    } catch {
      setLastPrices(new Map())
    }
  }

  // Chọn khách khi TẠO MỚI → đổ điều khoản mặc định vào ô còn trống.
  function applyCustomerDefaults(cid: string) {
    if (initial) return
    const c = customers.find((x) => x.id === cid)
    if (!c) return
    if (c.default_currency) setCurrency(c.default_currency)
    if (c.default_price_term) setPriceTerm((v) => v || c.default_price_term!)
    if (c.default_payment_terms) setPayTerms((v) => v || c.default_payment_terms!)
  }

  const productById = useMemo(() => {
    const m = new Map<string, ProductPick>()
    for (const p of productList) m.set(p.id, p)
    return m
  }, [productList])

  const productChoices = useMemo(() => {
    return {
      own: productList.filter((p) => p.customer_id === customerId),
      common: productList.filter((p) => !p.customer_id),
      others: productList.filter((p) => p.customer_id && p.customer_id !== customerId),
    }
  }, [productList, customerId])

  const usedIds = new Set(lines.filter((l) => l.productId).map((l) => l.productId))

  const missing: string[] = []
  if (!customerId) missing.push('chọn khách hàng')
  // Bắt lỗi hiệu lực ngay ở client (đỡ round-trip + báo rõ ràng).
  if (validFrom && validTo && validFrom > validTo)
    missing.push('hiệu lực: “từ ngày” phải ≤ “đến ngày”')
  if (lines.length === 0) missing.push('thêm ít nhất 1 dòng sản phẩm')
  else if (lines.some((l) => !l.productId && !l.draft))
    missing.push('chọn SP cho mọi dòng')
  else if (usedIds.size !== lines.filter((l) => l.productId).length)
    missing.push('SP bị trùng dòng')
  else if (lines.some((l) => l.unitPrice === '')) missing.push('nhập đơn giá')
  const invalid = missing.length > 0

  // Đếm SP thiếu quy cách (nhắc Kỹ thuật trước khi gửi).
  const missingSpecCount = lines.filter((l) => {
    const p = l.productId ? productById.get(l.productId) : undefined
    const pk = p?.packing ?? {}
    return p && !dimStr(pk.l_cm, pk.w_cm, pk.h_cm) && pk.qty_per_carton == null
  }).length

  function setLine(key: number, patch: Partial<LineRow>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }
  function removeLine(key: number) {
    setLines((ls) => ls.filter((l) => l.key !== key))
  }
  function addExistingLine() {
    setLines((ls) => [
      ...ls,
      {
        key: keyRef.current++,
        productId: '',
        draft: null,
        unitPrice: '',
        discount: '',
        note: '',
      },
    ])
  }

  function addQuickProduct(p: QuickProduct, unitPrice: number | null) {
    setProductList((prev) => [
      {
        id: p.id,
        code: p.code,
        name: p.name,
        unit: p.unit,
        customer_id: p.customer_id,
        customer_item_code: p.customer_item_code,
        bom_status: p.bom_status,
        description_en: p.description_en,
        has_image: !!p.image_file_id,
        packing: p.packing ?? {},
      },
      ...prev,
    ])
    setLines((ls) => [
      ...ls,
      {
        key: keyRef.current++,
        productId: p.id,
        draft: null,
        unitPrice: unitPrice ?? '',
        discount: '',
        note: '',
      },
    ])
  }

  async function submit() {
    if (invalid) {
      toast.error('Chưa thể lưu', `Còn thiếu: ${missing.join(', ')}`)
      return
    }
    setBusy(true)
    try {
      const body = {
        customer_id: customerId,
        currency,
        valid_from: validFrom || null,
        valid_to: validTo || null,
        price_term: priceTerm.trim() || null,
        payment_terms: payTerms.trim() || null,
        note: note.trim() || null,
        lines: lines.map((l) => ({
          product_id: l.productId,
          unit_price: Number(l.unitPrice),
          discount_pct: l.discount === '' ? null : Number(l.discount),
          note: l.note.trim() || null,
        })),
      }
      if (mode === 'create') {
        const { quote } = await api<{ quote: { id: string } }>('/api/dept/sales/quotes', {
          method: 'POST',
          body,
        })
        toast.success('Đã lưu báo giá nháp')
        router.push(`/sales/quotes/${quote.id}`)
      } else {
        await api(`/api/dept/sales/quotes/${initial!.id}`, { method: 'PATCH', body })
        toast.success('Đã lưu báo giá', initial!.code)
        router.push(`/sales/quotes/${initial!.id}`)
      }
    } catch (e) {
      toast.error('Chưa lưu được báo giá', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  const backHref = mode === 'edit' ? `/sales/quotes/${initial!.id}` : '/sales/quotes'

  return (
    <div className="flex flex-col gap-5 pb-4">
      <TopProgressBar active={busy} />
      <PageHeader
        breadcrumbs={[
          { label: 'Kinh doanh', href: '/sales' },
          { label: 'Báo giá', href: '/sales/quotes' },
          { label: mode === 'create' ? 'Lập báo giá' : `Sửa ${initial!.code}` },
        ]}
        title={mode === 'create' ? 'Lập báo giá' : `Sửa báo giá ${initial!.code}`}
        description="Báo giá chào theo đơn giá + quy cách sản phẩm. Số lượng nhập ở bước tạo đơn hàng."
        actions={
          <Link
            href={backHref}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            ← Huỷ
          </Link>
        }
      />

      {/* 1. Khách hàng & điều khoản */}
      <Card title="Khách hàng & điều khoản">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <L label="Khách hàng *" span2>
            <select
              value={customerId}
              onChange={(e) => {
                setCustomerId(e.target.value)
                applyCustomerDefaults(e.target.value)
                void loadLastPrices(e.target.value)
              }}
              className={cls}
            >
              <option value="">— chọn khách —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </L>
          <L label="Tiền tệ">
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className={cls}
            >
              <option value="USD">USD</option>
              <option value="VND">VND</option>
              <option value="EUR">EUR</option>
            </select>
          </L>
          <L label="Điều kiện giá (Incoterm)">
            <input
              value={priceTerm}
              onChange={(e) => setPriceTerm(e.target.value)}
              maxLength={100}
              placeholder="FOB Quy Nhon"
              className={cls}
            />
          </L>
          <L label="Hiệu lực từ">
            <input
              type="date"
              value={validFrom}
              onChange={(e) => setValidFrom(e.target.value)}
              className={cls}
            />
          </L>
          <L label="Đến ngày">
            <input
              type="date"
              value={validTo}
              onChange={(e) => setValidTo(e.target.value)}
              className={cls}
            />
          </L>
          <L label="Điều khoản thanh toán" span2>
            <input
              value={payTerms}
              onChange={(e) => setPayTerms(e.target.value)}
              maxLength={500}
              placeholder="L/C at sight · 20% deposit, 80% balance…"
              className={cls}
            />
          </L>
          <L label="Ghi chú báo giá" span2>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={2000}
              className={cls}
            />
          </L>
        </div>
      </Card>

      {/* 2. Dòng sản phẩm — đầy đủ quy cách */}
      <Card
        title={`Dòng sản phẩm (${lines.length})`}
        right={
          missingSpecCount > 0 ? (
            <span className="text-xs text-amber-600 dark:text-amber-500">
              ⚠ {missingSpecCount} SP thiếu quy cách — nhờ Kỹ thuật bổ sung
            </span>
          ) : null
        }
      >
        {lines.length === 0 ? (
          <p className="rounded-md border border-dashed border-zinc-300 py-6 text-center text-sm text-zinc-400 dark:border-zinc-700">
            Chưa có dòng nào — bấm <b>“+ Chọn SP có sẵn”</b> bên dưới.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {lines.map((l) => {
              const p = l.productId ? productById.get(l.productId) : undefined
              const pk = p?.packing ?? {}
              const specs: [string, string | null][] = [
                ['Mã KH đặt', p?.customer_item_code ?? null],
                ['ĐVT', p?.unit ?? null],
                ['KT SP (cm)', dimStr(pk.l_cm, pk.w_cm, pk.h_cm)],
                ['Carton (cm)', dimStr(pk.carton_l_cm, pk.carton_w_cm, pk.carton_h_cm)],
                [
                  'Carton (inch)',
                  inchStr(pk.carton_l_cm, pk.carton_w_cm, pk.carton_h_cm),
                ],
                ['SL/ctn', pk.qty_per_carton != null ? String(pk.qty_per_carton) : null],
                [
                  'Loading 40HC',
                  pk.loading_40hc != null ? String(pk.loading_40hc) : null,
                ],
                [
                  'NW/GW (kg)',
                  pk.nw_kg != null || pk.gw_kg != null
                    ? `${pk.nw_kg ?? '—'} / ${pk.gw_kg ?? '—'}`
                    : null,
                ],
              ]
              const noSpec =
                !dimStr(pk.l_cm, pk.w_cm, pk.h_cm) && pk.qty_per_carton == null
              const mine = l.productId ? lastPrices.get(l.productId) : undefined
              const market = l.productId ? marketPrices.get(l.productId) : undefined
              return (
                <div
                  key={l.key}
                  className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <select
                        value={l.productId}
                        onChange={(e) => {
                          const last = lastPrices.get(e.target.value)
                          setLine(l.key, {
                            productId: e.target.value,
                            ...(l.unitPrice === '' && last
                              ? { unitPrice: last.unit_price }
                              : {}),
                          })
                        }}
                        className={cls}
                      >
                        <option value="">— chọn sản phẩm —</option>
                        {productChoices.own.length > 0 && (
                          <optgroup label="SP của khách này">
                            {productChoices.own.map((o) => opt(o, usedIds, l.productId))}
                          </optgroup>
                        )}
                        {productChoices.common.length > 0 && (
                          <optgroup label="Mẫu chung">
                            {productChoices.common.map((o) =>
                              opt(o, usedIds, l.productId),
                            )}
                          </optgroup>
                        )}
                        {productChoices.others.length > 0 && (
                          <optgroup label="SP khách khác">
                            {productChoices.others.map((o) =>
                              opt(o, usedIds, l.productId),
                            )}
                          </optgroup>
                        )}
                      </select>
                      {p && (
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                          <span className="font-mono">{p.code}</span>
                          <Badge tone={BOM_TONE[p.bom_status]}>
                            {BOM_LABEL[p.bom_status]}
                          </Badge>
                          {p.has_image ? (
                            <span>🖼 có ảnh</span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-500">
                              🖼 chưa có ảnh
                            </span>
                          )}
                          {p.description_en && (
                            <span className="italic">{p.description_en}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLine(l.key)}
                      className="shrink-0 rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                      aria-label="Xoá dòng"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Quy cách đầy đủ (read-only từ thư viện Kỹ thuật) */}
                  {p && (
                    <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-md bg-zinc-50 p-2.5 text-xs sm:grid-cols-4 dark:bg-zinc-900/50">
                      {specs.map(([label, val]) => (
                        <div key={label} className="flex flex-col">
                          <span className="text-[10px] font-medium tracking-wide text-zinc-400 uppercase">
                            {label}
                          </span>
                          <span
                            className={val ? '' : 'text-amber-600 dark:text-amber-500'}
                          >
                            {val ?? '— thiếu'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {noSpec && p && (
                    <p className="mt-1.5 text-[11px] text-amber-600 dark:text-amber-500">
                      ⚠ SP <b>{p.code}</b> thiếu quy cách — in báo giá sẽ trống. Nhờ Kỹ
                      thuật bổ sung packing.
                    </p>
                  )}

                  {/* Ô sửa: đơn giá / CK% / ghi chú (báo giá KHÔNG có số lượng) */}
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <LineField label={`Đơn giá * (${currency})`}>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={l.unitPrice}
                        onChange={(e) =>
                          setLine(l.key, {
                            unitPrice:
                              e.target.value === '' ? '' : Number(e.target.value),
                          })
                        }
                        className={cls}
                      />
                    </LineField>
                    <LineField label="Chiết khấu %">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={l.discount}
                        onChange={(e) =>
                          setLine(l.key, {
                            discount: e.target.value === '' ? '' : Number(e.target.value),
                          })
                        }
                        className={cls}
                      />
                    </LineField>
                    <LineField label="Ghi chú dòng" span2>
                      <input
                        value={l.note}
                        maxLength={500}
                        onChange={(e) => setLine(l.key, { note: e.target.value })}
                        placeholder="tuỳ chọn"
                        className={cls}
                      />
                    </LineField>
                  </div>

                  {(mine || market) && (
                    <div className="mt-1.5 flex flex-wrap gap-x-3 text-[11px] text-zinc-400">
                      {mine && (
                        <span>
                          Khách này: <b>{mine.unit_price.toLocaleString('en-US')}</b> (
                          {mine.quote_code})
                        </span>
                      )}
                      {market && (
                        <span>
                          Gần nhất: <b>{market.unit_price.toLocaleString('en-US')}</b>{' '}
                          {market.currency} · {market.customer_name}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={addExistingLine}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            + Chọn SP có sẵn
          </button>
          <QuickAddProduct customerId={customerId || null} onCreated={addQuickProduct} />
        </div>
      </Card>

      {/* Thanh hành động sticky */}
      <div className="sticky bottom-3 z-10 rounded-lg border border-zinc-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 text-sm text-zinc-500">
            {invalid ? (
              <span className="block truncate text-xs text-amber-600 dark:text-amber-400">
                Còn thiếu: {missing.join(' · ')}
              </span>
            ) : (
              <span>
                {lines.length} dòng SP · {currency}
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={backHref}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Huỷ
            </Link>
            <button
              type="button"
              disabled={busy || invalid}
              title={invalid ? `Còn thiếu: ${missing.join(', ')}` : undefined}
              onClick={() => void submit()}
              className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-5 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {busy && <Spinner size={14} />}
              {mode === 'create' ? 'Lưu báo giá nháp' : 'Lưu thay đổi'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function opt(p: ProductPick, used: Set<string>, current: string) {
  const bom = p.bom_status === 'done' ? '✓BOM' : p.bom_status === 'drawing' ? '…BOM' : ''
  return (
    <option key={p.id} value={p.id} disabled={used.has(p.id) && p.id !== current}>
      {p.code} — {p.name} {bom}
    </option>
  )
}

function Card({
  title,
  right,
  children,
}: {
  title: string
  right?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2.5 dark:border-zinc-800">
        <h2 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
          {title}
        </h2>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

function L({
  label,
  span2,
  children,
}: {
  label: string
  span2?: boolean
  children: React.ReactNode
}) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${span2 ? 'sm:col-span-2' : ''}`}>
      {label}
      {children}
    </label>
  )
}

function LineField({
  label,
  span2,
  children,
}: {
  label: string
  span2?: boolean
  children: React.ReactNode
}) {
  return (
    <label className={`flex flex-col gap-1 ${span2 ? 'col-span-2' : ''}`}>
      <span className="text-[10px] font-medium tracking-wide text-zinc-400 uppercase">
        {label}
      </span>
      {children}
    </label>
  )
}
