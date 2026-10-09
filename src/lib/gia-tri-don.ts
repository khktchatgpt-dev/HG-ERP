/**
 * GIÁ TRỊ ĐƠN THEO LỆNH — bảng kê thuần (02/10/2026, chủ dự án chốt sau khi
 * xem màn lãi/lỗ: "chưa cần tính lời lỗ, cần thống kê trước giá trị các đơn
 * hàng theo lệnh sản xuất và giá trị các đơn đặt hàng, rồi mình tính tới
 * chênh lệch").
 *
 * Hai khối số, cộng THẲNG từ chứng từ, không suy luận:
 *   - Đơn bán của lệnh  = Σ SL × đơn giá trên từng đơn bán gắn lệnh (đúng số
 *     Bán hàng nhập). Đơn giá 0 thì là 0 — KHÔNG thay bằng FOB kế hoạch; cột
 *     "dòng có giá" nói thẳng còn bao nhiêu dòng chưa nhập giá.
 *   - Đơn mua cho lệnh  = Σ tiền đơn mua gắn lệnh chưa huỷ, kể cả nháp (ý định
 *     chi) — nháp được tách riêng để biết phần NCC chưa biết.
 *
 * Quy VND theo tỷ giá CHỐT trên từng chứng từ (`fx_rate`). Chứng từ ngoại tệ
 * chưa có tỷ giá thì phần đó nằm ở `missing`, không đoán. Chênh lệch bán − mua
 * CHƯA tính ở đây — là bước sau, khi đơn bán đã có giá đủ.
 *
 * Thuần, có test. Service đọc DB rồi giao hết cho `giaTriDonBoard`.
 */

export type GtdLsx = { id: string; code: string; status: string; customer_name: string | null } // prettier-ignore
export type GtdOrder = {
  id: string
  code: string
  lsx_id: string
  status: string
  currency: string
  fx_rate: number | null
  due_date: string | null
}
export type GtdOrderLine = { order_id: string; qty: number; unit_price: number }
export type GtdPo = {
  id: string
  code: string
  lsx_id: string
  supplier_name: string
  status: string
  currency: string
  fx_rate: number | null
  /** Σ dòng theo `poLineAmount`, tiền tệ của đơn. */
  amount: number
  /** Đơn còn gộp thêm lệnh khác (0185) — đang tính TRỌN cho lệnh này. */
  extra_lsx: boolean
}

/** Một khoản đã quy VND, kèm phần KHÔNG quy được vì thiếu tỷ giá. */
export type GtdQuy = { vnd: number; missing: { currency: string; amount: number }[] }

export type GtdOrderRow = {
  id: string
  code: string
  status: string
  currency: string
  amount: number
  fx_rate: number | null
  /** null khi ngoại tệ chưa có tỷ giá. */
  vnd: number | null
  due_date: string | null
  lines: number
  priced_lines: number
}
export type GtdPoRow = {
  id: string
  code: string
  supplier_name: string
  status: string
  currency: string
  amount: number
  fx_rate: number | null
  vnd: number | null
  draft: boolean
  extra_lsx: boolean
}

/**
 * Vì sao chênh lệch của một lệnh CHƯA đáng tin trọn — màn nói ra ngay cạnh số:
 * - `thieu_gia`: còn dòng đơn bán giá 0 → phần bán đang thiếu, chênh lệch thấp hơn thật.
 * - `thieu_ty_gia`: có đơn (bán hoặc mua) ngoại tệ chưa tỷ giá → khoản đó không vào phép trừ.
 * - `gop_lenh`: có đơn mua gộp nhiều lệnh, đang trừ TRỌN vào lệnh này (lệnh chính trừ thừa, lệnh kia trừ thiếu).
 * - `chua_mua`: chưa có đơn mua nào → chênh lệch = cả giá bán, chưa nói gì.
 */
export type GtdDiffWarn = 'thieu_gia' | 'thieu_ty_gia' | 'gop_lenh' | 'chua_mua'
export type GtdDiff = {
  /** Bán − mua, VND đã quy. null = lệnh chưa có đơn bán ghi giá — không có gì để trừ. */
  vnd: number | null
  /** Mua / bán, % — mua ăn bao nhiêu phần giá bán. null khi bán = 0. */
  buy_pct: number | null
  warn: GtdDiffWarn[]
}

export type GtdRow = {
  lsx_id: string
  code: string
  status: string
  customer_name: string | null
  /* ---- đơn bán của lệnh ---- */
  order_count: number
  /** Giá trị gốc theo từng tiền tệ, đúng số trên đơn. */
  order_amounts: { currency: string; amount: number }[]
  order_vnd: GtdQuy
  order_lines: number
  priced_lines: number
  orders: GtdOrderRow[]
  /* ---- đơn mua cho lệnh ---- */
  po_count: number
  po_vnd: GtdQuy
  /** Phần cam kết còn ở nháp / chờ duyệt (VND quy được). */
  po_draft_vnd: number
  po_extra_lsx: number
  pos: GtdPoRow[]
  /* ---- chênh lệch bán − mua (09/10/2026) ---- */
  diff: GtdDiff
}

/** Tổng chênh lệch của một tập lệnh — CHỈ cộng lệnh có đơn bán ghi giá. */
export type GtdDiffSum = {
  vnd: number
  buy_pct: number | null
  /** Số lệnh góp vào tổng (lệnh chưa có giá bán bị bỏ ra, không trừ mua của chúng). */
  lsx: number
  /** Trong số đó, bao nhiêu lệnh có lý do khiến số chưa trọn (`warn` khác rỗng). */
  lsx_warn: number
}

export type GtdBoard = {
  rows: GtdRow[]
  totals: {
    lsx_count: number
    order_count: number
    order_amounts: { currency: string; amount: number }[]
    order_vnd: GtdQuy
    order_lines: number
    priced_lines: number
    /** Lệnh có ít nhất một dòng đơn bán ghi giá. */
    lsx_with_price: number
    lsx_without_orders: number
    po_count: number
    po_vnd: GtdQuy
    po_draft_vnd: number
    po_extra_lsx: number
    lsx_without_pos: number
    diff: GtdDiffSum
  }
}

const DRAFT_PO = new Set(['draft', 'pending_approval'])
const r0 = (n: number) => Math.round(n)
const r2 = (n: number) => Math.round(n * 100) / 100

function toVnd(amount: number, currency: string, fx: number | null): number | null {
  if (currency === 'VND') return amount
  return fx == null || fx <= 0 ? null : amount * fx
}

function quyOf(
  items: { amount: number; currency: string; vnd: number | null }[],
): GtdQuy {
  let vnd = 0
  const miss = new Map<string, number>()
  for (const it of items) {
    if (it.vnd == null)
      miss.set(it.currency, r2((miss.get(it.currency) ?? 0) + it.amount))
    else vnd += it.vnd
  }
  return { vnd: r0(vnd), missing: [...miss].map(([currency, amount]) => ({ currency, amount })) } // prettier-ignore
}

/** Cộng nhiều khoản đã quy — phần thiếu gộp theo tiền tệ. */
export function mergeGtdQuy(list: GtdQuy[]): GtdQuy {
  let vnd = 0
  const miss = new Map<string, number>()
  for (const q of list) {
    vnd += q.vnd
    for (const m of q.missing) miss.set(m.currency, r2((miss.get(m.currency) ?? 0) + m.amount)) // prettier-ignore
  }
  return { vnd: r0(vnd), missing: [...miss].map(([currency, amount]) => ({ currency, amount })) } // prettier-ignore
}

function sumByCurrency(list: { currency: string; amount: number }[]) {
  const m = new Map<string, number>()
  for (const it of list) m.set(it.currency, r2((m.get(it.currency) ?? 0) + it.amount))
  return [...m].filter(([, a]) => a !== 0).map(([currency, amount]) => ({ currency, amount })) // prettier-ignore
}

const pct1 = (part: number, whole: number) =>
  whole > 0 ? Math.round((part / whole) * 1000) / 10 : null

/**
 * Chênh lệch bán − mua của MỘT lệnh. Chỉ trừ hai số đã quy VND, không đoán phần
 * thiếu: lệnh chưa có đơn bán ghi giá → `vnd = null` (đừng bày "−8 tỷ" chỉ vì
 * Bán hàng chưa nhập giá). Mua tính MỌI đơn chưa huỷ, kể cả nháp — cùng số với
 * cột "VND quy đổi" của khối đơn mua, để phép trừ đọc lại được bằng mắt.
 */
function diffOf(
  r: Pick<GtdRow, 'order_vnd' | 'po_vnd' | 'order_lines' | 'priced_lines' | 'po_count' | 'po_extra_lsx'>, // prettier-ignore
): GtdDiff {
  if (r.priced_lines === 0 || r.order_vnd.vnd === 0) {
    return { vnd: null, buy_pct: null, warn: [] }
  }
  const warn: GtdDiffWarn[] = []
  if (r.priced_lines < r.order_lines) warn.push('thieu_gia')
  if (r.order_vnd.missing.length + r.po_vnd.missing.length > 0) warn.push('thieu_ty_gia')
  if (r.po_extra_lsx > 0) warn.push('gop_lenh')
  if (r.po_count === 0) warn.push('chua_mua')
  return {
    vnd: r0(r.order_vnd.vnd - r.po_vnd.vnd),
    buy_pct: pct1(r.po_vnd.vnd, r.order_vnd.vnd),
    warn,
  }
}

/** Tổng chênh lệch — cùng hàm cho dải đầu trang và chân bảng đang lọc. */
export function sumGtdDiff(rows: GtdRow[]): GtdDiffSum {
  const on = rows.filter((r) => r.diff.vnd != null)
  const sell = on.reduce((s, r) => s + r.order_vnd.vnd, 0)
  const buy = on.reduce((s, r) => s + r.po_vnd.vnd, 0)
  return {
    vnd: r0(sell - buy),
    buy_pct: pct1(buy, sell),
    lsx: on.length,
    lsx_warn: on.filter((r) => r.diff.warn.length > 0).length,
  }
}

export function giaTriDonBoard(input: {
  lsx: GtdLsx[]
  orders: GtdOrder[]
  orderLines: GtdOrderLine[]
  pos: GtdPo[]
}): GtdBoard {
  const linesByOrder = new Map<string, GtdOrderLine[]>()
  for (const l of input.orderLines) {
    const arr = linesByOrder.get(l.order_id) ?? []
    arr.push(l)
    linesByOrder.set(l.order_id, arr)
  }

  const rows: GtdRow[] = input.lsx.map((L) => {
    const orders: GtdOrderRow[] = input.orders
      .filter((o) => o.lsx_id === L.id)
      .map((o) => {
        const ls = linesByOrder.get(o.id) ?? []
        const amount = r2(ls.reduce((s, l) => s + l.qty * l.unit_price, 0))
        return {
          id: o.id,
          code: o.code,
          status: o.status,
          currency: o.currency,
          amount,
          fx_rate: o.fx_rate,
          vnd: toVnd(amount, o.currency, o.fx_rate),
          due_date: o.due_date,
          lines: ls.length,
          priced_lines: ls.filter((l) => l.unit_price > 0).length,
        }
      })
      .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? '') || a.code.localeCompare(b.code)) // prettier-ignore

    const pos: GtdPoRow[] = input.pos
      .filter((p) => p.lsx_id === L.id)
      .map((p) => ({
        id: p.id,
        code: p.code,
        supplier_name: p.supplier_name,
        status: p.status,
        currency: p.currency,
        amount: p.amount,
        fx_rate: p.fx_rate,
        vnd: toVnd(p.amount, p.currency, p.fx_rate),
        draft: DRAFT_PO.has(p.status),
        extra_lsx: p.extra_lsx,
      }))
      .sort((a, b) => (b.vnd ?? 0) - (a.vnd ?? 0) || a.code.localeCompare(b.code))

    const base = {
      lsx_id: L.id,
      code: L.code,
      status: L.status,
      customer_name: L.customer_name,
      order_count: orders.length,
      order_amounts: sumByCurrency(orders),
      order_vnd: quyOf(orders),
      order_lines: orders.reduce((s, o) => s + o.lines, 0),
      priced_lines: orders.reduce((s, o) => s + o.priced_lines, 0),
      orders,
      po_count: pos.length,
      po_vnd: quyOf(pos),
      po_draft_vnd: r0(pos.reduce((s, p) => s + (p.draft ? (p.vnd ?? 0) : 0), 0)),
      po_extra_lsx: pos.filter((p) => p.extra_lsx).length,
      pos,
    }
    return { ...base, diff: diffOf(base) }
  })

  // Lệnh có đơn bán ghi giá lên đầu (so được ngay), rồi theo tiền mua giảm dần —
  // Giám đốc đọc từ trên xuống là gặp thứ đang có số trước, thứ còn thiếu sau.
  rows.sort(
    (a, b) =>
      Number(b.priced_lines > 0) - Number(a.priced_lines > 0) ||
      b.order_vnd.vnd - a.order_vnd.vnd ||
      b.po_vnd.vnd - a.po_vnd.vnd ||
      a.code.localeCompare(b.code),
  )

  return {
    rows,
    totals: {
      lsx_count: rows.length,
      order_count: rows.reduce((s, r) => s + r.order_count, 0),
      order_amounts: sumByCurrency(rows.flatMap((r) => r.order_amounts)),
      order_vnd: mergeGtdQuy(rows.map((r) => r.order_vnd)),
      order_lines: rows.reduce((s, r) => s + r.order_lines, 0),
      priced_lines: rows.reduce((s, r) => s + r.priced_lines, 0),
      lsx_with_price: rows.filter((r) => r.priced_lines > 0).length,
      lsx_without_orders: rows.filter((r) => r.order_count === 0).length,
      po_count: rows.reduce((s, r) => s + r.po_count, 0),
      po_vnd: mergeGtdQuy(rows.map((r) => r.po_vnd)),
      po_draft_vnd: r0(rows.reduce((s, r) => s + r.po_draft_vnd, 0)),
      po_extra_lsx: rows.reduce((s, r) => s + r.po_extra_lsx, 0),
      lsx_without_pos: rows.filter((r) => r.po_count === 0).length,
      diff: sumGtdDiff(rows),
    },
  }
}
