import { type PoLine } from '@/app/(workspace)/planning/pos/PosManager'

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
  lines?: PoLine[]
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
