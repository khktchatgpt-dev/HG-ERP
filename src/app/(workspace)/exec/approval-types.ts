import { type PoLine } from '@/app/(mua-hang)/mua-hang/don/_lib/po-types'
import type { PoQuestionThread } from '@/lib/po-signature'
import type { PoLineTemplateFields } from '@/modules/dept/supply/pos.repo'

/**
 * Dòng đơn ở màn ký — kèm các ô RIÊNG của mẫu đơn (vật liệu, kg/m, lọt lòng…)
 * và mã SP. Repo vốn trả đủ; kiểu client cũ bỏ quên nên lưới ký không đọc tới.
 */
export type ApprovalPoLine = PoLine &
  Partial<PoLineTemplateFields> & { product_code?: string | null }

/**
 * Kiểu dữ liệu phiếu chờ duyệt (LSX + đơn vật tư) cho khu Phê duyệt Ban GĐ —
 * dùng chung giữa danh sách (page.tsx), buồng lái (ApprovalCockpit) và trang
 * chi tiết đơn duyệt (ApprovalDetailScreen). Làm giàu server-side.
 */

export type PendingPo = {
  id: string
  code: string
  supplier_name: string
  /** null = PO ngoài LSX (0076). */
  lsx_code: string | null
  order_code: string | null
  expected_at: string | null
  created_at: string
  currency: string
  total: number
  lines_count: number
  /** Tên người lập đơn (PO.created_by) — chỉ có ở màn duyệt đầy đủ. */
  created_by_name?: string | null
  /** Ghi chú của đơn đặt (PO.note) — chỉ có ở màn duyệt đầy đủ. */
  note?: string | null
  /** Dòng đơn (nạp sẵn server-side) — panel phân tích khỏi round-trip. */
  lines?: ApprovalPoLine[]
  /** Mẫu đơn (0106) — quyết định bộ cột lưới, như phiếu in gửi NCC. */
  template?: string | null
  /**
   * "Giá trị lớn — đọc kỹ trước khi ký", tính THEO TIỀN TỆ của đơn
   * (`isBigApprovalWith` + ngưỡng ở /exec/luat-ky). Phải tính ở server như danh
   * sách phê duyệt: trang này từng gọi `isBigApproval(total)` — so mọi tiền tệ
   * với ngưỡng VND, nên đơn 3.000 USD (~75tr) hiện ra như đơn nhỏ.
   */
  big?: boolean
  /** Ngưỡng đang áp cho tiền tệ này; null = chưa đặt (⇒ luôn coi là lớn). */
  threshold?: number | null
  /**
   * GIÁ MUA GẦN NHẤT của từng mã vật tư trên đơn, KHÔNG tính chính đơn này.
   *
   * Câu hỏi thật của người ký chi tiền là "giá có tăng không", mà màn duyệt
   * trước 17/09/2026 không trả lời được — Giám đốc nhìn 28.885 USD và không có
   * gì để so. Dữ liệu vốn đã có (`pricesRepo.lastPurchases`, dùng ở bảng kê
   * vật tư của lệnh); ở đây chỉ gọi lại kèm `excludePoId`.
   *
   * Khoá theo `material_id`. Mã chưa từng mua thì KHÔNG có khoá — màn hiện
   * "chưa từng mua", khác hẳn với "giá không đổi".
   */
  last_prices?: Record<
    string,
    { unit_price: number; currency: string; po_code: string; at: string }
  >
  /*
    ── Bổ sung 01/10/2026: Giám đốc "chưa xem được đầy đủ thông tin đơn, không
    biết ai lập đơn". Đo: số to là tiền TRƯỚC VAT (83/97 đơn có VAT), người lập
    trống ở 31/97 đơn (nạp từ file) trong khi người phụ trách có ở 97/97, và
    điều khoản / ghi chú nội bộ không lên màn. Mọi trường dưới chỉ có ở màn
    duyệt đầy đủ (approvals/data.ts).
  */
  /**
   * Tiền của đơn theo `poMoneyOf` — CÙNG phép tính với phiếu in, để số người ký
   * thấy khớp với số trên giấy. `total` ở trên vẫn là Σ tiền dòng (tiền hàng).
   */
  money?: {
    subtotal: number
    discount: number
    vat_rate: number
    vat_amount: number
    grand: number
    includes_vat: boolean
  }
  /** Người PHỤ TRÁCH đơn (assigned_to) — luôn có, kể cả đơn nạp từ file. */
  owner_name?: string | null
  /** Lần gửi duyệt CUỐI (approval_events) — "chờ n ngày" tính từ đây. */
  submitted_at?: string | null
  terms?: {
    payment: string | null
    lead_time: string | null
    delivery_place: string | null
    invoice: string | null
    quality: string | null
    contract_no: string | null
    /** Số đơn trên giấy / số chứng từ phía NCC. */
    doc_no: string | null
  }
  /** Ghi chú NỘI BỘ của Cung ứng (doc_notes audience internal), mới nhất trước. */
  internal_notes?: { author_name: string | null; created_at: string; body: string }[]
  /** Vết duyệt của đơn, cũ nhất trước — lập, gửi duyệt, trả lại, rút về… */
  events?: {
    action: string
    actor_name: string | null
    created_at: string
    reason: string | null
  }[]
  /** Bối cảnh lệnh SX — lệnh này đã duyệt mua bao nhiêu, còn bao nhiêu đơn. */
  lsx?: {
    code: string
    status: string | null
    ship_date: string | null
    pos_total: number
    pos_approved: number
    pos_draft: number
    /** Tổng thanh toán (gồm VAT) các đơn ĐÃ duyệt của lệnh, theo tiền tệ. */
    approved_value: { currency: string; value: number }[]
  } | null
  /*
    ── 0218 (01/10/2026): màn ký mở được đơn ở MỌI trạng thái — chỉ đọc khi
    không còn chờ duyệt, kèm chữ ký, đơn đang ở đâu, và các việc sau chữ ký
    (thu hồi · ký bù · hỏi lại · yêu cầu xem lại).
  */
  /** Trạng thái đơn (PoStatus) — quyết định dải nào hiện ở đầu màn. */
  status?: string
  approved_by_name?: string | null
  approved_at?: string | null
  ordered_at?: string | null
  /** Đơn GỬI GẤP trước khi ký — null nếu đi đường thường. */
  urgent?: { at: string; by_name: string | null; reason: string | null } | null
  /** Số phiếu kho đã ghi vào đơn — > 0 thì không thu hồi chữ ký được. */
  receipt_docs?: number
  /** Điều chỉnh xảy ra SAU khi ký (0210) — đơn đổi tiền sau chữ ký. */
  adjusted_after_sign?: { count: number; delta: number } | null
  /*
    ── 07/10/2026: "không hiển đủ thông tin các dòng hàng cũng như đợt giao".
  */
  /**
   * KẾ HOẠCH GIAO theo đợt (0152), chỉ đợt còn sống, theo số thứ tự. Lập được
   * từ lúc nháp nên có trước chữ ký; rỗng = giao một lần theo `expected_at`.
   */
  shipments?: {
    seq: number
    code: string | null
    expected_date: string
    status: 'planned' | 'arrived' | 'received'
    note: string | null
    lines: { po_line_id: string; qty: number }[]
  }[]
  /** Lệnh GỘP (0125) ngoài lệnh chính — DocChain chỉ bày lệnh chính. */
  extra_lsx?: string[]
  /** Ghi chú lúc NCC xác nhận đơn — có khi mở lại đơn đã ký. */
  confirmed_note?: string | null
  /** Tệp đính kèm đơn (báo giá NCC, tờ đơn chụp…). */
  files?: { id: string; filename: string }[]
  /** Câu hỏi của Giám đốc + câu trả lời, mới nhất trước. */
  questions?: PoQuestionThread[]
  /** Lịch sử với NCC — nhà này đã giao bao nhiêu đơn, đang mở những đơn nào. */
  supplier?: {
    received: number
    /** Số đơn khác (không tính đơn này), mọi trạng thái trừ huỷ. */
    others: number
    open_others: string[]
    contact: string | null
  } | null
}

/**
 * Bối cảnh ĐI TUYẾN TÍNH qua hộp phiếu chờ — để màn duyệt có `‹ 3/15 ›` và
 * nút "Ký & sang phiếu sau".
 *
 * Không có nó thì ký xong bị đá về danh sách và phải tìm lại chỗ mình dừng;
 * với 15 phiếu đang chờ đó là 15 lần quay đầu. Tiêu chí 9 của
 * `docs/tieu-chi-man-chung-tu-erp.md` ("điều hướng bản ghi ‹n/N›").
 */
export type ApprovalNav = {
  /** Vị trí phiếu này trong hộp, đếm từ 1. */
  index: number
  total: number
  prevHref: string | null
  nextHref: string | null
  /** Đơn CÙNG LỆNH SX cũng đang chờ chữ ký — kể cả phiếu đang xem. */
  sameLsxPending: number
}

/** 1 dòng sản phẩm của LSX (từ đơn hàng) — dữ liệu GĐ cần để thẩm định. */
export type ApprovalLsxLine = {
  /** Đơn chứa dòng — lệnh gộp nhiều đơn thì bảng SP nhóm theo đơn (0113). */
  order_code: string
  product_code: string
  product_name: string
  product_unit: string
  qty: number
  unit_price: number
  bom_status: 'none' | 'drawing' | 'done'
  /** Ảnh đại diện SP (URL đã ký) — null nếu chưa đặt ảnh. */
  image_url: string | null
  /** Spec sản xuất của dòng lệnh — khoá theo MẪU CỘT của khách (0114). */
  spec: Record<string, string>
}

export type PendingLsx = {
  id: string
  code: string
  /** Mã các đơn của lệnh — 0113: một lệnh gộp nhiều đơn cùng khách. */
  order_codes: string[]
  customer_name: string
  created_at: string
  /** Tên người phát lệnh (LSX.issued_by) — chỉ có ở màn duyệt đầy đủ. */
  issued_by_name?: string | null
  /** Các field làm giàu cho panel phân tích (chỉ có ở buồng lái duyệt). */
  ship_date?: string | null
  container_summary?: string | null
  note?: string | null
  /** Giá trị đơn hàng (Σ qty × đơn giá bán). */
  order_value?: number
  /** Số sản phẩm chưa chốt BOM — tín hiệu sẵn sàng sản xuất. */
  bom_pending?: number
  /** Ngày nhận đơn (LSX.received_date). */
  received_date?: string | null
  /**
   * Thông tin thương mại của đơn hàng gốc (bên Sales) — bối cảnh để GĐ duyệt.
   * Lệnh gộp nhiều đơn thì đây là đơn ĐẦU TIÊN; xem `orders` cho cả nhóm.
   */
  order?: ApprovalOrderInfo | null
  /** Tóm tắt từng đơn trong lệnh (0113) — GĐ thấy mình đang duyệt cho những đơn nào. */
  orders?: {
    code: string
    due_date: string | null
    currency: string
    value: number
    line_count: number
  }[]
  lines?: ApprovalLsxLine[]
}

/** 1 dòng báo giá chờ duyệt — kèm giá chào GẦN NHẤT cho cùng khách để so. */
export type PendingQuoteLine = {
  product_code: string
  product_name: string
  product_unit: string
  unit_price: number
  discount_pct: number | null
  note: string | null
  /** Giá lần chào trước cho khách này (khác báo giá đang duyệt) — null nếu chưa từng chào. */
  last_price: { unit_price: number; quote_code: string } | null
}

/** Báo giá chờ GĐ duyệt (0149) — dữ liệu cho màn Xem kỹ. */
export type PendingQuote = {
  id: string
  code: string
  customer_name: string
  currency: string
  created_at: string
  submitted_at: string | null
  submitted_by_name: string | null
  valid_from: string | null
  valid_to: string | null
  price_term: string | null
  payment_terms: string | null
  note: string | null
  lines: PendingQuoteLine[]
}

/** Thông tin đơn hàng (thương mại) kèm theo LSX — GĐ xem bối cảnh trước khi duyệt. */
export type ApprovalOrderInfo = {
  customer_po_no: string | null
  order_created_at: string
  due_date: string | null
  currency: string
  payment_terms: string | null
  deposit_percent: number | null
  price_term: string | null
  payment_method: string | null
  port_of_loading: string | null
  port_of_discharge: string | null
  qty_tolerance_pct: number | null
  partial_shipment: boolean | null
  transhipment: boolean | null
  required_docs: string | null
  quote_code: string | null
  owner_name: string | null
}
