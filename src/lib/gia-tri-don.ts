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

    return {
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
    },
  }
}
