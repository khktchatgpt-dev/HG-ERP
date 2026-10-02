/**
 * TÀI CHÍNH CỦA MỘT ĐƠN MUA — mục "Tài chính" trên màn đơn (27/09/2026).
 *
 * Chủ dự án: "tách ra như menu … chỉ hiện thị thông tin về tài chính ngay chính
 * trang", và "ai mở được đơn cũng xem được". Mục này KHÔNG tính số riêng:
 *
 *   ĐÃ NHẬN / ĐÃ CÓ HOÁ ĐƠN (chưa VAT)  ← `threeWayMatch` — cùng hàm màn Đối
 *                                         chiếu của Kế toán dùng
 *   HOÁ ĐƠN gồm VAT                    ← dòng hoá đơn ĐÃ VÀO SỔ × (1 + VAT dòng)
 *   ĐÃ TRẢ                             ← phiếu chi GẮN ĐÍCH DANH đơn này (0167)
 *
 * File thuần, có test — chỉ ghép các con số trên thành câu trả lời cho người đọc.
 */

const r2 = (n: number) => Math.round(n * 100) / 100

export type PoFinanceInput = {
  /** Tổng thanh toán của đơn (gồm VAT) — số trên đầu trang. */
  ordered_gross: number
  /** Giá trị hàng đã về kho, chưa VAT (Σ amount_received của đối chiếu). */
  received_net: number
  /** Phần hoá đơn đã vào sổ đòi cho các dòng của đơn, chưa VAT. */
  invoiced_net: number
  /** Cùng phần đó, gồm VAT từng dòng hoá đơn. */
  invoiced_gross: number
  /** Phiếu chi gắn đơn này. */
  paid: number
  /**
   * Số dòng ĐÃ VỀ mà phiếu nhập KHÔNG có giá (đo 27/09/2026: 5/43 đơn). Tiền
   * nhận của các dòng đó tính 0 — nói "còn phải trả 0" là sai, phải nói thiếu giá.
   */
  missing_price_lines?: number
}

export type PoFinanceStage =
  /** Chưa về gì, chưa hoá đơn — tiền chưa bắt đầu chạy. */
  | 'chua_phat_sinh'
  /** Đã có hàng về mà chưa có hoá đơn (hoặc hoá đơn chưa đủ) — nợ thật chưa có giấy. */
  | 'cho_hoa_don'
  /** Đã có hoá đơn, còn phải trả. */
  | 'con_no'
  /** Đã trả đủ phần hoá đơn. */
  | 'da_tra'
  /** Hàng đã về nhưng phiếu nhập thiếu giá, chưa có hoá đơn — tiền nhận chưa đo được. */
  | 'thieu_gia'

export type PoFinanceView = PoFinanceInput & {
  /** Đã nhận − đã có hoá đơn (chưa VAT), không âm — phần "ngoài sổ" 331. */
  waiting_invoice_net: number
  /** Hoá đơn gồm VAT − đã trả. Âm = trả trước / trả dư. */
  owed: number
  stage: PoFinanceStage
}

export function poFinanceView(x: PoFinanceInput): PoFinanceView {
  const waiting = r2(Math.max(0, x.received_net - x.invoiced_net))
  const owed = r2(x.invoiced_gross - x.paid)
  const stage: PoFinanceStage =
    (x.missing_price_lines ?? 0) > 0 && x.invoiced_gross <= 0.005
      ? 'thieu_gia'
      : waiting > 0.005
        ? 'cho_hoa_don'
        : x.invoiced_gross > 0.005
          ? owed > 0.005
            ? 'con_no'
            : 'da_tra'
          : x.received_net > 0.005
            ? 'cho_hoa_don'
            : 'chua_phat_sinh'
  return { ...x, waiting_invoice_net: waiting, owed, stage }
}

/** Tiền một dòng hoá đơn gồm VAT của chính dòng đó. VAT trống = 0. */
export function invoiceLineGross(amount: number, vatRate: number | null): number {
  return r2(amount * (1 + (vatRate ?? 0) / 100))
}

/**
 * ĐẶT · ĐÃ VỀ · CÒN THIẾU bằng TIỀN (chưa VAT) — dải số mục Tổng quan (02/10/2026).
 *
 * Ăn đúng các dòng đối chiếu (`threeWayMatch`) mà mục Tài chính dùng — "Đã về" ở
 * hai nơi phải là MỘT con số. Còn thiếu tính theo SỐ LƯỢNG chưa về × đơn giá quy
 * về ĐVT đặt (`tiền dòng ÷ SL đặt`, cùng luật giá vốn phiếu nhập), không theo
 * `đặt − về` bằng tiền: dòng tính tiền theo kg về đủ cây mà nhẹ cân thì vẫn là đủ.
 * Dòng ĐÃ CHỐT THIẾU không còn thiếu — NCC không giao nữa — và được đếm riêng.
 */
export function poVeThieu(
  rows: {
    qty_ordered: number
    amount_ordered: number
    qty_received: number
    amount_received: number
    closed_short: boolean
  }[],
): {
  ordered_net: number
  received_net: number
  missing_net: number
  /** Dòng chưa về đủ (không gồm dòng đã chốt thiếu). */
  missing_lines: number
  /** Dòng đã về đủ hoặc vượt. */
  full_lines: number
  closed_lines: number
  total_lines: number
} {
  let ordered = 0
  let received = 0
  let missing = 0
  let missingLines = 0
  let fullLines = 0
  let closedLines = 0
  for (const r of rows) {
    ordered += r.amount_ordered
    received += r.amount_received
    const con = r.qty_ordered - r.qty_received
    if (con <= 1e-9) fullLines++
    else if (r.closed_short) closedLines++
    else {
      missingLines++
      if (r.qty_ordered > 0) missing += (con / r.qty_ordered) * r.amount_ordered
    }
  }
  return {
    ordered_net: r2(ordered),
    received_net: r2(received),
    missing_net: r2(missing),
    missing_lines: missingLines,
    full_lines: fullLines,
    closed_lines: closedLines,
    total_lines: rows.length,
  }
}
