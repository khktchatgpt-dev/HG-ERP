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
  lsx_code: string
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
  product_code: string
  product_name: string
  product_unit: string
  qty: number
  unit_price: number
  bom_status: 'none' | 'drawing' | 'done'
  /** Ảnh đại diện SP (URL đã ký) — null nếu chưa đặt ảnh. */
  image_url: string | null
  /** Thông số kỹ thuật SX (tech_spec) — GĐ xem SP hoàn thiện thế nào. */
  spec: {
    machine: string
    cushion: string
    paint: string
    glass: string
    wood: string
  }
}

export type PendingLsx = {
  id: string
  code: string
  order_code: string
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
  /** Thông tin thương mại của đơn hàng gốc (bên Sales) — bối cảnh để GĐ duyệt. */
  order?: ApprovalOrderInfo | null
  lines?: ApprovalLsxLine[]
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
