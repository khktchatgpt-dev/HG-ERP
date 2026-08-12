/**
 * VẬT TƯ NHƯ FORM SOẠN ĐƠN CẦN — MỘT định nghĩa cho cả hai đầu (đợt 1 cải thiện
 * thiết kế vật tư, 13/08/2026 — docs/vat-tu-ke-hoach-cai-thien-thiet-ke.md).
 *
 * Trước đây kiểu này khai HAI nơi: server (`po-materials.repo.ts` — nơi dựng
 * payload) và client (`MaterialPicker.tsx` — nơi đọc payload qua
 * /api/dept/supply/po-materials). Thêm trường 0137 phải sửa cả hai, quên một
 * bên là client lặng lẽ đọc `undefined` — bẫy đã ghi trong memory phiên 12/08.
 * File này thuần type (không import runtime nào) nên client component import
 * an toàn.
 *
 * Trường optional là CÓ CHỦ ĐÍCH: fixture test và chỗ gọi cũ không phải khai
 * đủ; server luôn điền, thiếu coi như null.
 */

/**
 * Ô MÔ TẢ của lần đặt GẦN NHẤT — điền sẵn lên dòng mới (08/08/2026, "hạn chế
 * nhân viên phải gõ"): Vật liệu/Màu/Kích thước/Cách mở… của một vật tư gần như
 * không đổi giữa các đơn, gõ lại mỗi lần chỉ tổ sai chính tả so với phiếu cũ.
 */
export type PoLastLine = {
  material_grade: string | null
  dimension_text: string | null
  finish: string | null
  pcs_per_ctn: number | null
  open_style: string | null
  dm_per_sp: number | null
  /**
   * Bộ ô của các mẫu tính theo kích thước (0136 — đặt lần 2 chỉ còn gõ SL+giá):
   * m²/tấm (kính/carton), D×R×Dày (xốp), giá/m² + bản in (carton) và cơ sở
   * tính tiền từng dòng. `newLine` chỉ nhận basis HỢP LỆ với mẫu đang soạn.
   */
  area_m2?: number | null
  inner_l_mm?: number | null
  inner_w_mm?: number | null
  inner_h_mm?: number | null
  price_per_m2?: number | null
  print_fee?: number | null
  carton_basis?: string | null
}

export type PoMaterial = {
  id: string
  code: string
  name: string
  unit: string
  group_name: string | null
  /** Nhóm phụ (0111) — hiện trên dòng kết quả để phân biệt hàng cùng tên. */
  sub_group: string | null
  spec: string | null
  kg_per_m: number | null
  kg_per_unit: number | null
  default_bar_length_m: number | null
  /**
   * GIÁ ĐƠN VỊ KÉP khai ở danh mục (0053): `price_unit` = đơn vị của đơn giá
   * ('kg'…), `unit2_factor` = bao nhiêu đơn-vị-giá trong MỘT ĐVT mua (23,94
   * kg/tấm). Kho khai một lần, đơn đặt dùng lại.
   */
  price_unit: string | null
  unit2_factor: number | null
  vat_rate: number | null
  default_supplier_id: string | null
  last_purchase_price: number | null
  /** Đóng gói mua (0124): 1 pack_unit = pack_size ĐVT (vd 1 bì = 500 con). */
  pack_size: number | null
  pack_unit: string | null
  /** Vật liệu/màu khai ở danh mục (0124) — nguồn dự phòng khi chưa có lần đặt nào. */
  material_grade: string | null
  /** Thông số theo nhóm (0137): bao bì — cách mở + SP/thùng; kim loại — bề mặt. */
  open_style?: string | null
  pcs_per_ctn?: number | null
  finish?: string | null
  /**
   * Tồn hiện tại. NULL = vật tư CHƯA CÓ SỔ KHO (chưa từng nhập/xuất/kiểm kê) —
   * khác hẳn "tồn 0 thật".
   */
  on_hand: number | null
  /** null = vật tư chưa từng lên đơn nào. */
  last_line: PoLastLine | null
}
