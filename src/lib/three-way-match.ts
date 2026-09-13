import { poLineAmount, type PriceBasis } from './po-line'

/**
 * ĐỐI CHIẾU BA CHIỀU — ĐẶT / VỀ / NCC ĐÒI, theo TỪNG DÒNG đơn mua.
 *
 * Vì sao cần: công nợ hôm nay tính bằng "giá trị hàng đã nhận − đã trả"
 * (`payables.repo.ts`). Nó đếm hụt và chính mã tự thú bằng `missing_price_count`
 * — phiếu nhập không có giá thì khoản nợ đó biến mất khỏi sổ. Nhưng thứ mình
 * PHẢI TRẢ không phải hàng đã nhận, mà là **hoá đơn NCC xuất ra**: VAT nằm trên
 * hoá đơn, và NCC đòi theo tờ giấy chứ không theo phiếu kho của mình.
 *
 * Ba sổ cùng quy về `po_line_id` nên trả lời được "lệch nằm ở ĐÂU", không chỉ
 * "tổng có lệch không":
 *
 *   ĐẶT   dòng đơn mua        — mình cam kết mua bao nhiêu, giá nào
 *   VỀ    phiếu nhập kho      — thực tế vào kho bao nhiêu (phiếu đảo trừ lại)
 *   ĐÒI   dòng hoá đơn NCC    — NCC xuất hoá đơn đòi bao nhiêu
 *
 * File thuần, có test. Tiền của dòng ĐẶT đi qua `poLineAmount` chứ không nhân
 * lại tại chỗ — dòng nhôm tính theo tổng kg (`price_basis: 'unit2'`), nhân
 * thẳng `qty × giá` là ra số khác hẳn.
 */

const EPS = 0.000001

/** Dòng đơn mua — vế ĐẶT. */
export type MatchPoLine = {
  id: string
  material_code: string | null
  material_name: string
  unit: string | null
  qty_ordered: number
  unit_price: number | null
  price_basis?: PriceBasis | null
  qty2?: number | null
  /** Dòng đã chốt thiếu (0154) — phần chưa về sẽ không bao giờ về nữa. */
  closed_short_at?: string | null
}

/** Một lần hàng vào/ra kho gắn dòng đơn — vế VỀ. `out` là phiếu đảo. */
export type MatchMovement = {
  po_line_id: string
  direction: 'in' | 'out'
  qty: number
  unit_cost: number | null
}

/** Một dòng hoá đơn NCC — vế ĐÒI. */
export type MatchInvoiceLine = {
  po_line_id: string | null
  invoice_id: string
  invoice_no: string
  qty: number
  unit_price: number
  amount: number
}

/**
 * Kết luận của một dòng. `verdict` là thứ màn hình tô màu và người đọc tin,
 * nên nó phải nói ĐÚNG MỘT chuyện — không gộp "thiếu hoá đơn" với "lệch giá"
 * thành một nhãn chung chung.
 */
export type MatchVerdict =
  /** Ba vế khớp nhau trong sai số làm tròn. */
  | 'khop'
  /** Hàng đã về, NCC chưa xuất hoá đơn — nợ CÓ THẬT mà chưa có giấy tờ. */
  | 'cho_hoa_don'
  /** NCC đã đòi tiền phần hàng chưa vào kho. */
  | 'doi_truoc'
  /** Số lượng khớp nhưng tiền lệch — đơn giá trên hoá đơn khác đơn giá đã đặt. */
  | 'lech_gia'
  /** Chưa về gì và cũng chưa có hoá đơn — bình thường, chỉ là chưa tới lượt. */
  | 'chua_phat_sinh'

export type MatchRow = {
  po_line_id: string
  material_code: string | null
  material_name: string
  unit: string | null
  qty_ordered: number
  amount_ordered: number
  qty_received: number
  amount_received: number
  qty_invoiced: number
  amount_invoiced: number
  /** Hoá đơn nào đang đòi dòng này — để bấm sang tờ giấy tương ứng. */
  invoices: { invoice_id: string; invoice_no: string }[]
  /** VỀ − ĐÒI. Dương = đã nhận nhiều hơn phần đã có hoá đơn. */
  qty_gap: number
  amount_gap: number
  verdict: MatchVerdict
  closed_short: boolean
}

/**
 * Ghép ba sổ theo `po_line_id`.
 *
 * Dòng hoá đơn KHÔNG gắn dòng đơn mua (phí vận chuyển, chênh lệch làm tròn) bị
 * bỏ qua ở đây có chủ ý: chúng không có vế "đặt" để so, nên nhét vào bảng đối
 * chiếu chỉ làm bẩn con số. Chúng được cộng riêng — xem `unlinkedInvoiceAmount`.
 */
export function threeWayMatch(
  poLines: MatchPoLine[],
  movements: MatchMovement[],
  invoiceLines: MatchInvoiceLine[],
): MatchRow[] {
  const recv = new Map<string, { qty: number; amount: number }>()
  for (const m of movements) {
    const sign = m.direction === 'in' ? 1 : -1
    const cur = recv.get(m.po_line_id) ?? { qty: 0, amount: 0 }
    cur.qty += sign * m.qty
    // Phiếu nhập KHÔNG có giá đóng góp 0 đồng — đây chính là chỗ công nợ theo
    // sổ kho đếm hụt. Số lượng vẫn cộng, nên bảng bày ra được "về rồi mà tiền
    // bằng 0" thay vì giấu cả dòng đi.
    cur.amount += sign * m.qty * (m.unit_cost ?? 0)
    recv.set(m.po_line_id, cur)
  }

  const inv = new Map<
    string,
    { qty: number; amount: number; docs: Map<string, string> }
  >()
  for (const l of invoiceLines) {
    if (!l.po_line_id) continue
    const cur = inv.get(l.po_line_id) ?? { qty: 0, amount: 0, docs: new Map() }
    cur.qty += l.qty
    cur.amount += l.amount
    cur.docs.set(l.invoice_id, l.invoice_no)
    inv.set(l.po_line_id, cur)
  }

  return poLines.map((l) => {
    const r = recv.get(l.id) ?? { qty: 0, amount: 0 }
    const v = inv.get(l.id) ?? { qty: 0, amount: 0, docs: new Map<string, string>() }
    const qty_gap = round3(r.qty - v.qty)
    const amount_gap = round2(r.amount - v.amount)
    return {
      po_line_id: l.id,
      material_code: l.material_code,
      material_name: l.material_name,
      unit: l.unit,
      qty_ordered: l.qty_ordered,
      amount_ordered: round2(poLineAmount({ qty_ordered: l.qty_ordered, unit_price: l.unit_price, price_basis: l.price_basis, qty2: l.qty2 })), // prettier-ignore
      qty_received: round3(r.qty),
      amount_received: round2(r.amount),
      qty_invoiced: round3(v.qty),
      amount_invoiced: round2(v.amount),
      invoices: [...v.docs].map(([invoice_id, invoice_no]) => ({ invoice_id, invoice_no })), // prettier-ignore
      qty_gap,
      amount_gap,
      verdict: verdictOf(r, v, qty_gap, amount_gap),
      closed_short: !!l.closed_short_at,
    }
  })
}

function verdictOf(
  r: { qty: number; amount: number },
  v: { qty: number; amount: number },
  qtyGap: number,
  amountGap: number,
): MatchVerdict {
  if (r.qty <= EPS && v.qty <= EPS) return 'chua_phat_sinh'
  if (qtyGap > EPS) return 'cho_hoa_don'
  if (qtyGap < -EPS) return 'doi_truoc'
  // Số lượng bằng nhau: còn lệch tiền thì chỉ có thể do đơn giá.
  //
  // Ngưỡng 1 đồng, không phải EPS: hoá đơn NCC làm tròn tới đồng, nên chênh
  // vài xu do quy đổi là tiếng ồn chứ không phải tranh chấp. Báo động vì một
  // xu thì người dùng học cách phớt lờ cảnh báo — rồi bỏ qua cả cái thật.
  if (Math.abs(amountGap) >= 1) return 'lech_gia'
  return 'khop'
}

/**
 * Tiền trên hoá đơn KHÔNG gắn dòng đơn mua nào — phí vận chuyển, bao bì, chênh
 * lệch làm tròn. Phải bày riêng: gộp vào bảng đối chiếu thì mọi dòng đều "lệch",
 * mà giấu đi thì tổng hoá đơn không bao giờ khớp tổng bảng.
 */
export function unlinkedInvoiceAmount(invoiceLines: MatchInvoiceLine[]): number {
  return round2(
    invoiceLines.filter((l) => !l.po_line_id).reduce((s, l) => s + l.amount, 0),
  )
}

/** Gộp kết luận cả đơn — để dải đầu trang nói được một câu. */
export function matchSummary(rows: MatchRow[]): {
  total: number
  byVerdict: Record<MatchVerdict, number>
  /** Đã về mà chưa có hoá đơn — nợ thật chưa có giấy. */
  amount_cho_hoa_don: number
  /** NCC đòi phần chưa về. */
  amount_doi_truoc: number
  /** Tổng trị giá chênh do đơn giá. */
  amount_lech_gia: number
} {
  const byVerdict = { khop: 0, cho_hoa_don: 0, doi_truoc: 0, lech_gia: 0, chua_phat_sinh: 0 } as Record<MatchVerdict, number> // prettier-ignore
  let cho = 0
  let doi = 0
  let lech = 0
  for (const r of rows) {
    byVerdict[r.verdict] += 1
    if (r.verdict === 'cho_hoa_don') cho += r.amount_gap
    if (r.verdict === 'doi_truoc') doi += -r.amount_gap
    if (r.verdict === 'lech_gia') lech += r.amount_gap
  }
  return {
    total: rows.length,
    byVerdict,
    amount_cho_hoa_don: round2(cho),
    amount_doi_truoc: round2(doi),
    amount_lech_gia: round2(lech),
  }
}

export const VERDICT_LABEL: Record<MatchVerdict, string> = {
  khop: 'Khớp',
  cho_hoa_don: 'Chờ hoá đơn',
  doi_truoc: 'NCC đòi trước',
  lech_gia: 'Lệch giá',
  chua_phat_sinh: 'Chưa phát sinh',
}

const round2 = (n: number) => Math.round(n * 100) / 100
const round3 = (n: number) => Math.round(n * 1000) / 1000
