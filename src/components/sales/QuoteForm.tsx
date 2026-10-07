'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/shadcn/button'
import { api, apiErrorText } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'
import { QuickAddProduct, type QuickProduct } from '@/components/sales/QuickAddProduct'
import {
  ProductPicker,
  invalidateProductPickCache,
  type ProductPick,
} from '@/components/sales/ProductPicker'
import { hasNoSpec } from '@/components/sales/ProductSpecFill'
import {
  addDays,
  BOM_LABEL,
  BOM_TONE,
  Card,
  cls,
  dimStr,
  fetchLastPrices,
  inchStr,
  L,
  QuoteLineDetails,
  type CustomerOption,
  type LineDraft,
  type QuoteInitial,
  type QuoteLineInitial,
} from './quote-form.shared'

export type { CustomerOption, QuoteInitial, QuoteLineInitial } from './quote-form.shared'
import { ProductSearchDialog } from '@/components/sales/ProductSearchDialog'
import { quoteNetPrice } from '@/lib/quote-price'
import { todayVn } from '@/lib/date-vn'

export type { ProductPick }

type LineRow = {
  key: number
  productId: string
  draft: LineDraft | null
  /** SL dự kiến / MOQ (0225) — tuỳ chọn. */
  qty: number | ''
  unitPrice: number | ''
  discount: number | ''
  note: string
}

export function QuoteForm(props: {
  mode: 'create' | 'edit'
  customers: CustomerOption[]
  /**
   * CHỈ các SP đang nằm trên dòng của báo giá đang sửa — không phải cả thư viện.
   * Ô chọn SP tự tìm ở server khi sale mở nó (xem `ProductPicker`).
   */
  lineProducts: ProductPick[]
  /** Chọn sẵn khách khi TẠO MỚI (vào từ hồ sơ KH) — server đã kiểm id có thật. */
  preselectCustomerId?: string
  initial?: QuoteInitial
  initialLines?: QuoteLineInitial[]
}) {
  const { mode, customers, initial } = props
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const keyRef = useRef(props.initialLines?.length ?? 0)

  const preselect = initial ? undefined : props.preselectCustomerId
  const [customerId, setCustomerId] = useState(initial?.customer_id ?? preselect ?? '')
  const preselectDefaults = preselect
    ? props.customers.find((c) => c.id === preselect)
    : undefined
  const [currency, setCurrency] = useState(
    initial?.currency ?? preselectDefaults?.default_currency ?? 'USD',
  )
  const [priceTerm, setPriceTerm] = useState(
    initial?.price_term ?? preselectDefaults?.default_price_term ?? '',
  )
  const [payTerms, setPayTerms] = useState(
    initial?.payment_terms ?? preselectDefaults?.default_payment_terms ?? '',
  )
  // Hiệu lực mặc định 30 ngày khi lập mới (07/10/2026) — gửi khách bắt buộc có.
  const [validFrom, setValidFrom] = useState(
    initial?.valid_from ?? (initial ? '' : todayVn()),
  )
  const [validTo, setValidTo] = useState(
    initial?.valid_to ?? (initial ? '' : addDays(todayVn(), 30)),
  )
  const [note, setNote] = useState(initial?.note ?? '')

  // SP đã BIẾT: dòng có sẵn + SP sale vừa chọn / vừa tạo. Không có "cả thư viện"
  // nữa — ô chọn tìm ở server, form chỉ giữ những SP thực sự đang dùng.
  const [known, setKnown] = useState<Map<string, ProductPick>>(
    () => new Map(props.lineProducts.map((p) => [p.id, p])),
  )
  const rememberProduct = (p: ProductPick) => setKnown((m) => new Map(m).set(p.id, p))

  const [lines, setLines] = useState<LineRow[]>(() =>
    (props.initialLines ?? []).map((l, i) => ({
      key: i,
      productId: l.product_id,
      draft: null,
      qty: l.qty ?? '',
      unitPrice: l.unit_price,
      discount: l.discount_pct ?? '',
      note: l.note ?? '',
    })),
  )

  // Giá thành KH theo SP (0225) — {} khi không có quyền (route không 403).
  const [planPrices, setPlanPrices] = useState<
    Map<string, { price: number; currency: string }>
  >(new Map())
  const [canSeeCost, setCanSeeCost] = useState(false)
  const productIdsKey = lines
    .map((l) => l.productId)
    .filter(Boolean)
    .sort()
    .join(',')
  useEffect(() => {
    if (!productIdsKey) return
    api<{ prices: Record<string, { price: number; currency: string }> }>(
      `/api/dept/sales/quotes/plan-prices?ids=${encodeURIComponent(productIdsKey)}`,
    )
      .then((d) => {
        const m = new Map(Object.entries(d.prices))
        setPlanPrices(m)
        if (m.size > 0) setCanSeeCost(true)
      })
      .catch(() => {})
  }, [productIdsKey])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [openKeys, setOpenKeys] = useState<Set<number>>(new Set())
  const toggleOpen = (k: number) =>
    setOpenKeys((s) => {
      const n = new Set(s)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })

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

  /*
   * Khách đã biết ngay khi mở form (sửa báo giá, hoặc vào từ hồ sơ KH qua
   * `?customer=`) → nạp giá gần nhất luôn. Trước chỉ nạp khi người dùng ĐỔI ô
   * khách, nên hai lối vào đó mất hẳn gợi ý "khách này lần trước báo bao nhiêu".
   */
  const firstCustomerId = initial?.customer_id ?? preselect ?? ''
  useEffect(() => {
    if (!firstCustomerId) return
    fetchLastPrices(firstCustomerId)
      .then(setLastPrices)
      .catch(() => setLastPrices(new Map()))
  }, [firstCustomerId])

  // Chọn khách khi TẠO MỚI → đổ điều khoản mặc định vào ô còn trống.
  function applyCustomerDefaults(cid: string) {
    if (initial) return
    const c = customers.find((x) => x.id === cid)
    if (!c) return
    if (c.default_currency) setCurrency(c.default_currency)
    if (c.default_price_term) setPriceTerm((v) => v || c.default_price_term!)
    if (c.default_payment_terms) setPayTerms((v) => v || c.default_payment_terms!)
  }

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

  // Đếm SP thiếu quy cách — nay sale tự bổ sung được ngay tại dòng.
  const missingSpecCount = lines.filter((l) => {
    const p = l.productId ? known.get(l.productId) : undefined
    return p ? hasNoSpec(p) : false
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
        qty: '',
        unitPrice: '',
        discount: '',
        note: '',
      },
    ])
  }

  /** Thêm nhiều SP một lượt từ hộp chọn (07/10/2026) — giá điền sẵn theo khách này nếu có. */
  function addPicked(products: ProductPick[]) {
    for (const pr of products) rememberProduct(pr)
    setLines((ls) => [
      ...ls,
      ...products
        .filter((pr) => !ls.some((l) => l.productId === pr.id))
        .map((pr) => ({
          key: keyRef.current++,
          productId: pr.id,
          draft: null,
          qty: '' as const,
          unitPrice: (lastPrices.get(pr.id)?.unit_price ?? '') as number | '',
          discount: '' as const,
          note: '',
        })),
    ])
  }
  const belowCost = lines.filter((l) => {
    const c = l.productId ? planPrices.get(l.productId)?.price : undefined
    const net = quoteNetPrice(
      Number(l.unitPrice) || 0,
      l.discount === '' ? null : Number(l.discount),
    )
    return c != null && net > 0 && net < c
  }).length
  const refValue = lines.reduce(
    (s, l) =>
      s +
      (Number(l.qty) || 0) *
        quoteNetPrice(
          Number(l.unitPrice) || 0,
          l.discount === '' ? null : Number(l.discount),
        ),
    0,
  )

  function addQuickProduct(p: QuickProduct, unitPrice: number | null) {
    rememberProduct({
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
    })
    // Thư viện vừa có SP mới — cache của ô chọn (chưa có nó) phải bỏ đi.
    invalidateProductPickCache()
    setLines((ls) => [
      ...ls,
      {
        key: keyRef.current++,
        productId: p.id,
        draft: null,
        qty: '',
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
          qty: l.qty === '' ? null : Number(l.qty),
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
    <div className="theme-v3 text-foreground flex flex-col gap-5 pb-4">
      <TopProgressBar active={busy} />

      {/* Đầu trang v2 — khớp OrderForm: một đường về + tiêu đề, bỏ breadcrumb 3 cấp. */}
      <div className="flex flex-col gap-3">
        <Link
          href={backHref}
          className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-xs"
        >
          <ArrowLeft className="size-3.5" />
          {mode === 'edit' ? initial!.code : 'Báo giá'}
        </Link>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {mode === 'create' ? 'Lập báo giá' : `Sửa báo giá ${initial!.code}`}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Báo giá chào theo đơn giá + quy cách sản phẩm. Số lượng nhập ở bước tạo đơn
            hàng.
          </p>
        </div>
      </div>

      {/* 1. Khách hàng & điều khoản */}
      <Card title="Khách hàng & điều khoản">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <L label="Khách hàng *" span2>
            <select
              value={customerId}
              onChange={(e) => {
                const cid = e.target.value
                setCustomerId(cid)
                applyCustomerDefaults(cid)
                if (!cid) setLastPrices(new Map())
                else {
                  fetchLastPrices(cid)
                    .then(setLastPrices)
                    .catch(() => setLastPrices(new Map()))
                }
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

      {/* 2. Dòng sản phẩm — LƯỚI (07/10/2026): một dòng một hàng, giá thành KH ·
          net · lãi% ngay trên lưới; quy cách / điền spec / giá gợi ý mở ở hàng
          chi tiết. Bản cũ là chuỗi thẻ ~200px/dòng — 30 SP là hàng chục màn cuộn. */}
      <Card
        title={`Dòng sản phẩm (${lines.length})`}
        right={
          <span className="flex items-center gap-3 text-xs">
            {missingSpecCount > 0 && (
              <span className="text-amber-600">
                ⚠ {missingSpecCount} SP thiếu quy cách
              </span>
            )}
            {canSeeCost && belowCost > 0 && (
              <span className="text-red-600">{belowCost} dòng dưới giá thành KH</span>
            )}
          </span>
        }
      >
        {lines.length === 0 ? (
          <p className="text-muted-foreground rounded-md border border-dashed py-6 text-center text-sm">
            Chưa có dòng nào — bấm <b>“+ Chọn SP”</b> (chọn được nhiều mã một lượt) hoặc{' '}
            <b>“SP mới”</b>.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[1080px] border-collapse text-sm">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
                  <th className="w-8 px-2 py-1.5 text-right">#</th>
                  <th className="min-w-[280px] px-2 py-1.5 text-left">Sản phẩm</th>
                  <th className="w-14 px-2 py-1.5 text-left">ĐVT</th>
                  <th className="w-24 px-2 py-1.5 text-right">SL / MOQ</th>
                  {canSeeCost && (
                    <th className="w-24 px-2 py-1.5 text-right">Giá thành KH</th>
                  )}
                  <th className="w-28 px-2 py-1.5 text-right">Đơn giá ({currency})</th>
                  <th className="w-20 px-2 py-1.5 text-right">CK %</th>
                  <th className="w-24 px-2 py-1.5 text-right">Net</th>
                  {canSeeCost && <th className="w-16 px-2 py-1.5 text-right">Lãi KH</th>}
                  <th className="px-2 py-1.5 text-left">Ghi chú</th>
                  <th className="w-16 px-2 py-1.5" />
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => {
                  const p = l.productId ? known.get(l.productId) : undefined
                  const pk = p?.packing ?? {}
                  const net = quoteNetPrice(
                    Number(l.unitPrice) || 0,
                    l.discount === '' ? null : Number(l.discount),
                  )
                  const cost = l.productId
                    ? (planPrices.get(l.productId)?.price ?? null)
                    : null
                  const margin =
                    cost != null && net > 0 ? ((net - cost) / net) * 100 : null
                  const mine = l.productId ? lastPrices.get(l.productId) : undefined
                  const market = l.productId ? marketPrices.get(l.productId) : undefined
                  const noSpec =
                    !dimStr(pk.l_cm, pk.w_cm, pk.h_cm) && pk.qty_per_carton == null
                  const open = openKeys.has(l.key)
                  const specs: [string, string | null][] = [
                    ['Mã KH đặt', p?.customer_item_code ?? null],
                    ['KT SP (cm)', dimStr(pk.l_cm, pk.w_cm, pk.h_cm)],
                    [
                      'Carton (cm)',
                      dimStr(pk.carton_l_cm, pk.carton_w_cm, pk.carton_h_cm),
                    ],
                    [
                      'Carton (inch)',
                      inchStr(pk.carton_l_cm, pk.carton_w_cm, pk.carton_h_cm),
                    ],
                    [
                      'SL/ctn',
                      pk.qty_per_carton != null ? String(pk.qty_per_carton) : null,
                    ],
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
                  const colCount = 9 + (canSeeCost ? 2 : 0)
                  return (
                    <Fragment key={l.key}>
                      <tr className="border-t align-top">
                        <td className="text-muted-foreground px-2 py-1.5 text-right font-mono text-xs">
                          {i + 1}
                        </td>
                        <td className="px-2 py-1">
                          <ProductPicker
                            value={l.productId}
                            selected={p}
                            customerId={customerId || null}
                            usedIds={usedIds}
                            onPick={(picked) => {
                              rememberProduct(picked)
                              const last = lastPrices.get(picked.id)
                              setLine(l.key, {
                                productId: picked.id,
                                ...(l.unitPrice === '' && last
                                  ? { unitPrice: last.unit_price }
                                  : {}),
                              })
                            }}
                          />
                          {p && (
                            <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px]">
                              <span className="font-mono">{p.code}</span>
                              {p.customer_item_code && (
                                <span className="font-mono">
                                  · {p.customer_item_code}
                                </span>
                              )}
                              <Badge tone={BOM_TONE[p.bom_status]}>
                                {BOM_LABEL[p.bom_status]}
                              </Badge>
                              {noSpec && (
                                <span className="text-amber-600">thiếu quy cách</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="text-muted-foreground px-2 py-2 text-xs">
                          {p?.unit ?? ''}
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={l.qty}
                            onChange={(e) =>
                              setLine(l.key, {
                                qty: e.target.value === '' ? '' : Number(e.target.value),
                              })
                            }
                            placeholder="tuỳ chọn"
                            aria-label="Số lượng dự kiến / MOQ"
                            className={`${cls} h-8 px-2 text-right text-xs`}
                          />
                        </td>
                        {canSeeCost && (
                          <td className="text-muted-foreground px-2 py-2 text-right font-mono text-xs tabular-nums">
                            {cost != null
                              ? cost.toLocaleString('en-US', { minimumFractionDigits: 2 })
                              : '—'}
                          </td>
                        )}
                        <td className="px-2 py-1">
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
                            aria-label="Đơn giá"
                            className={`${cls} h-8 px-2 text-right text-xs ${canSeeCost && cost != null && net > 0 && net < cost ? 'border-red-400' : ''}`}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={l.discount}
                            onChange={(e) =>
                              setLine(l.key, {
                                discount:
                                  e.target.value === '' ? '' : Number(e.target.value),
                              })
                            }
                            aria-label="Chiết khấu %"
                            className={`${cls} h-8 px-2 text-right text-xs`}
                          />
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-xs font-medium tabular-nums">
                          {net > 0
                            ? net.toLocaleString('en-US', { minimumFractionDigits: 2 })
                            : '—'}
                        </td>
                        {canSeeCost && (
                          <td
                            className={`px-2 py-2 text-right font-mono text-xs tabular-nums ${margin == null ? 'text-muted-foreground' : margin < 0 ? 'text-red-600' : margin < 10 ? 'text-amber-600' : 'text-emerald-700'}`}
                          >
                            {margin == null ? '—' : `${margin.toFixed(1)}%`}
                          </td>
                        )}
                        <td className="px-2 py-1">
                          <input
                            value={l.note}
                            maxLength={500}
                            onChange={(e) => setLine(l.key, { note: e.target.value })}
                            placeholder="tuỳ chọn"
                            aria-label="Ghi chú dòng"
                            className={`${cls} h-8 px-2 text-xs`}
                          />
                        </td>
                        <td className="px-1 py-1 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => toggleOpen(l.key)}
                            aria-expanded={open}
                            className="text-muted-foreground hover:bg-accent rounded px-1.5 py-1 text-xs"
                            title="Quy cách · giá gợi ý · điền spec"
                          >
                            {open ? '▴' : '▾'}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeLine(l.key)}
                            className="text-muted-foreground rounded p-1 text-xs hover:bg-red-50 hover:text-red-600"
                            aria-label="Xoá dòng"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                      {open && (
                        <QuoteLineDetails
                          colCount={colCount}
                          product={p}
                          specs={specs}
                          mine={mine}
                          market={market}
                          onSaved={rememberProduct}
                        />
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-muted/50 border-t text-xs font-medium">
                  <td className="px-2 py-1.5" colSpan={3}>
                    Cộng {lines.length} dòng
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                    {lines
                      .reduce((s, l) => s + (Number(l.qty) || 0), 0)
                      .toLocaleString('vi-VN') || 0}
                  </td>
                  {canSeeCost && <td />}
                  <td colSpan={2} />
                  <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                    {refValue > 0
                      ? refValue.toLocaleString('en-US', { minimumFractionDigits: 2 })
                      : '—'}
                  </td>
                  {canSeeCost && <td />}
                  <td
                    className="text-muted-foreground px-2 py-1.5 font-normal"
                    colSpan={2}
                  >
                    trị giá tham chiếu = Σ net × SL (dòng có SL)
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            disabled={!customerId}
            title={customerId ? undefined : 'Chọn khách hàng trước'}
            className="hover:bg-accent rounded-md border px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            + Chọn SP
          </button>
          <button
            type="button"
            onClick={addExistingLine}
            className="hover:bg-accent rounded-md border px-3 py-1.5 text-sm"
          >
            + Dòng trống
          </button>
          <QuickAddProduct customerId={customerId || null} onCreated={addQuickProduct} />
          {!canSeeCost && (
            <span className="text-muted-foreground ml-auto text-[11px]">
              Giá thành KH chỉ hiện với người có quyền xem giá thành.
            </span>
          )}
        </div>
        <ProductSearchDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          customerId={customerId || null}
          usedIds={usedIds}
          multi
          title="Chọn sản phẩm vào báo giá"
          onConfirm={addPicked}
        />
      </Card>

      {/* Thanh hành động sticky — cùng khối với OrderForm. */}
      <div className="bg-card/95 sticky bottom-3 z-10 rounded-xl border px-4 py-3 shadow-lg backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="text-muted-foreground min-w-0 text-sm">
            {invalid ? (
              <span className="block truncate text-xs text-amber-600">
                Còn thiếu: {missing.join(' · ')}
              </span>
            ) : (
              <span>
                {lines.length} dòng SP · {currency}
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="ghost" asChild>
              <Link href={backHref}>Huỷ</Link>
            </Button>
            <Button
              type="button"
              disabled={busy || invalid}
              title={invalid ? `Còn thiếu: ${missing.join(', ')}` : undefined}
              onClick={() => void submit()}
            >
              {busy && <Spinner size={14} />}
              {mode === 'create' ? 'Lưu báo giá nháp' : 'Lưu thay đổi'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
