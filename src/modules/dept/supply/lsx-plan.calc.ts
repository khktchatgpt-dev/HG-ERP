import type { PlanRowInput } from './lsx-plan.schema'

/**
 * Phép tính của bảng kê vật tư — tách riêng khỏi repo/service để test được.
 * Số lấy từ file thật của phòng Cung ứng (sheet BKVT), không bịa:
 *
 *   đm/sp 4 × SL 50 = 200  → hao 3% → SL cần đặt 206
 *   đm/sp 24 × SL 50 = 1200 → hao 3% → 1236
 */

/** SL đặt hàng = đm/sp × SL sản phẩm. Thiếu vế nào thì trả null (không đoán). */
export function requiredQty(row: {
  qty_per_product?: number | null
  product_qty?: number | null
  qty_required?: number | null
}): number | null {
  if (row.qty_required != null) return row.qty_required
  const dm = row.qty_per_product
  const sl = row.product_qty
  if (dm == null || sl == null) return null
  return dm * sl
}

/**
 * SL cần đặt = ceil(SL đặt × (1 + hao%)) − tồn, không âm.
 *
 * LÀM TRÒN LÊN: mua 205,4 con vít là vô nghĩa, và làm tròn xuống thì thiếu hàng
 * — file thật cũng lấy 206 chứ không 205. Trừ tồn CHỈ khi người lập điền cột
 * tồn; bỏ trống nghĩa là "chưa tra tồn", không phải "tồn = 0".
 */
export function orderQty(row: {
  qty_required?: number | null
  waste_pct?: number | null
  qty_on_hand?: number | null
}): number {
  const need = row.qty_required ?? 0
  const withWaste = Math.ceil(need * (1 + (row.waste_pct ?? 0) / 100))
  const onHand = row.qty_on_hand ?? 0
  return Math.max(0, withWaste - onHand)
}

/** Chuẩn hoá một dòng nhập: điền nốt hai cột dẫn xuất, giữ nguyên số người gõ. */
export function normalizeRow(row: PlanRowInput): PlanRowInput & {
  qty_required: number
  qty_to_order: number
  waste_pct: number
} {
  const qty_required = requiredQty(row) ?? 0
  const waste_pct = row.waste_pct ?? 0
  const qty_to_order =
    row.qty_to_order ??
    orderQty({ qty_required, waste_pct, qty_on_hand: row.qty_on_hand })
  return { ...row, qty_required, waste_pct, qty_to_order }
}

/**
 * Mã trong cột NCC của file KHÔNG phải nhà cung cấp — suy ra trạng thái dòng.
 * Nguồn: docs/po-suppliers-wip.md (rà 8 file đơn thật).
 */
export function statusFromLabel(
  label?: string | null,
): 'self_make' | 'enough' | 'other' | null {
  const s = (label ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // bỏ dấu — file gõ "ĐỦ", "Đủ", "du"
    .replace(/đ/gi, 'd')
    .trim()
    .toLowerCase()
  if (!s) return null
  if (s === 'hgia' || s.startsWith('hoang gia')) return 'self_make' // xưởng tự làm
  if (s === 'du' || s.startsWith('du ')) return 'enough' // tồn đủ, khỏi mua
  if (s === 'tq' || s.startsWith('chua mua')) return 'other'
  return null
}
