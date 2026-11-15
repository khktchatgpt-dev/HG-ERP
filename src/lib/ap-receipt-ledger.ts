import type { LedgerEntry } from './ap-ledger'
import { dueDate, resolveTerm, type Term } from './payment-terms'

/**
 * SỔ CÔNG NỢ THEO HÀNG ĐÃ NHẬN — biến phiếu nhập kho thành bút toán sổ.
 *
 * Vì sao có cơ sở thứ hai bên cạnh sổ theo hoá đơn (`ap-ledger.ts`): đo
 * 31/10/2026, Cung ứng đã ghi 154 phiếu nhập gắn đơn mua (7,66 tỷ gồm VAT) mà
 * ERP chưa có tờ hoá đơn NCC nào, nên sổ theo hoá đơn trắng tinh trong khi Kế
 * toán vẫn phải trả lời "tháng này nợ từng NCC bao nhiêu". Chủ dự án duyệt
 * 31/10 (bản vẽ Ht7MpqcutpTUyG4r4DvymN): tính theo hàng nhận, gồm VAT theo đơn.
 *
 * ⭐ HAI CƠ SỞ KHÔNG BAO GIỜ CỘNG VÀO NHAU. Một khoản hàng sẽ lên sổ hai lần nếu
 * vừa đếm phiếu nhập vừa đếm hoá đơn của chính lô đó. Màn hình chọn MỘT cơ sở.
 *
 * Luật (Q1–Q3 của bản vẽ):
 *   · Mỗi phiếu × đơn mua = MỘT bút toán (một phiếu nhập có thể gom nhiều đơn).
 *   · Số tiền GỒM VAT theo thuế suất đầu đơn; đơn ghi giá đã gồm VAT thì giữ
 *     nguyên và tách ngược phần VAT để sổ chi tiết bày hai cột.
 *   · Ngày = ngày phiếu. Phiếu đảo / trả NCC ghi theo NGÀY CỦA NÓ — không sửa
 *     tháng của phiếu gốc, nên tháng đã đối chiếu không tự đổi số.
 *   · Dòng chưa có đơn giá KHÔNG thành 0 đồng: bỏ ra và đếm riêng (`unpricedBy`).
 */

export type ReceiptMove = {
  /** Id movement — giữ thứ tự dòng hàng ổn định trong một phiếu. */
  move_id?: string
  /** Thứ tự dòng trên đơn mua — dòng hàng của một phiếu xếp theo đúng thứ tự đơn. */
  line_order?: number | null
  /** Tên hàng (tên vật tư + quy cách, hoặc tên dòng gõ tay) — cột "Tên SP" của sổ Kế toán. */
  item_name?: string
  /** ĐVT của dòng hàng. */
  item_unit?: string | null
  /** Mã lệnh sản xuất của đơn mua. */
  lsx_code?: string | null
  qty: number
  /** `null` = chưa biết giá — khác hẳn 0 ("hàng cho không"). */
  unit_cost: number | null
  direction: 'in' | 'out'
  doc_id: string
  doc_code: string
  /** YYYY-MM-DD — ngày phiếu. */
  doc_date: string
  supplier_doc_no: string | null
  /** Phiếu này là phiếu ĐẢO của một phiếu khác. */
  is_reversal: boolean
  /** Id phiếu gốc mà phiếu này đảo (khi `is_reversal`). */
  reversal_of_doc_id?: string | null
  po_id: string
  po_code: string
  currency: string
  supplier_id: string
  supplier_name: string
  vat_rate: number | null
  price_includes_vat: boolean
  terms_payment: string | null
  supplier_net_days: number | null
}

const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * Tách tiền hàng / VAT / tổng từ giá trị phiếu (`SL × đơn giá phiếu`).
 *
 * Đơn giá phiếu nhập = `tiền dòng ÷ SL đặt` của đơn (`poLineUnitCosts`), tức
 * mang đúng cách ghi giá của đơn: đơn "giá đã gồm VAT" thì giá trị phiếu đã là
 * tổng. VAT làm tròn theo BÚT TOÁN (mỗi phiếu × đơn), không theo tổng tháng —
 * cùng luật "số in ra giấy" của `lsx-finance`.
 */
export function splitVat(
  value: number,
  vatRate: number | null,
  includesVat: boolean,
): { net: number; vat: number; gross: number } {
  const rate = Math.max(0, Number(vatRate ?? 0)) / 100
  if (includesVat) {
    const gross = r2(value)
    const net = r2(gross / (1 + rate))
    return { net, vat: r2(gross - net), gross }
  }
  const net = r2(value)
  const vat = r2(net * rate)
  return { net, vat, gross: r2(net + vat) }
}

/** Mọi bút toán phiếu nhập / trả hàng của tập movement — chưa lọc kỳ (sổ tự lọc). */
export function receiptEntries(
  moves: ReceiptMove[],
  companyDefault: Term | null,
): LedgerEntry[] {
  type Acc = { m: ReceiptMove; value: number; items: ReceiptMove[] }
  const by = new Map<string, Acc>()
  for (const m of moves) {
    if (m.unit_cost == null) continue
    const k = `${m.doc_id}|${m.po_id}|${m.direction}`
    const cur = by.get(k) ?? { m, value: 0, items: [] }
    cur.value += m.qty * m.unit_cost
    cur.items.push(m)
    by.set(k, cur)
  }

  const out: LedgerEntry[] = []
  for (const { m, value, items } of by.values()) {
    const { net, vat, gross } = splitVat(value, m.vat_rate, m.price_includes_vat)
    if (gross === 0) continue
    const isIn = m.direction === 'in'
    const due = isIn
      ? dueDate(
          m.doc_date,
          resolveTerm({
            poTerms: m.terms_payment,
            supplierDays: m.supplier_net_days,
            companyDefault,
          }).term,
        )
      : null
    out.push({
      supplier_id: m.supplier_id,
      supplier_name: m.supplier_name,
      currency: m.currency || 'VND',
      date: m.doc_date,
      // Số âm (vd đảo một phiếu đảo) đổi chiều thay vì ghi số âm.
      kind: (isIn ? gross > 0 : gross < 0) ? 'invoice' : 'return',
      doc_no: m.doc_code,
      amount: Math.abs(gross),
      net: Math.abs(net),
      vat: Math.abs(vat),
      label: isIn
        ? m.is_reversal
          ? 'Đảo phiếu trả hàng'
          : 'Phiếu nhập'
        : m.is_reversal
          ? 'Đảo phiếu nhập'
          : 'Trả hàng NCC',
      po_code: m.po_code,
      party_doc_no: m.supplier_doc_no,
      due,
      lsx_code: m.lsx_code ?? null,
      items: items
        .slice()
        .sort((a, b) => (a.move_id ?? '').localeCompare(b.move_id ?? ''))
        .map((it) => {
          const v = splitVat(
            it.qty * (it.unit_cost ?? 0),
            it.vat_rate,
            it.price_includes_vat,
          )
          return {
            name: it.item_name ?? '—',
            unit: it.item_unit ?? null,
            qty: Math.abs(it.qty),
            price: it.unit_cost ?? 0,
            net: Math.abs(v.net),
            vat: Math.abs(v.vat),
            amount: Math.abs(v.gross),
          }
        }),
    })
  }
  return out
}

/**
 * Số ghi ở ô "số phiếu giao NCC" trông như MÃ ĐƠN CỦA HG ("6/2026- HG/MT",
 * "17/10/2026 HG-YD") chứ không phải số in trên phiếu giao của NCC. Đo 31/10/2026:
 * 32/154 phiếu có ghi và cả 32 đều là mã đơn HG — Kế toán khớp dòng bằng số
 * phiếu NCC (18457, 16016…) nên không khớp được.
 */
export const looksLikeHgCode = (s: string | null | undefined): boolean =>
  /(^|[^a-z])hg([^a-z]|$)/i.test(s ?? '')

/**
 * Tên dòng hàng = tên vật tư + quy cách, nhưng KHÔNG lặp quy cách khi tên vật tư
 * đã chứa nó (đo 31/10/2026: "Ắc gai 8x70 taro gai 6x20" + quy cách "8x70 taro
 * gai 6x20", "Vít 4x20 ren gỗ đen" + "4×20"). So sánh bỏ dấu cách, không phân
 * biệt hoa thường, coi "×" là "x".
 */
export function itemLabel(name: string, spec: string | null | undefined): string {
  const s = (spec ?? '').trim()
  if (!s) return name
  const norm = (t: string) => t.toLowerCase().replace(/×/g, 'x').replace(/\s+/g, '')
  return norm(name).includes(norm(s)) ? name : `${name} ${s}`
}

/** Khoá NCC × tiền tệ — cùng khoá dòng của sổ tổng hợp. */
export const rowKey = (supplierId: string, currency: string) =>
  `${supplierId}|${currency}`

/**
 * Số dòng nhập CHƯA CÓ GIÁ theo NCC × tiền tệ, tính tới hết kỳ. Sổ không cộng
 * chúng (không biết giá thì không bịa 0), nên dòng sổ phải nói mình đang thiếu.
 */
export function unpricedBy(moves: ReceiptMove[], to: string): Map<string, number> {
  const out = new Map<string, number>()
  for (const m of moves) {
    if (m.unit_cost != null || m.direction !== 'in' || m.doc_date > to) continue
    const k = rowKey(m.supplier_id, m.currency || 'VND')
    out.set(k, (out.get(k) ?? 0) + 1)
  }
  return out
}

const PREPAY =
  /cọc|đặt\s*trước|trả\s*trước|ứng\s*trước|tạm\s*ứng|trước\s*khi\s*(nhận|giao)/i

/**
 * Điều khoản có trả TRƯỚC (cọc, tạm ứng, trả trước khi nhận) → nhãn ngắn cho
 * chip "… chưa ghi". `null` = điều khoản không đòi trả trước.
 *
 * Có ích vì sổ theo hàng nhận chưa biết tiền cọc: NCC đòi cọc 30% mà sổ không
 * có phiếu chi nào thì dư của họ cao hơn thật — phải nói ra trên chính dòng đó.
 */
export function prepayLabel(terms: string | null | undefined): string | null {
  const s = (terms ?? '').trim()
  if (!s || !PREPAY.test(s)) return null
  const pct = /(\d{1,3})\s*%/.exec(s)
  if (/cọc/i.test(s)) return pct ? `cọc ${pct[1]}%` : 'cọc'
  if (/tạm\s*ứng/i.test(s)) return pct ? `tạm ứng ${pct[1]}%` : 'tạm ứng'
  return 'trả trước'
}

/**
 * Điều khoản thanh toán của một NCC trong sổ: các câu KHÁC NHAU trên những đơn
 * có phiếu. Một câu thì bày câu đó; nhiều câu thì nói số câu — chọn bừa một câu
 * là giấu mất việc NCC này đang mua theo nhiều thoả thuận.
 */
export function termsOf(texts: (string | null | undefined)[]): {
  text: string | null
  distinct: number
} {
  const set = new Set(
    texts
      .map((t) => (t ?? '').replace(/\s+/g, ' ').trim().replace(/\.$/, ''))
      .filter(Boolean),
  )
  const all = [...set]
  return { text: all.length === 1 ? all[0] : null, distinct: all.length }
}
