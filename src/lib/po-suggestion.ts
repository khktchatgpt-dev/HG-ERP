/**
 * Đề xuất SL mua khi lập đơn đặt hàng (PO) — thuần, có test.
 * Kế hoạch: docs/plan-don-dat-hang-chuan-erp.md §P1 (Cách 2, chốt 12/07/2026).
 *
 * Nguyên tắc "đã cam kết" = SAU cổng duyệt Giám đốc (cả LSX lẫn PO đều GĐ duyệt):
 *  - Tồn khả dụng = tồn thực − nhu cầu còn lại của LSX KHÁC đã `approved|in_progress`
 *    (LSX chờ duyệt KHÔNG giữ chỗ). Bảo thủ: không trừ hàng đang về của LSX khác.
 *  - "Đã đặt" (trừ khỏi đề xuất) = PO của LSX NÀY đã qua duyệt GĐ
 *    (`approved|ordered|confirmed|in_transit|partial`), phần chưa nhận.
 *  - "Chờ duyệt" = PO của LSX này còn `pending_approval` → CHỈ cảnh báo, không trừ.
 *
 *   đề_xuất = max( cần − tồn_khả_dụng − đã_đặt , 0 )
 *
 * Hàm này chỉ làm SỐ HỌC + kẹp ≥ 0; việc gộp DL theo trạng thái do repo lo.
 * Số lượng để nguyên đơn vị base (caller tự ceil theo UoM nếu muốn đặt trọn cây).
 */

export type MaterialSuggestInput = {
  material_id: string
  /** Cần của LSX này (nhu cầu còn lại — smartLsxNeeds.qty_remaining). */
  needed: number
  /** Tồn thực trong kho (warehouse_stock.on_hand). */
  on_hand: number
  /** Σ nhu cầu còn lại của LSX KHÁC đang approved|in_progress (giữ chỗ tồn). */
  reserved_others: number
  /** Σ (qty_ordered − qty_received) của PO đã duyệt của LSX này. */
  ordered: number
  /** Σ qty_ordered của PO pending_approval của LSX này (chỉ cảnh báo). */
  pending: number
}

export type MaterialSuggest = {
  material_id: string
  needed: number
  on_hand: number
  reserved_others: number
  /** max(on_hand − reserved_others, 0) — tồn còn dùng được cho LSX này. */
  available: number
  ordered: number
  pending: number
  /** max(needed − available − ordered, 0). */
  suggest: number
  /** suggest === 0 → không cần mua thêm. */
  enough: boolean
  /** pending > 0 → đã có PO cùng vật tư chờ GĐ duyệt, cảnh báo đặt trùng. */
  has_pending: boolean
}

const round4 = (n: number) => Math.round(n * 10_000) / 10_000
/** Kẹp về 0 cho SL âm / NaN (dữ liệu lệch không được làm vỡ đề xuất). */
const nn = (n: number) => (Number.isFinite(n) && n > 0 ? round4(n) : 0)

export function suggestForMaterial(input: MaterialSuggestInput): MaterialSuggest {
  const needed = nn(input.needed)
  const on_hand = nn(input.on_hand)
  const reserved_others = nn(input.reserved_others)
  const ordered = nn(input.ordered)
  const pending = nn(input.pending)

  const available = nn(on_hand - reserved_others)
  const suggest = nn(needed - available - ordered)

  return {
    material_id: input.material_id,
    needed,
    on_hand,
    reserved_others,
    available,
    ordered,
    pending,
    suggest,
    enough: suggest === 0,
    has_pending: pending > 0,
  }
}

export function suggestPurchase(inputs: MaterialSuggestInput[]): MaterialSuggest[] {
  return inputs.map(suggestForMaterial)
}
