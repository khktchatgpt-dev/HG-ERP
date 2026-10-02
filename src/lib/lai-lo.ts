import { sumToBase, toBase } from './fx'

/**
 * LÃI / LỖ THEO LỆNH SẢN XUẤT — màn của Giám đốc (bước 4, 02/10/2026).
 *
 * Câu hỏi của màn: *"Lệnh nào đang có nguy cơ lỗ, lỗ vì đâu, và còn thiếu số
 * gì để kết luận chắc?"* Chép bố cục sổ tay "Hoạch toán đơn hàng URTON" của
 * Sale (doanh thu − chi phí đầu vào theo NCC → lợi nhuận) và cách SAP đặt kế
 * hoạch cạnh thực tế trên từng lệnh.
 *
 * ⭐ BA LUẬT KHÔNG ĐƯỢC PHÁ:
 *
 * 1. **Thiếu một vế thì KHÔNG ra số lãi/lỗ.** Thiếu giá thành kế hoạch của 24/26
 *    SP mà vẫn in "lợi nhuận 340 triệu" là con số không kiểm được, và Giám đốc
 *    sẽ ra quyết định trên nó. Vế thiếu trả `null` kèm lý do; màn bày "—" và
 *    nói thiếu gì, ai điền, ở đâu. KHÔNG bày 0 — 0 đọc ra là "không có doanh
 *    thu".
 * 2. **Quy VND theo tỷ giá CHỐT TRÊN TỪNG CHỨNG TỪ** (bước 1), không tra bảng
 *    lúc đọc. Đơn mua USD chưa có `fx_rate` thì phần đó nằm riêng ở `missing`,
 *    KHÔNG cộng vào tổng — `sumToBase` đã làm đúng việc này.
 * 3. **Ngưỡng là của CHÍNH lệnh đó**, không phải phần trăm chung: đỏ khi tiền
 *    mua đã cam kết vượt giá thành kế hoạch (chưa tính công mà vật tư đã vượt),
 *    hoặc biên dự kiến âm; cam khi biên dự kiến ăn vào lợi nhuận kế hoạch mà
 *    Sale đã tính cho lệnh ấy.
 *
 * Thuần, không chạm DB — service đọc một lượt rồi đưa vào đây; màn và test
 * dùng chung một hàm nên con số ở dải đầu trang, bảng và ngăn soi là một.
 */

export type LaiLoLsx = {
  id: string
  code: string
  status: string
  customer_name: string | null
}

export type LaiLoLsxLine = {
  lsx_id: string
  /** null khi dòng lệnh chưa gắn hồ sơ SP — vẫn là một SP CHƯA có giá thành. */
  product_id: string | null
  product_code: string
  qty: number
}

/** Bốn số kế hoạch của một SP (bước 2). Thiếu số nào thì SP coi như chưa có. */
export type LaiLoPlan = {
  product_id: string
  direct: number | null
  overhead: number | null
  profit: number | null
  price: number | null
  currency: string | null
}

export type LaiLoOrder = {
  id: string
  code: string
  lsx_id: string
  currency: string
  /** Tỷ giá chốt lúc lập đơn (0219). null = chưa gán → USD chưa quy được. */
  fx_rate: number | null
}

export type LaiLoOrderLine = {
  order_id: string
  product_id: string
  qty: number
  /** 0 = Sale chưa điền (bước 3 mồi FOB kế hoạch vào đây). */
  unit_price: number
}

export type LaiLoPo = {
  id: string
  code: string
  lsx_id: string
  supplier_id: string
  supplier_name: string
  currency: string
  /** Tỷ giá chốt lúc Giám đốc duyệt (0219). null = chưa gán. */
  fx_rate: number | null
  status: string
  /** Σ dòng theo đúng `poLineAmount` — tiền tệ của đơn. */
  amount: number
}

/** Một khoản tiền đã quy VND, kèm phần KHÔNG quy được (thiếu tỷ giá). */
export type Quy = { vnd: number; missing: { currency: string; amount: number }[] }

export type LaiLoMissing = {
  kind: 'plan' | 'order' | 'price' | 'so_fx' | 'po_fx'
  /** Câu người đọc hiểu: "24/26 SP chưa có giá thành kế hoạch". */
  text: string
  /** Bản ngắn cho nhãn trong bảng: "24/26 SP chưa giá thành". */
  short: string
  /** Ai điền, ở đâu. */
  who: string
  href: string
}

export type LaiLoProduct = {
  product_id: string | null
  code: string
  qty: number
  price: number | null
  direct: number | null
  overhead: number | null
  profit: number | null
  currency: string | null
}

export type LaiLoSupplier = {
  supplier_id: string
  name: string
  currency: string
  amount: number
  vnd: number | null
  /** Có đơn còn nháp / chờ duyệt trong số này. */
  has_draft: boolean
  po_count: number
}

export type LaiLoVerdict = 'lo' | 'an_lai' | 'on' | 'thieu'

export type LaiLoRow = {
  lsx_id: string
  code: string
  status: string
  customer_name: string | null
  product_count: number
  qty_total: number
  /** Doanh thu quy VND. null = chưa có nguồn nào đủ. */
  revenue: Quy | null
  /** Số lấy từ đơn bán có giá, hay tạm theo FOB kế hoạch (bày nhãn "theo KH"). */
  revenue_source: 'order' | 'plan' | null
  order_count: number
  order_lines: number
  priced_lines: number
  /** Σ SL lệnh × (trực tiếp + chung) kế hoạch, quy VND theo fx đơn bán của lệnh. */
  plan_cost: Quy | null
  plan_profit: Quy | null
  planned_products: number
  committed: Quy
  /** Phần cam kết còn ở đơn NHÁP / chờ duyệt (VND quy đổi được). */
  committed_draft: number
  po_count: number
  po_missing_fx: number
  /** Cam kết mua ÷ giá thành KH, %. null khi một trong hai chưa đủ. */
  ratio_pct: number | null
  /** Doanh thu − cam kết mua. null khi một trong hai chưa đủ. */
  margin: number | null
  verdict: LaiLoVerdict
  missing: LaiLoMissing[]
  products: LaiLoProduct[]
  suppliers: LaiLoSupplier[]
}

export type LaiLoBoard = {
  rows: LaiLoRow[]
  totals: {
    lsx_count: number
    committed: Quy
    committed_draft: number
    plan_products: number
    products: number
    priced_lines: number
    order_lines: number
    orders_missing_lsx: number
    po_missing_fx: number
    po_count: number
    conclusive: number
    at_risk: number
  }
}

const DRAFT_PO = new Set(['draft', 'pending_approval'])
const r0 = (n: number) => Math.round(n)
const r2 = (n: number) => Math.round(n * 100) / 100

const planComplete = (
  p: LaiLoPlan | undefined,
): p is LaiLoPlan & { direct: number; overhead: number; profit: number; price: number } =>
  // prettier-ignore
  !!p && p.direct != null && p.overhead != null && p.profit != null && p.price != null

const HREF = {
  plan: '/sales/gia-thanh',
  orders: '/sales/orders',
  price: '/sales/orders/gia',
  fx: '/finance/ty-gia',
} as const

export function laiLoBoard(input: {
  lsx: LaiLoLsx[]
  lsxLines: LaiLoLsxLine[]
  plans: LaiLoPlan[]
  orders: LaiLoOrder[]
  orderLines: LaiLoOrderLine[]
  pos: LaiLoPo[]
}): LaiLoBoard {
  const plan = new Map(input.plans.map((p) => [p.product_id, p]))
  const linesOf = group(input.lsxLines, (l) => l.lsx_id)
  const ordersOf = group(input.orders, (o) => o.lsx_id)
  const orderLinesOf = group(input.orderLines, (l) => l.order_id)
  const posOf = group(input.pos, (p) => p.lsx_id)

  const rows = input.lsx.map((lsx) =>
    rowOf(
      lsx,
      linesOf.get(lsx.id) ?? [],
      plan,
      ordersOf.get(lsx.id) ?? [],
      orderLinesOf,
      posOf.get(lsx.id) ?? [],
    ),
  )
  rows.sort(
    (a, b) =>
      VERDICT_ORDER[a.verdict] - VERDICT_ORDER[b.verdict] ||
      b.committed.vnd - a.committed.vnd ||
      a.code.localeCompare(b.code),
  )

  // Tổng dải đầu trang — cộng từ CHÍNH các dòng, không tính lại từ đầu vào.
  const committed = mergeQuy(rows.map((r) => r.committed))
  const allProducts = new Set<string>()
  const plannedProducts = new Set<string>()
  for (const r of rows) {
    for (const p of r.products) {
      const k = p.product_id ?? `code:${p.code}`
      allProducts.add(k)
      if (p.price != null) plannedProducts.add(k)
    }
  }
  return {
    rows,
    totals: {
      lsx_count: rows.length,
      committed,
      committed_draft: r0(rows.reduce((s, r) => s + r.committed_draft, 0)),
      plan_products: plannedProducts.size,
      products: allProducts.size,
      priced_lines: rows.reduce((s, r) => s + r.priced_lines, 0),
      order_lines: rows.reduce((s, r) => s + r.order_lines, 0),
      orders_missing_lsx: rows.filter((r) => r.order_count === 0).length,
      po_missing_fx: rows.reduce((s, r) => s + r.po_missing_fx, 0),
      po_count: rows.reduce((s, r) => s + r.po_count, 0),
      conclusive: rows.filter((r) => r.verdict !== 'thieu').length,
      at_risk: rows.filter((r) => r.verdict === 'lo' || r.verdict === 'an_lai').length,
    },
  }
}

const VERDICT_ORDER: Record<LaiLoVerdict, number> = { lo: 0, an_lai: 1, thieu: 2, on: 3 }

function rowOf(
  lsx: LaiLoLsx,
  lines: LaiLoLsxLine[],
  plan: Map<string, LaiLoPlan>,
  orders: LaiLoOrder[],
  orderLinesOf: Map<string, LaiLoOrderLine[]>,
  pos: LaiLoPo[],
): LaiLoRow {
  const missing: LaiLoMissing[] = []

  /*
    Tỷ giá CỦA LỆNH cho các số kế hoạch (giá thành KH, lợi nhuận KH, doanh thu
    theo KH): lấy tỷ giá chốt trên đơn bán gắn lệnh — cùng tỷ giá với vế doanh
    thu, để so sánh hai vế trên một thước. Lệnh chưa có đơn bán, hay đơn chưa
    gán tỷ giá, thì số kế hoạch ngoại tệ nằm ở `missing`, không quy bừa.
  */
  const lsxFx = new Map<string, number>()
  for (const o of orders) {
    if (o.fx_rate != null && o.fx_rate > 0 && !lsxFx.has(o.currency)) {
      lsxFx.set(o.currency, o.fx_rate)
    }
  }
  const fxOf = (ccy: string) => (ccy === 'VND' ? 1 : (lsxFx.get(ccy) ?? null))

  // ── Sản phẩm của lệnh: gộp theo SP (một SP nhiều dòng vẫn là một SP) ──
  const byProduct = new Map<string, LaiLoProduct>()
  for (const l of lines) {
    const k = l.product_id ?? `code:${l.product_code}`
    const cur = byProduct.get(k)
    if (cur) {
      cur.qty += l.qty
      continue
    }
    const p = l.product_id ? plan.get(l.product_id) : undefined
    const ok = planComplete(p)
    byProduct.set(k, {
      product_id: l.product_id,
      code: l.product_code,
      qty: l.qty,
      price: ok ? p.price : null,
      direct: ok ? p.direct : null,
      overhead: ok ? p.overhead : null,
      profit: ok ? p.profit : null,
      currency: ok ? (p.currency ?? 'USD') : null,
    })
  }
  const products = [...byProduct.values()].sort(
    (a, b) => Number(a.price == null) - Number(b.price == null) || b.qty - a.qty,
  )
  const product_count = products.length
  const qty_total = products.reduce((s, p) => s + p.qty, 0)
  const planned = products.filter((p) => p.price != null)
  const planned_products = planned.length

  // ── Kế hoạch: Σ SL × (trực tiếp + chung), Σ SL × lợi nhuận, Σ SL × FOB ──
  let plan_cost: Quy | null = null
  let plan_profit: Quy | null = null
  let plan_revenue: Quy | null = null
  if (product_count > 0 && planned_products === product_count) {
    const pick = (f: (p: LaiLoProduct) => number) =>
      sumToBase(
        planned.map((p) => ({
          amount: p.qty * f(p),
          currency: p.currency ?? 'USD',
          rate: fxOf(p.currency ?? 'USD'),
        })),
      )
    plan_cost = quy(pick((p) => (p.direct ?? 0) + (p.overhead ?? 0)))
    plan_profit = quy(pick((p) => p.profit ?? 0))
    plan_revenue = quy(pick((p) => p.price ?? 0))
  } else if (product_count > 0) {
    missing.push({
      kind: 'plan',
      text: `${product_count - planned_products}/${product_count} SP chưa có giá thành kế hoạch`,
      short: `${product_count - planned_products}/${product_count} SP chưa giá thành`,
      who: 'Bán hàng dán từ bản báo giá',
      href: HREF.plan,
    })
  }

  // ── Doanh thu theo ĐƠN BÁN gắn lệnh ──
  const oLines = orders.flatMap(
    (o) =>
    (orderLinesOf.get(o.id) ?? []).map((l) => ({ ...l, currency: o.currency, rate: o.fx_rate })), // prettier-ignore
  )
  const order_lines = oLines.length
  const pricedLines = oLines.filter((l) => l.unit_price > 0)
  const priced_lines = pricedLines.length
  let revenue: Quy | null = null
  let revenue_source: LaiLoRow['revenue_source'] = null
  if (orders.length === 0) {
    missing.push({
      kind: 'order',
      text: 'Lệnh chưa gắn đơn bán nào — doanh thu tạm theo FOB kế hoạch',
      short: '0 đơn bán',
      who: 'Bán hàng gắn đơn vào lệnh',
      href: HREF.orders,
    })
  } else if (priced_lines === 0) {
    missing.push({
      kind: 'price',
      text: `${order_lines} dòng đơn bán chưa có đơn giá — doanh thu tạm theo FOB kế hoạch`,
      short: `${order_lines} dòng chưa giá bán`,
      who: 'Bán hàng điền ở Bảng giá đơn hàng',
      href: HREF.price,
    })
  } else {
    if (priced_lines < order_lines) {
      missing.push({
        kind: 'price',
        text: `${order_lines - priced_lines}/${order_lines} dòng đơn bán chưa có đơn giá`,
        short: `${order_lines - priced_lines}/${order_lines} dòng chưa giá bán`,
        who: 'Bán hàng điền ở Bảng giá đơn hàng',
        href: HREF.price,
      })
    }
    const q = quy(
      sumToBase(
        pricedLines.map((l) => ({
          amount: l.qty * l.unit_price,
          currency: l.currency,
          rate: l.currency === 'VND' ? 1 : (l.rate ?? null),
        })),
      ),
    )
    revenue = q
    revenue_source = 'order'
    if (q.missing.length > 0) {
      const n = orders.filter((o) => o.currency !== 'VND' && o.fx_rate == null).length
      missing.push({
        kind: 'so_fx',
        text: `${n} đơn bán ngoại tệ chưa có tỷ giá chốt`,
        short: `${n} đơn bán chưa tỷ giá`,
        who: 'Kế toán gán ở màn Tỷ giá',
        href: HREF.fx,
      })
    }
  }
  // Chưa có doanh thu đơn → tạm theo FOB kế hoạch, ghi rõ nguồn.
  if (revenue == null && plan_revenue != null) {
    revenue = plan_revenue
    revenue_source = 'plan'
  }

  // ── Đã cam kết mua: mọi đơn chưa huỷ, kể cả nháp; USD theo fx chốt từng đơn ──
  const committed = quy(
    sumToBase(
      pos.map((p) => ({
        amount: p.amount,
        currency: p.currency,
        rate: p.currency === 'VND' ? 1 : p.fx_rate,
      })),
    ),
  )
  const committed_draft = r0(
    pos
      .filter((p) => DRAFT_PO.has(p.status))
      .reduce((s, p) => s + (toBase(p.amount, p.currency, p.currency === 'VND' ? 1 : p.fx_rate) ?? 0), 0), // prettier-ignore
  )
  const po_missing_fx = pos.filter(
    (p) => p.currency !== 'VND' && p.fx_rate == null,
  ).length
  if (po_missing_fx > 0) {
    missing.push({
      kind: 'po_fx',
      text: `${po_missing_fx}/${pos.length} đơn mua ngoại tệ chưa có tỷ giá chốt`,
      short: `${po_missing_fx}/${pos.length} đơn mua chưa tỷ giá`,
      who: 'Kế toán gán ở màn Tỷ giá',
      href: HREF.fx,
    })
  }

  const supMap = new Map<string, LaiLoSupplier>()
  for (const p of pos) {
    const k = `${p.supplier_id} ${p.currency}`
    const cur = supMap.get(k) ?? {
      supplier_id: p.supplier_id,
      name: p.supplier_name,
      currency: p.currency,
      amount: 0,
      vnd: 0 as number | null,
      has_draft: false,
      po_count: 0,
    }
    cur.amount = r2(cur.amount + p.amount)
    const v = toBase(p.amount, p.currency, p.currency === 'VND' ? 1 : p.fx_rate)
    cur.vnd = v == null || cur.vnd == null ? null : r0(cur.vnd + v)
    cur.has_draft ||= DRAFT_PO.has(p.status)
    cur.po_count++
    supMap.set(k, cur)
  }
  const suppliers = [...supMap.values()].sort((a, b) => (b.vnd ?? 0) - (a.vnd ?? 0))

  // ── Kết luận — chỉ khi mọi vế liên quan ĐỦ (không có khoản chưa quy) ──
  const full = (q: Quy | null): q is Quy => q != null && q.missing.length === 0
  const ratio_pct =
    full(plan_cost) && full(committed) && plan_cost.vnd > 0
      ? Math.round((committed.vnd / plan_cost.vnd) * 1000) / 10
      : null
  const margin = full(revenue) && full(committed) ? r0(revenue.vnd - committed.vnd) : null

  let verdict: LaiLoVerdict = 'thieu'
  if (ratio_pct != null && ratio_pct > 100) verdict = 'lo'
  else if (margin != null && margin < 0) verdict = 'lo'
  else if (margin != null && full(plan_profit)) {
    verdict = margin < plan_profit.vnd ? 'an_lai' : 'on'
  } else if (margin != null && ratio_pct != null) verdict = 'on'

  return {
    lsx_id: lsx.id,
    code: lsx.code,
    status: lsx.status,
    customer_name: lsx.customer_name,
    product_count,
    qty_total,
    revenue,
    revenue_source,
    order_count: orders.length,
    order_lines,
    priced_lines,
    plan_cost,
    plan_profit,
    planned_products,
    committed,
    committed_draft,
    po_count: pos.length,
    po_missing_fx,
    ratio_pct,
    margin,
    verdict,
    missing,
    products,
    suppliers,
  }
}

function quy(s: ReturnType<typeof sumToBase>): Quy {
  return { vnd: r0(s.base), missing: s.missing }
}

/** Cộng nhiều khoản đã quy — phần thiếu gộp theo tiền tệ. */
export function mergeQuy(list: Quy[]): Quy {
  let vnd = 0
  const miss = new Map<string, number>()
  for (const q of list) {
    vnd += q.vnd
    for (const m of q.missing)
      miss.set(m.currency, r2((miss.get(m.currency) ?? 0) + m.amount))
  }
  return {
    vnd: r0(vnd),
    missing: [...miss].map(([currency, amount]) => ({ currency, amount })),
  }
}

function group<T, K>(list: T[], key: (t: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>()
  for (const t of list) {
    const k = key(t)
    const cur = out.get(k)
    if (cur) cur.push(t)
    else out.set(k, [t])
  }
  return out
}

/** Nhãn kết luận, một cụm tự đủ nghĩa — màu chỉ là phần phụ. */
export const VERDICT_LABEL: Record<LaiLoVerdict, string> = {
  lo: 'Nguy cơ lỗ',
  an_lai: 'Ăn vào lợi nhuận KH',
  on: 'Trong kế hoạch',
  thieu: 'Thiếu số để kết luận',
}
