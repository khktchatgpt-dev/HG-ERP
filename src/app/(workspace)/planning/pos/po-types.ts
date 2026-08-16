import type { PoStatus } from '@/lib/po-status'

/**
 * KIỂU DỮ LIỆU CỦA MÀN ĐƠN ĐẶT HÀNG.
 *
 * Ba kiểu này trước nằm trong `PosManager.tsx`, nên mọi thứ cần biết hình thù
 * một dòng PO — kể cả logic thuần (`pos-groups`) và hai tệp bên khu Giám đốc —
 * đều phải `import type` xuyên qua một component 'use client' 1.300 dòng, và
 * hook `usePoActions` thì tạo vòng import với chính component gọi nó.
 *
 * Tách ra tệp không có JSX: ai cần kiểu thì lấy kiểu, không kéo theo màn hình.
 */

export type Po = {
  id: string
  code: string
  /** null = PO ngoài LSX (0076). */
  production_order_id: string | null
  supplier_id: string
  status: PoStatus
  currency: string
  vat_rate: number | null
  price_includes_vat: boolean
  expected_at: string | null
  terms: string | null
  note: string | null
  created_at: string
  // Mốc chuyển trạng thái (có ở detail API) — cho stepper. Optional để list row bỏ qua được.
  approved_at?: string | null
  ordered_at?: string | null
  /** Người PHỤ TRÁCH đơn (0128) — quyền thao tác xét theo đây, không phải cả phòng. */
  assigned_to?: string | null
  assignee_name?: string | null
  supplier_name: string
  /** null = PO ngoài LSX (0076). */
  lsx_code: string | null
  order_code: string | null
  // Tổng tiền (Σ dòng) — bơm từ page cho cột Giá trị ở danh sách.
  total?: number
  /** Tiến độ về kho theo DÒNG (0126) — bơm từ page, cột "Về kho x/y dòng". */
  lines_done?: number
  lines_total?: number
  /**
   * LSX PHỤ gộp vào đơn (0125) — đơn thật ghi "LSX 01+2+3/26-27".
   *
   * Bơm từ page. Thiếu nó thì đơn gộp chỉ hiện ở lệnh CHÍNH, còn các lệnh kia
   * bị màn danh sách kết luận là "chưa có đơn đặt nào".
   */
  extra_lsx?: { id: string; code: string }[]
}

export type PoLine = {
  id: string
  /** null = dòng tự do (0134) — material_name/unit đã fallback từ tên tự gõ. */
  material_id: string | null
  qty_ordered: number
  unit_price: number | null
  price_basis: 'unit' | 'unit2'
  spec: string | null
  qty2: number | null
  unit2: string | null
  note: string | null
  material_code: string
  material_name: string
  material_unit: string
}

export type StatusLine = {
  id: string
  /** null = DÒNG TỰ DO (0134) — nghiệm thu ngoài sổ kho. */
  material_id: string | null
  qty_ordered: number
  qty_received: number
  /** Thiếu THẬT so với đặt — giữ nguyên nghĩa dù đã chốt thiếu (0154). */
  qty_missing: number
  /** Còn CHỜ VỀ (0154): dòng đã chốt thiếu = 0. */
  qty_open: number
  /** Mốc chốt "phần thiếu không giao nữa" — null = dòng còn mở. */
  closed_short_at: string | null
  /** Lý do chốt — chỉ trang chi tiết nạp (tooltip badge). */
  closed_short_reason?: string | null
  material_code: string
  material_name: string
  material_unit: string
}

export type SupplierOption = { id: string; name: string }
