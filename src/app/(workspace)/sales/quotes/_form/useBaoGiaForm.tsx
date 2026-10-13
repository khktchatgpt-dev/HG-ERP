'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, apiErrorText } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import {
  invalidateProductPickCache,
  type ProductPick,
} from '@/components/sales/ProductPicker'
import type { QuickProduct } from '@/components/sales/QuickAddProduct'
import { hasNoSpec } from '@/components/sales/ProductSpecFill'
import { quoteNetPrice } from '@/lib/quote-price'
import { avgLai, checkPrice, type PlanPrice } from '@/lib/sale-price'
import { todayVn } from '@/lib/date-vn'
import {
  addDays,
  fetchLastPrices,
  type CustomerOption,
  type QuoteInitial,
  type QuoteLineInitial,
} from '@/components/sales/quote-form.shared'
import { num, type Missing } from '../../orders/_form/don-form.shared'

export type BaoGiaFormProps = {
  mode: 'create' | 'edit'
  customers: CustomerOption[]
  /** CHỈ các SP đang nằm trên dòng — ô chọn tự tìm ở server. */
  lineProducts: ProductPick[]
  /** Chọn sẵn khách khi TẠO MỚI (vào từ hồ sơ KH) — server đã kiểm id có thật. */
  preselectCustomerId?: string
  initial?: QuoteInitial
  initialLines?: QuoteLineInitial[]
}

export type LineRow = {
  key: number
  productId: string
  qty: string
  unitPrice: string
  discount: string
  note: string
  /** Ô giá đang là GIÁ BÁN KH gợi sẵn (khách chưa từng được chào SP này) — gõ tay là xoá. */
  priceFrom?: 'plan'
}

/**
 * State + xử lý của form BÁO GIÁ (khuôn F, 07/10/2026). Khối con nhận `d`.
 * Giữ nguyên logic nghiệp vụ của QuoteForm cũ: giá gần nhất theo khách tự điền,
 * giá thị trường gợi ý, giá thành KH chỉ khi có quyền, SP mới tạo bằng QuickAdd.
 */
export function useBaoGiaForm(p: BaoGiaFormProps) {
  const { mode, customers, initial } = p
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const keyRef = useRef(p.initialLines?.length ?? 0)

  const preselect = initial ? undefined : p.preselectCustomerId
  const preDef = preselect ? customers.find((c) => c.id === preselect) : undefined
  const [customerId, setCustomerId] = useState(initial?.customer_id ?? preselect ?? '')
  const [h, setH] = useState({
    currency: initial?.currency ?? preDef?.default_currency ?? 'USD',
    price_term: initial?.price_term ?? preDef?.default_price_term ?? '',
    payment_terms: initial?.payment_terms ?? preDef?.default_payment_terms ?? '',
    // Hiệu lực mặc định 30 ngày khi lập mới — gửi khách bắt buộc có.
    valid_from: initial?.valid_from ?? (initial ? '' : todayVn()),
    valid_to: initial?.valid_to ?? (initial ? '' : addDays(todayVn(), 30)),
    note: initial?.note ?? '',
  })
  const set = (k: keyof typeof h, v: string) => setH((x) => ({ ...x, [k]: v }))

  const [known, setKnown] = useState<Map<string, ProductPick>>(
    () => new Map(p.lineProducts.map((x) => [x.id, x])),
  )
  const remember = (x: ProductPick) => setKnown((m) => new Map(m).set(x.id, x))

  const [lines, setLines] = useState<LineRow[]>(() =>
    (p.initialLines ?? []).map((l, i) => ({
      key: i,
      productId: l.product_id,
      qty: l.qty != null ? String(l.qty) : '',
      unitPrice: String(l.unit_price),
      discount: l.discount_pct != null ? String(l.discount_pct) : '',
      note: l.note ?? '',
    })),
  )
  const setLine = (key: number, patch: Partial<LineRow>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  const removeLine = (key: number) => setLines((ls) => ls.filter((l) => l.key !== key))
  const [openKeys, setOpenKeys] = useState<Set<number>>(new Set())
  const toggleOpen = (k: number) =>
    setOpenKeys((s) => {
      const n = new Set(s)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })

  /* ── giá gợi ý ──────────────────────────────────────────────────────────── */
  // Giá gần nhất theo KHÁCH, nhớ theo id khách — đổi khách là đổi bảng, không setState đồng bộ trong effect.
  const [lastByCust, setLastByCust] = useState<
    Map<string, Map<string, { unit_price: number; quote_code: string }>>
  >(new Map())
  const lastPrices = useMemo(
    () =>
      (customerId && lastByCust.get(customerId)) ||
      new Map<string, { unit_price: number; quote_code: string }>(),
    [customerId, lastByCust],
  )
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
  useEffect(() => {
    if (!customerId || lastByCust.has(customerId)) return
    const cid = customerId
    fetchLastPrices(cid)
      .then((m) => setLastByCust((x) => new Map(x).set(cid, m)))
      .catch(() => setLastByCust((x) => new Map(x).set(cid, new Map())))
  }, [customerId, lastByCust])

  /* ── giá vốn KH + giá bán KH (chỉ khi có quyền — route trả {} chứ không 403) */
  const [planPrices, setPlanPrices] = useState<Map<string, PlanPrice>>(new Map())
  const [canSeeCost, setCanSeeCost] = useState(false)
  const idsKey = lines
    .map((l) => l.productId)
    .filter(Boolean)
    .sort()
    .join(',')
  useEffect(() => {
    if (!idsKey) return
    api<{ prices: Record<string, PlanPrice> }>(
      `/api/dept/sales/quotes/plan-prices?ids=${encodeURIComponent(idsKey)}`,
    )
      .then((d) => {
        const m = new Map(Object.entries(d.prices))
        setPlanPrices(m)
        if (m.size > 0) setCanSeeCost(true)
      })
      .catch(() => {})
  }, [idsKey])

  /** Chọn khách khi TẠO MỚI → đổ điều khoản mặc định vào ô còn trống. */
  function pickCustomer(cid: string) {
    setCustomerId(cid)
    if (initial) return
    const c = customers.find((x) => x.id === cid)
    if (!c) return
    setH((x) => ({
      ...x,
      currency: c.default_currency ?? x.currency,
      price_term: x.price_term || c.default_price_term || '',
      payment_terms: x.payment_terms || c.default_payment_terms || '',
    }))
  }

  /* ── dòng ───────────────────────────────────────────────────────────────── */
  const newRow = (productId: string): LineRow => ({
    key: keyRef.current++,
    productId,
    qty: '',
    unitPrice:
      productId && lastPrices.get(productId)
        ? String(lastPrices.get(productId)!.unit_price)
        : '',
    discount: '',
    note: '',
  })
  /** Thêm nhiều SP một lượt — báo giá KHÔNG cho trùng SP (schema chặn), bỏ cái đã có. */
  function addPicked(ps: ProductPick[]) {
    ps.forEach(remember)
    const fresh = ps
      .filter((x) => !lines.some((l) => l.productId === x.id))
      .map((x) => newRow(x.id))
    setLines((ls) => [
      ...ls,
      ...fresh.filter((r) => !ls.some((l) => l.productId === r.productId)),
    ])
    // Khách chưa từng được chào SP này → gợi sẵn GIÁ BÁN KH (13/10/2026). Hỏi server vì
    // giá kế hoạch của SP vừa thêm chưa tải; chỉ điền ô CÒN TRỐNG, người có quyền mới nhận.
    const empty = fresh.filter((r) => r.unitPrice === '')
    if (empty.length) void fillPlan(empty)
  }
  async function fillPlan(rows: LineRow[]) {
    try {
      const ids = [...new Set(rows.map((r) => r.productId))].join(',')
      const d = await api<{ prices: Record<string, PlanPrice> }>(
        `/api/dept/sales/quotes/plan-prices?ids=${encodeURIComponent(ids)}`,
      )
      const m = new Map(Object.entries(d.prices))
      if (!m.size) return
      const keys = new Set(rows.map((r) => r.key))
      setLines((ls) =>
        ls.map((l) => {
          const p = m.get(l.productId)
          if (!keys.has(l.key) || l.unitPrice !== '' || !p || p.currency !== h.currency)
            return l
          return { ...l, unitPrice: String(p.price), priceFrom: 'plan' }
        }),
      )
    } catch {
      /* không có gợi ý thì ô để trống */
    }
  }
  function replaceProduct(key: number, x: ProductPick) {
    remember(x)
    const last = lastPrices.get(x.id)
    setLines((ls) =>
      ls.map((l) =>
        l.key === key
          ? {
              ...l,
              productId: x.id,
              unitPrice:
                l.unitPrice === '' && last ? String(last.unit_price) : l.unitPrice,
            }
          : l,
      ),
    )
  }
  function addQuick(q: QuickProduct, unitPrice: number | null) {
    remember({
      id: q.id,
      code: q.code,
      name: q.name,
      unit: q.unit,
      customer_id: q.customer_id,
      customer_item_code: q.customer_item_code,
      bom_status: q.bom_status,
      description_en: q.description_en,
      has_image: !!q.image_file_id,
      image_url: null,
      packing: q.packing ?? {},
    })
    invalidateProductPickCache()
    setLines((ls) => [
      ...ls,
      { ...newRow(q.id), unitPrice: unitPrice != null ? String(unitPrice) : '' },
    ])
  }
  const usedIds = useMemo(
    () => new Set(lines.map((l) => l.productId).filter(Boolean)),
    [lines],
  )

  /* ── số liệu & còn thiếu ────────────────────────────────────────────────── */
  const calc = (l: LineRow) => {
    const net = quoteNetPrice(
      num(l.unitPrice),
      l.discount === '' ? null : num(l.discount),
    )
    const plan = l.productId ? (planPrices.get(l.productId) ?? null) : null
    return { net, plan, check: checkPrice(net, h.currency, plan) }
  }
  const tong = useMemo(() => {
    let ref = 0
    let below = 0
    let belowPlan = 0
    let noSpec = 0
    let withQty = 0
    let gain = 0
    let gainN = 0
    let firstBelow: number | null = null
    let firstBelowPlan: number | null = null
    const laiRows: Parameters<typeof avgLai>[0] = []
    for (const l of lines) {
      const { net, plan, check } = calc(l)
      const qty = num(l.qty)
      if (qty > 0) {
        ref += qty * net
        withQty++
      }
      if (check.below_cost) {
        below++
        firstBelow ??= l.key
      } else if (check.below_plan) {
        belowPlan++
        firstBelowPlan ??= l.key
      }
      const comparable = !!plan && !check.currency_mismatch
      laiRows.push({
        price: net,
        qty: qty > 0 ? qty : null,
        cost: plan?.cost ?? null,
        comparable,
      })
      // Σ lãi chỉ trên dòng CÓ SL — dòng thiếu SL không có tiền để cộng.
      if (comparable && plan?.cost != null && net > 0 && qty > 0) {
        gain += (net - plan.cost) * qty
        gainN++
      }
      const pr = l.productId ? known.get(l.productId) : undefined
      if (pr && hasNoSpec(pr)) noSpec++
    }
    const lai = avgLai(laiRows)
    return {
      ref,
      below,
      belowPlan,
      noSpec,
      withQty,
      // null = không dòng nào tính được lãi (thiếu SL / chưa bóc vốn) — đừng in "0,00".
      gain: gainN ? gain : null,
      avgLai: lai.pct,
      withCost: lai.n,
      firstBelow,
      firstBelowPlan,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- calc đọc planPrices (đã trong deps)
  }, [lines, planPrices, known, h.currency])

  const missing = useMemo<Missing[]>(() => {
    const m: Missing[] = []
    if (!customerId) m.push({ msg: 'chọn khách hàng', focus: 'f-customer' })
    if (h.valid_from && h.valid_to && h.valid_from > h.valid_to)
      m.push({ msg: 'hiệu lực: “từ ngày” phải ≤ “đến ngày”', focus: 'f-valid-to' })
    if (lines.length === 0)
      m.push({ msg: 'thêm ít nhất 1 dòng sản phẩm', focus: 'btn-pick' })
    const noSp = lines.find((l) => !l.productId)
    if (noSp) m.push({ msg: 'chọn SP cho mọi dòng', focus: `cell-${noSp.key}-sp` })
    const noPrice = lines.find((l) => l.productId && l.unitPrice.trim() === '')
    if (noPrice)
      m.push({
        msg: 'nhập đơn giá (0 nếu chưa chào)',
        focus: `cell-${noPrice.key}-price`,
      })
    const badCk = lines.find(
      (l) => l.discount !== '' && (num(l.discount) < 0 || num(l.discount) > 100),
    )
    if (badCk) m.push({ msg: 'CK % phải trong 0–100', focus: `cell-${badCk.key}-ck` })
    return m
  }, [customerId, h.valid_from, h.valid_to, lines])
  const invalid = missing.length > 0

  async function submit() {
    if (invalid) {
      toast.error('Chưa thể lưu', `Còn thiếu: ${missing.map((m) => m.msg).join(', ')}`)
      return
    }
    setBusy(true)
    try {
      const body = {
        customer_id: customerId,
        currency: h.currency,
        valid_from: h.valid_from || null,
        valid_to: h.valid_to || null,
        price_term: h.price_term.trim() || null,
        payment_terms: h.payment_terms.trim() || null,
        note: h.note.trim() || null,
        lines: lines.map((l) => ({
          product_id: l.productId,
          qty: l.qty.trim() === '' ? null : num(l.qty),
          unit_price: num(l.unitPrice),
          discount_pct: l.discount.trim() === '' ? null : num(l.discount),
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

  const [pickOpen, setPickOpen] = useState(false)
  const [replaceKey, setReplaceKey] = useState<number | null>(null)
  const [termsOpen, setTermsOpen] = useState(true)

  return {
    mode,
    initial,
    customers,
    busy,
    customerId,
    pickCustomer,
    h,
    set,
    known,
    lines,
    setLine,
    removeLine,
    addPicked,
    replaceProduct,
    addQuick,
    addEmpty: () => setLines((ls) => [...ls, newRow('')]),
    usedIds,
    openKeys,
    toggleOpen,
    lastPrices,
    marketPrices,
    planPrices,
    canSeeCost,
    calc,
    tong,
    missing,
    invalid,
    submit,
    pickOpen,
    setPickOpen,
    replaceKey,
    setReplaceKey,
    termsOpen,
    setTermsOpen,
  } as const
}

export type BaoGiaFormCtx = ReturnType<typeof useBaoGiaForm>
