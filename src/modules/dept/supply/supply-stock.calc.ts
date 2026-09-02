/**
 * Phần TÍNH của màn Kho & tồn (Cung ứng) — tách khỏi service để test được.
 *
 * Ba con số ở đây đi thẳng vào quyết định mua nên phải có test canh: khả dụng
 * (đã trừ hàng hứa cho LSX), vị thế (đã cộng hàng đang trên đường) và còn
 * thiếu. Nhầm một dấu là hoặc đặt trùng hàng đã đặt, hoặc bỏ sót đúng mã đang
 * chặn lệnh sản xuất.
 */

export type BuyerFigureInput = {
  on_hand: number
  /** Giữ chỗ cho LSX đã cam kết. */
  reserved: number
  /** Đã đặt còn phải về (PO đã duyệt). */
  ordered: number
  min_stock: number
  reorder_point: number | null
}

export type BuyerFigures = {
  available: number
  position: number
  threshold: number
  shortage: number
}

/**
 * `position` CỘNG hàng đang về nhưng KHÔNG cộng đơn chờ duyệt — đơn chưa duyệt
 * có thể bị Giám đốc bác, coi nó như hàng chắc chắn sẽ có là tự ru ngủ. Đơn
 * chờ duyệt đi đường riêng (`pending`) để cảnh báo trên dòng.
 *
 * `threshold` ưu tiên `reorder_point`, không có mới lấy `min_stock` — cùng
 * quy tắc `computeReorder` của mua bù tồn, để hai màn không nói hai kiểu về
 * cùng một vật tư. Chưa khai ngưỡng (= 0) thì `shortage` = 0: không bịa ra nợ
 * cho 13.169 mã chưa ai đặt mức tồn.
 */
export function deriveBuyerFigures(r: BuyerFigureInput): BuyerFigures {
  const available = r.on_hand - r.reserved
  const position = available + r.ordered
  const threshold =
    r.reorder_point != null && r.reorder_point > 0 ? r.reorder_point : r.min_stock
  return {
    available,
    position,
    threshold,
    shortage: threshold > 0 ? Math.max(threshold - position, 0) : 0,
  }
}

export type BuyerSortRow = {
  code: string
  eta: string | null
  ordered: number
  pending: number
}

/**
 * Thứ tự đọc của người mua: việc GẤP trước.
 *   1. Đã hẹn ngày → ngày gần nhất lên trên (quá hạn nằm trên cùng).
 *   2. Đã đặt/đang chờ duyệt mà CHƯA có ngày — phải gọi NCC chốt ngày.
 *   3. Còn lại theo mã.
 */
export function sortForBuyer(a: BuyerSortRow, b: BuyerSortRow): number {
  const rank = (r: BuyerSortRow) => (r.eta ? 0 : r.ordered > 0 || r.pending > 0 ? 1 : 2)
  const ra = rank(a)
  const rb = rank(b)
  if (ra !== rb) return ra - rb
  if (ra === 0) return (a.eta ?? '').localeCompare(b.eta ?? '')
  return a.code.localeCompare(b.code)
}
