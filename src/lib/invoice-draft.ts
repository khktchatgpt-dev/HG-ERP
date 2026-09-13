/**
 * MỒI HOÁ ĐƠN NCC TỪ ĐƠN MUA — "PO flip".
 *
 * Vì sao có: đo 11/09/2026 sổ TK 331 chỉ có **1 hoá đơn**, trong khi đã cam kết
 * mua 5,68 tỷ. Không phải kế toán lười — **chưa từng có màn nào để nhập hoá đơn**
 * (nút "Nhập hoá đơn" trên màn đối chiếu trỏ vào một route không tồn tại). Cả
 * phân hệ công nợ là phần báo cáo dựng trên một cái phễu chưa có miệng.
 *
 * ERP thật gọi việc này là *PO flip*: bấm một nút, đơn mua lật thành hoá đơn
 * nháp, kế toán chỉ sửa chỗ NCC ghi khác rồi lưu. Nhập tay một tờ 20 dòng mất
 * ~5 phút; lật từ đơn mất ~30 giây.
 *
 * ⭐ MỒI KHÔNG PHẢI LÀ GHI. Mọi số ở đây là GỢI Ý để người ta sửa — số phải trả
 * là số trên TỜ GIẤY của NCC, không phải số mình tự tính. Vì thế `suggestLines`
 * trả kèm `basis` (gợi ý dựa trên cái gì) để màn nói ra, thay vì bày một con số
 * không rõ từ đâu ra.
 *
 * File thuần, có test. Đây là toán TIỀN: sai một dòng là trả thừa cho NCC.
 */

const r2 = (n: number) => Math.round(n * 100) / 100
const r3 = (n: number) => Math.round(n * 1000) / 1000
const EPS = 0.0005

/** Một dòng đơn mua kèm số đã về / đã có hoá đơn — lấy từ `threeWayMatch`. */
export type DraftSource = {
  po_line_id: string
  material_code: string | null
  material_name: string
  unit: string | null
  qty_ordered: number
  /** Tiền cả dòng theo đơn mua (đã qua `poLineAmount`, gồm cả dòng tính theo kg). */
  amount_ordered: number
  qty_received: number
  qty_invoiced: number
  /** Dòng đã chốt thiếu (0154) — phần chưa về sẽ KHÔNG bao giờ về nữa. */
  closed_short: boolean
}

/** Cơ sở của số lượng gợi ý. Màn BẮT BUỘC bày cái này ra cạnh con số. */
export type DraftBasis =
  /** Phần đã nhận kho mà chưa có hoá đơn — cơ sở đúng nhất. */
  | 'da_nhan'
  /** Chưa nhận gì (hoặc kho chưa ghi): lấy phần đã đặt chưa có hoá đơn. */
  | 'da_dat'
  /** Đã có hoá đơn đủ (hoặc thừa) — không còn gì để đòi. */
  | 'du_roi'

export type DraftLine = {
  po_line_id: string
  material_code: string | null
  description: string
  unit: string | null
  /** Số lượng GỢI Ý. 0 = không còn gì để lập hoá đơn. */
  qty: number
  /** Đơn giá GỢI Ý, quy về đúng ĐVT đặt hàng để `qty × giá` ra đúng tiền dòng. */
  unit_price: number
  basis: DraftBasis
  /** Ba số nền của dòng — màn bày cạnh ô nhập để người gõ đối chiếu bằng mắt. */
  qty_ordered: number
  qty_received: number
  qty_invoiced: number
  /** Đã đặt − đã có hoá đơn. */
  remaining_ordered: number
  /** Đã nhận − đã có hoá đơn. Âm = NCC đã đòi nhiều hơn hàng về. */
  remaining_received: number
  /** Mặc định tích chọn hay không — chỉ dòng còn gì để đòi. */
  selected: boolean
}

/**
 * Mồi các dòng hoá đơn từ các dòng đơn mua.
 *
 * ⭐ ƯU TIÊN "ĐÃ NHẬN" HƠN "ĐÃ ĐẶT". Nợ phải trả gắn với hàng đã về; lập hoá đơn
 * cho phần chưa về là tự tạo khoản nợ cho thứ chưa nhận. Nhưng kho HG chưa vào
 * nhịp (hầu hết dòng có `qty_received = 0`), nên rơi về cơ sở "đã đặt" — CÓ BÁO
 * RA qua `basis` để người nhập biết mình đang ký cho cái gì.
 *
 * ⭐ DÒNG ĐÃ CHỐT THIẾU CHỈ ĐƯỢC LẤY THEO PHẦN ĐÃ NHẬN. Chốt thiếu nghĩa là phần
 * còn lại sẽ không bao giờ về; mồi theo số đã đặt là mời người ta trả tiền cho
 * hàng đã tuyên bố là không nhận nữa.
 */
export function suggestInvoiceLines(rows: readonly DraftSource[]): DraftLine[] {
  return rows.map((s) => {
    const remainingOrdered = r3(s.qty_ordered - s.qty_invoiced)
    const remainingReceived = r3(s.qty_received - s.qty_invoiced)
    const unitPrice = s.qty_ordered > EPS ? r2(s.amount_ordered / s.qty_ordered) : 0

    let qty = 0
    let basis: DraftBasis = 'du_roi'
    if (remainingReceived > EPS) {
      qty = remainingReceived
      basis = 'da_nhan'
    } else if (!s.closed_short && remainingOrdered > EPS) {
      qty = remainingOrdered
      basis = 'da_dat'
    }

    return {
      po_line_id: s.po_line_id,
      material_code: s.material_code,
      description: s.material_name,
      unit: s.unit,
      qty,
      unit_price: unitPrice,
      basis,
      qty_ordered: s.qty_ordered,
      qty_received: s.qty_received,
      qty_invoiced: s.qty_invoiced,
      remaining_ordered: remainingOrdered,
      remaining_received: remainingReceived,
      selected: qty > EPS,
    }
  })
}

export type TotalsInput = { qty: number; unit_price: number }

/**
 * Cộng tờ hoá đơn từ các dòng đã chọn.
 *
 * LÀM TRÒN TỪNG DÒNG rồi mới cộng — tiền của một dòng là số được in ra và được
 * trả, nên nó phải là số tròn trước khi vào tổng. Cộng thô rồi làm tròn ở cuối
 * cho ra số lệch vài xu so với chính tờ giấy mình in.
 */
export function invoiceTotals(
  lines: readonly TotalsInput[],
  vatRate: number,
): { subtotal: number; vat: number; total: number } {
  const subtotal = r2(lines.reduce((s, l) => s + r2(l.qty * l.unit_price), 0))
  const vat = r2((subtotal * vatRate) / 100)
  return { subtotal, vat, total: r2(subtotal + vat) }
}

/** Hạn thanh toán suy từ điều khoản `net_days` (0189). Không có thì để trống. */
export function dueDateFrom(invoiceDate: string, netDays: number | null): string | null {
  if (netDays == null || !Number.isFinite(netDays)) return null
  const d = new Date(`${invoiceDate}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return null
  d.setUTCDate(d.getUTCDate() + Math.trunc(netDays))
  return d.toISOString().slice(0, 10)
}

/**
 * Thứ CHẶN việc lưu, nói bằng câu người đọc hiểu và sửa được.
 *
 * Trả mảng rỗng = lưu được. Luật kiểm mục 05 của sổ thiết kế: hành động bị chặn
 * phải nói vướng gì VÀ cách gỡ, ngay tại chỗ — không cho bấm rồi mới báo lỗi.
 */
export function draftBlockers(input: {
  invoice_no: string
  invoice_date: string
  lines: readonly { qty: number; unit_price: number; description: string }[]
  /** Tổng người gõ theo tờ giấy. */
  total_typed: number
  /** Tổng máy cộng từ dòng. */
  total_computed: number
}): string[] {
  const out: string[] = []
  if (!input.invoice_no.trim()) out.push('Chưa có số hoá đơn — gõ đúng số trên tờ giấy NCC gửi') // prettier-ignore
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.invoice_date)) out.push('Chưa chọn ngày hoá đơn')
  if (input.lines.length === 0)
    out.push('Chưa chọn dòng nào — tích ít nhất một dòng hàng')
  if (input.lines.some((l) => !(l.qty > 0))) out.push('Có dòng số lượng bằng 0 — bỏ tích hoặc sửa số lượng') // prettier-ignore
  if (input.lines.some((l) => !l.description.trim())) out.push('Có dòng chưa có tên hàng')
  return out
}
