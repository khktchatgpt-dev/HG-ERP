import { splitVat, type ReceiptMove } from './ap-receipt-ledger'

/**
 * CÔNG NỢ NCC THEO THÁNG — đúng cách Kế toán đang ghi sổ Excel (bản vẽ
 * Ht7MpqcutpTUyG4r4DvymN bản 3, duyệt 31/10/2026).
 *
 * Sổ Excel của Kế toán ("công nợ chi tiết", mỗi NCC một sheet) không có dư đầu,
 * đã trả, dư cuối: mỗi dòng là một lần giao một mặt hàng, cuối tháng chốt một
 * dòng "Tổng cộng T10/2026". Hai thứ module này dựng:
 *   · `monthRows` — Màn 1: mỗi NCC một dòng, ba số của tháng (chưa VAT · VAT ·
 *     tổng cộng).
 *   · `supplierSheet` — Màn 2: sổ một NCC theo tháng, từng dòng hàng.
 *
 * Luật số (giữ từ bản 1–2): tiền GỒM VAT theo thuế suất trên đơn mua (đơn ghi giá
 * đã gồm VAT thì tách ngược); ngày = ngày phiếu; phiếu đảo / trả NCC là số ÂM
 * trong tháng của chính nó — không sửa tháng của phiếu gốc. Dòng chưa có đơn giá
 * VẪN HIỆN nhưng không cộng (không bịa 0 đồng), và được đếm để dòng tổng nói ra.
 */

/** Một dòng hàng. `null` ở các ô tiền = dòng chưa có đơn giá. */
export type SheetLine = {
  name: string
  unit: string | null
  /** Có dấu: âm ở phiếu đảo / trả hàng. */
  qty: number
  price: number | null
  net: number | null
  vat: number | null
  amount: number | null
}

/** Một phiếu × đơn mua — các dòng hàng cùng phiếu, cùng đơn. */
export type SheetDoc = {
  key: string
  supplier_id: string
  supplier_name: string
  currency: string
  date: string
  doc_code: string
  party_doc_no: string | null
  po_code: string
  lsx_code: string | null
  /** `in` phiếu nhập · `reversal` đảo phiếu nhập · `return` trả hàng NCC · `unreversal` đảo phiếu trả. */
  kind: 'in' | 'reversal' | 'return' | 'unreversal'
  /** Phiếu gốc bị đảo (chỉ phiếu đảo) — "Đảo phiếu PNK-… (nhập 11/09)". */
  reversal_of: { code: string; date: string } | null
  lines: SheetLine[]
  net: number
  vat: number
  amount: number
  /** Số dòng chưa có đơn giá — không nằm trong `net/vat/amount`. */
  unpriced: number
}

export type SheetMonth = {
  /** YYYY-MM */
  month: string
  currency: string
  docs: SheetDoc[]
  net: number
  vat: number
  amount: number
  unpriced: number
}

/** Dòng Màn 1. */
export type MonthRow = {
  supplier_id: string
  supplier_name: string
  currency: string
  /** Số phiếu (phiếu × đơn đếm theo PHIẾU, không theo đơn). */
  docs: number
  net: number
  vat: number
  amount: number
  unpriced: number
  /** Số phiếu đảo / trả hàng trong tháng — dòng NCC nói ra để không ai tưởng số âm là lỗi. */
  reversals: number
}

const r2 = (n: number) => Math.round(n * 100) / 100
const monthOf = (d: string) => d.slice(0, 7)

function docKind(m: ReceiptMove): SheetDoc['kind'] {
  if (m.direction === 'in') return m.is_reversal ? 'unreversal' : 'in'
  return m.is_reversal ? 'reversal' : 'return'
}

/**
 * Gom movement thành phiếu (phiếu × đơn × chiều), mỗi phiếu giữ thứ tự dòng theo
 * id movement. Tiền tính theo DÒNG (VAT làm tròn từng dòng như sổ in), phiếu và
 * tháng là tổng của dòng.
 */
export function toDocs(
  moves: ReceiptMove[],
  reversalOf: Map<string, { code: string; date: string }> = new Map(),
): SheetDoc[] {
  const by = new Map<string, { m: ReceiptMove; items: ReceiptMove[] }>()
  for (const m of moves) {
    const k = `${m.doc_id}|${m.po_id}|${m.direction}`
    const cur = by.get(k) ?? { m, items: [] }
    cur.items.push(m)
    by.set(k, cur)
  }
  const out: SheetDoc[] = []
  for (const [key, { m, items }] of by) {
    const sign = m.direction === 'in' ? 1 : -1
    const lines: SheetLine[] = items
      .slice()
      .sort((a, b) => (a.line_order ?? 1e9) - (b.line_order ?? 1e9) || (a.move_id ?? '').localeCompare(b.move_id ?? ''))
      .map((it) => {
        const qty = sign * Math.abs(it.qty)
        if (it.unit_cost == null) {
          return { name: it.item_name ?? '—', unit: it.item_unit ?? null, qty, price: null, net: null, vat: null, amount: null } // prettier-ignore
        }
        const v = splitVat(
          Math.abs(it.qty) * it.unit_cost,
          it.vat_rate,
          it.price_includes_vat,
        )
        return {
          name: it.item_name ?? '—',
          unit: it.item_unit ?? null,
          qty,
          price: it.unit_cost,
          net: sign * v.net,
          vat: sign * v.vat,
          amount: sign * v.gross,
        }
      })
    const sum = (f: (l: SheetLine) => number | null) =>
      r2(lines.reduce((s, l) => s + (f(l) ?? 0), 0))
    out.push({
      key,
      supplier_id: m.supplier_id,
      supplier_name: m.supplier_name,
      currency: m.currency || 'VND',
      date: m.doc_date,
      doc_code: m.doc_code,
      party_doc_no: m.supplier_doc_no,
      po_code: m.po_code,
      lsx_code: m.lsx_code ?? null,
      kind: docKind(m),
      reversal_of: m.is_reversal ? (reversalOf.get(m.doc_id) ?? null) : null,
      lines,
      net: sum((l) => l.net),
      vat: sum((l) => l.vat),
      amount: sum((l) => l.amount),
      unpriced: lines.filter((l) => l.amount == null).length,
    })
  }
  return out.sort(
    (a, b) => a.date.localeCompare(b.date) || a.doc_code.localeCompare(b.doc_code) || a.po_code.localeCompare(b.po_code), // prettier-ignore
  )
}

/** Các tháng CÓ phiếu, mới nhất trước — để chọn tháng không bao giờ ra bảng trắng. */
export function monthsWithDocs(moves: ReceiptMove[]): { month: string; docs: number }[] {
  const by = new Map<string, Set<string>>()
  for (const m of moves) {
    const k = monthOf(m.doc_date)
    const s = by.get(k) ?? new Set<string>()
    s.add(m.doc_id)
    by.set(k, s)
  }
  return [...by]
    .map(([month, s]) => ({ month, docs: s.size }))
    .sort((a, b) => b.month.localeCompare(a.month))
}

/**
 * MÀN 1 — mỗi NCC × tiền tệ một dòng: ba số của tháng. VND trước, rồi theo tổng
 * cộng giảm dần (NCC lớn nhất ở trên, như cách Kế toán soát).
 */
export function monthRows(docs: SheetDoc[], month: string): MonthRow[] {
  const by = new Map<string, MonthRow & { docIds: Set<string> }>()
  for (const d of docs) {
    if (monthOf(d.date) !== month) continue
    const k = `${d.supplier_id}|${d.currency}`
    const cur =
      by.get(k) ??
      { supplier_id: d.supplier_id, supplier_name: d.supplier_name, currency: d.currency, docs: 0, net: 0, vat: 0, amount: 0, unpriced: 0, reversals: 0, docIds: new Set<string>() } // prettier-ignore
    cur.docIds.add(d.doc_code)
    cur.net += d.net
    cur.vat += d.vat
    cur.amount += d.amount
    cur.unpriced += d.unpriced
    if (d.kind === 'reversal' || d.kind === 'return') cur.reversals += 1
    by.set(k, cur)
  }
  return [...by.values()]
    .map(({ docIds, ...r }) => ({
      ...r,
      docs: docIds.size,
      net: r2(r.net),
      vat: r2(r.vat),
      amount: r2(r.amount),
    }))
    .sort(
      (a, b) =>
        (a.currency === 'VND' ? 0 : 1) - (b.currency === 'VND' ? 0 : 1) ||
        a.currency.localeCompare(b.currency) ||
        b.amount - a.amount ||
        a.supplier_name.localeCompare(b.supplier_name),
    )
}

/** Cộng Màn 1 theo tiền tệ — dòng "Tổng cộng" của từng nhóm, không bao giờ cộng lẫn. */
export function monthTotals(rows: MonthRow[]): {
  currency: string
  suppliers: number
  docs: number
  net: number
  vat: number
  amount: number
}[] {
  const by = new Map<string, { suppliers: number; docs: number; net: number; vat: number; amount: number }>() // prettier-ignore
  for (const r of rows) {
    const t = by.get(r.currency) ?? { suppliers: 0, docs: 0, net: 0, vat: 0, amount: 0 }
    t.suppliers += 1
    t.docs += r.docs
    t.net += r.net
    t.vat += r.vat
    t.amount += r.amount
    by.set(r.currency, t)
  }
  return [...by].map(([currency, t]) => ({
    currency,
    ...t,
    net: r2(t.net),
    vat: r2(t.vat),
    amount: r2(t.amount),
  }))
}

/**
 * MÀN 2 — sổ một NCC: các tháng MỚI NHẤT TRƯỚC (Q15 — mở ra là thấy tháng đang
 * làm), trong tháng xếp theo ngày tăng dần như sổ Excel. Mỗi tháng × tiền tệ một
 * khối có dòng chốt.
 */
export function supplierSheet(docs: SheetDoc[]): SheetMonth[] {
  const by = new Map<string, SheetMonth>()
  for (const d of docs) {
    const currency = d.currency
    const k = `${monthOf(d.date)}|${currency}`
    const cur = by.get(k) ?? { month: monthOf(d.date), currency, docs: [], net: 0, vat: 0, amount: 0, unpriced: 0 } // prettier-ignore
    cur.docs.push(d)
    cur.net += d.net
    cur.vat += d.vat
    cur.amount += d.amount
    cur.unpriced += d.unpriced
    by.set(k, cur)
  }
  return [...by.values()]
    .map((m) => ({ ...m, net: r2(m.net), vat: r2(m.vat), amount: r2(m.amount) }))
    .sort(
      (a, b) => b.month.localeCompare(a.month) || a.currency.localeCompare(b.currency),
    )
}
