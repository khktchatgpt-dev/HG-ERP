/**
 * SỔ CHI TIẾT CÔNG NỢ PHẢI TRẢ NGƯỜI BÁN (TK 331).
 *
 * Đây là thứ kế toán thật sự cần, và là thứ mọi màn trước đó KHÔNG phải: các
 * màn kia đều là **ảnh chụp "tại thời điểm này"**, còn kế toán làm việc theo
 * **KỲ**:
 *
 *     Dư đầu kỳ  +  Phát sinh tăng  −  Phát sinh giảm  =  Dư cuối kỳ
 *
 * Không có cấu trúc đó thì không chốt sổ được, không đối chiếu được với kỳ
 * trước, và không ai trả lời được "tháng này công nợ tăng hay giảm".
 *
 * ⭐ PHÁT SINH TĂNG LÀ HOÁ ĐƠN, KHÔNG PHẢI PHIẾU NHẬP. Nợ phải trả là nghĩa vụ
 * pháp lý; nó ra đời khi NCC xuất hoá đơn, và mang VAT. Phiếu nhập kho nói hàng
 * đã về — đó là cơ sở của GIÁ TRỊ TỒN KHO, không phải của khoản phải trả. Hai
 * thứ lệch nhau đúng bằng phần "đã nhận chưa có hoá đơn" (GR/IR), và phần đó
 * được bày RIÊNG chứ không trộn vào số dư.
 *
 * ⭐ TÁCH THEO TIỀN TỆ. Số dư gốc ngoại tệ là số dư THẬT; quy VND chỉ để cộng
 * tổng, và cần tỷ giá — thiếu tỷ giá thì để trống, không thay bằng 0.
 */

export type LedgerEntry = {
  supplier_id: string
  supplier_name: string
  currency: string
  /** YYYY-MM-DD — ngày GHI SỔ (ngày hoá đơn / ngày phiếu nhập / ngày chi), không phải ngày nhập máy. */
  date: string
  /**
   * `invoice` = phát sinh TĂNG (hoá đơn, hoặc phiếu nhập khi sổ tính theo hàng
   * nhận) · `return` = giảm do TRẢ HÀNG / ĐẢO PHIẾU · `payment` = giảm do trả
   * tiền. Tách `return` khỏi `payment` vì kế toán đọc hai thứ đó ở hai cột:
   * gộp lại thì "đã trả" bị phồng bằng tiền hàng trả về.
   */
  kind: 'invoice' | 'payment' | 'return'
  doc_no: string
  /** Dương. Chiều do `kind` quyết định — không dùng số âm để biểu diễn chiều. */
  amount: number
  note?: string | null
  /**
   * Nhãn loại chứng từ khi KHÁC mặc định ("Hoá đơn NCC" / "Thanh toán") — phiếu
   * phí nhà xe, bút toán huỷ phiếu. Chiều tiền vẫn do `kind` quyết định.
   */
  label?: string
  /** Tiền hàng CHƯA VAT — chỉ bút toán phiếu nhập có (sổ chi tiết tách hai cột). */
  net?: number
  /** Tiền VAT của bút toán, cùng nguồn với `net`. `amount = net + vat`. */
  vat?: number
  /** Mã đơn mua của phiếu nhập — để từ dòng sổ đi ngược về đơn. */
  po_code?: string | null
  /** Số hoá đơn / phiếu giao của NCC ghi trên phiếu nhập — khoá đối chiếu với NCC. */
  party_doc_no?: string | null
  /** Hạn thanh toán (YYYY-MM-DD) theo điều khoản thừa kế đơn → NCC → mặc định. */
  due?: string | null
  /** Mã lệnh sản xuất của đơn mua — cột "Đơn hàng / LSX" của sổ Kế toán. */
  lsx_code?: string | null
  /**
   * Từng DÒNG HÀNG của phiếu (chỉ bút toán phiếu nhập có). Sổ Kế toán đọc và
   * đối chiếu theo dòng hàng chứ không theo phiếu: chênh một đơn giá hay một số
   * lượng chỉ lộ ra ở mức này (đo 31/10/2026 với sổ Excel của Kế toán).
   */
  items?: LedgerItem[]
}

/** Một dòng hàng của bút toán phiếu nhập. Tiền dương; chiều theo `kind` của bút toán. */
export type LedgerItem = {
  name: string
  unit: string | null
  qty: number
  price: number
  net: number
  vat: number
  amount: number
}

/** Nhãn cột "Loại" của sổ chi tiết — một chỗ cho cả màn hình lẫn Excel. */
export const entryLabel = (e: Pick<LedgerEntry, 'kind' | 'label'>): string =>
  e.label ??
  (e.kind === 'invoice'
    ? 'Hoá đơn NCC'
    : e.kind === 'return'
      ? 'Trả hàng / đảo phiếu'
      : 'Thanh toán')

export type LedgerRow = {
  supplier_id: string
  supplier_name: string
  currency: string
  opening: number
  increase: number
  /** Giảm do trả hàng / đảo phiếu nhập — tách khỏi `decrease` (tiền đã trả). */
  returned: number
  /** Giảm do THANH TOÁN. */
  decrease: number
  closing: number
  entry_count: number
}

const r2 = (n: number) => Math.round(n * 100) / 100
const signed = (e: LedgerEntry) => (e.kind === 'invoice' ? e.amount : -e.amount)
/** Trong cùng một ngày: phát sinh tăng → trả hàng → thanh toán (số dư không âm giả giữa sổ). */
const KIND_ORDER: Record<LedgerEntry['kind'], number> = {
  invoice: 0,
  return: 1,
  payment: 2,
}

/**
 * Sổ tổng hợp theo NCC × tiền tệ cho một kỳ `[from, to]` (bao gồm hai đầu).
 *
 * Dư đầu kỳ cộng dồn MỌI giao dịch TRƯỚC `from` — không có khái niệm "số dư
 * khai báo tay". Sổ nào cho gõ tay số dư đầu kỳ thì sớm muộn số đó lệch khỏi
 * tổng giao dịch, và không ai biết bên nào sai.
 *
 * Giữ cả NCC có dư đầu bằng 0 nhưng CÓ phát sinh trong kỳ, và NCC có dư đầu
 * khác 0 nhưng không phát sinh — cả hai đều là dòng thật của sổ.
 */
export function buildLedger(
  entries: LedgerEntry[],
  from: string,
  to: string,
): LedgerRow[] {
  type Acc = LedgerRow
  const by = new Map<string, Acc>()
  const ensure = (e: LedgerEntry): Acc => {
    const k = `${e.supplier_id}|${e.currency}`
    const cur = by.get(k) ?? {
      supplier_id: e.supplier_id,
      supplier_name: e.supplier_name,
      currency: e.currency,
      opening: 0,
      increase: 0,
      returned: 0,
      decrease: 0,
      closing: 0,
      entry_count: 0,
    }
    by.set(k, cur)
    return cur
  }

  for (const e of entries) {
    const row = ensure(e)
    if (e.date < from) {
      row.opening += signed(e)
      continue
    }
    if (e.date > to) continue
    if (e.kind === 'invoice') row.increase += e.amount
    else if (e.kind === 'return') row.returned += e.amount
    else row.decrease += e.amount
    row.entry_count += 1
  }

  return [...by.values()]
    .map((r) => ({
      ...r,
      opening: r2(r.opening),
      increase: r2(r.increase),
      returned: r2(r.returned),
      decrease: r2(r.decrease),
      closing: r2(r.opening + r.increase - r.returned - r.decrease),
    }))
    // Dòng không dư đầu, không phát sinh, không dư cuối thì không phải dòng sổ.
    .filter((r) => r.opening !== 0 || r.entry_count > 0 || r.closing !== 0)
    .sort((a, b) => b.closing - a.closing || a.supplier_name.localeCompare(b.supplier_name)) // prettier-ignore
}

export type LedgerLine = LedgerEntry & {
  /** Số dư LUỸ KẾ sau giao dịch này — cột mà kế toán dò khi đối chiếu. */
  running: number
}

/**
 * SỔ CHI TIẾT của một NCC × tiền tệ: từng giao dịch kèm số dư luỹ kế.
 *
 * Cột luỹ kế là thứ dùng để dò khi đối chiếu với bảng kê NCC gửi sang: hai bên
 * đi từng dòng, chỗ nào số dư bắt đầu lệch là chỗ có vấn đề. Bảng không có cột
 * đó thì phải cộng tay từ đầu mỗi lần dò.
 *
 * Xếp theo NGÀY rồi đến hoá đơn trước, thanh toán sau trong cùng một ngày —
 * trả tiền cho hoá đơn cùng ngày mà xếp ngược thì số dư âm giữa sổ.
 */
export function ledgerDetail(
  entries: LedgerEntry[],
  supplierId: string,
  currency: string,
  from: string,
  to: string,
): { opening: number; lines: LedgerLine[] } {
  const mine = entries.filter(
    (e) => e.supplier_id === supplierId && e.currency === currency,
  )
  const opening = r2(mine.filter((e) => e.date < from).reduce((s, e) => s + signed(e), 0))
  const inPeriod = mine
    // Chặn HAI ĐẦU. Thiếu chặn đuôi thì giao dịch của kỳ SAU chạy vào sổ chi
    // tiết, và dư cuối ở đây không còn khớp dư cuối của chính dòng đó trên sổ
    // tổng hợp — đúng loại lệch mà không ai dò ra vì hai bảng nằm hai chỗ.
    .filter((e) => e.date >= from && e.date <= to)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
        a.doc_no.localeCompare(b.doc_no),
    )
  let run = opening
  return {
    opening,
    lines: inPeriod.map((e) => {
      run = r2(run + signed(e))
      return { ...e, running: run }
    }),
  }
}

/** Cộng toàn sổ theo tiền tệ — dòng TỔNG CỘNG của báo cáo. */
export function ledgerTotals(rows: LedgerRow[]): {
  currency: string
  opening: number
  increase: number
  returned: number
  decrease: number
  closing: number
  supplier_count: number
}[] {
  const by = new Map<string, { opening: number; increase: number; returned: number; decrease: number; closing: number; supplier_count: number }>() // prettier-ignore
  for (const r of rows) {
    const cur = by.get(r.currency) ?? { opening: 0, increase: 0, returned: 0, decrease: 0, closing: 0, supplier_count: 0 } // prettier-ignore
    cur.opening += r.opening
    cur.increase += r.increase
    cur.returned += r.returned
    cur.decrease += r.decrease
    cur.closing += r.closing
    cur.supplier_count += 1
    by.set(r.currency, cur)
  }
  return [...by].map(([currency, v]) => ({
    currency,
    opening: r2(v.opening),
    increase: r2(v.increase),
    returned: r2(v.returned),
    decrease: r2(v.decrease),
    closing: r2(v.closing),
    supplier_count: v.supplier_count,
  }))
}

/** Kỳ = một tháng. `YYYY-MM` → [ngày đầu, ngày cuối]. */
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` }
}
