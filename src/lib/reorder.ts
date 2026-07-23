/**
 * Mua bù tồn (hoàn thiện nghiệp vụ Cung ứng ①) — gợi ý cho PO NGOÀI LSX:
 * vật tư tụt dưới ngưỡng đặt lại → đề xuất số cần mua. Thuần, có test.
 *
 * Quy tắc (chuẩn min-max / reorder point, khớp cột 0043 của item master):
 *   - ngưỡng   = reorder_point (nếu >0) — không có thì dùng min_stock.
 *     ngưỡng ≤ 0 = vật tư không theo dõi bù tồn → bỏ qua.
 *   - vị thế   = khả dụng (on_hand − giữ chỗ LSX) + đã đặt còn phải về.
 *     Tính cả hàng đang về để KHÔNG đặt trùng (cùng triết lý đề xuất theo LSX).
 *   - cần mua  khi vị thế < ngưỡng.
 *   - số gợi ý = reorder_qty (nếu >0 — lô đặt cố định);
 *     không có thì bù tới max_stock (nếu >ngưỡng), không nữa thì bù về đúng ngưỡng.
 *   - PO đang CHỜ DUYỆT không trừ vào vị thế — chỉ giơ cờ has_pending cảnh báo.
 */

export type ReorderInput = {
  material_id: string
  code: string
  name: string
  unit: string
  min_stock: number
  max_stock: number | null
  reorder_point: number | null
  reorder_qty: number | null
  /** on_hand − giữ chỗ LSX cam kết (âm = đang thiếu cho LSX). */
  available: number
  /** Đã đặt còn phải về (PO đã duyệt, qty_missing). */
  ordered: number
  /** Đang chờ GĐ duyệt (chỉ cảnh báo). */
  pending: number
  default_supplier_id: string | null
}

export type ReorderSuggestion = ReorderInput & {
  threshold: number
  position: number
  suggest: number
  has_pending: boolean
}

export function computeReorder(rows: ReorderInput[]): ReorderSuggestion[] {
  const out: ReorderSuggestion[] = []
  for (const r of rows) {
    const threshold =
      r.reorder_point != null && r.reorder_point > 0 ? r.reorder_point : r.min_stock
    if (threshold <= 0) continue // không theo dõi bù tồn
    const position = r.available + r.ordered
    if (position >= threshold) continue // còn đủ (kể cả hàng đang về)

    let suggest: number
    if (r.reorder_qty != null && r.reorder_qty > 0) {
      suggest = r.reorder_qty
    } else if (r.max_stock != null && r.max_stock > threshold) {
      suggest = r.max_stock - position
    } else {
      suggest = threshold - position
    }
    out.push({
      ...r,
      threshold,
      position,
      suggest,
      has_pending: r.pending > 0,
    })
  }
  // Thiếu nặng lên đầu: vị thế/ngưỡng nhỏ nhất trước (âm = thiếu cho LSX rồi).
  return out.sort((a, b) => a.position / a.threshold - b.position / b.threshold)
}
