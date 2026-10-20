/**
 * TRẠNG THÁI XUẤT HÀNG của đơn bán — logic thuần (07/10/2026, chốt D4).
 *
 * Trạng thái không còn do ai bấm mà SUY từ Σ đợt xuất (sales_order_shipments,
 * 0120) so với tổng SL đơn, có dung sai `qty_tolerance_pct` (Sales Contract
 * Art 3.1, ví dụ ±10%):
 *   shipped ≥ total × (1 − tol)   → 'shipped'         (xuất đủ trong dung sai)
 *   0 < shipped                   → 'partially_shipped'
 *   shipped = 0                   → trạng thái NỀN (confirmed / lsx_* / completed)
 *
 * Tách khỏi service để test được: siết sai là Sale không ghi xuất được, nới sai
 * là đơn "xuất đủ" khi còn thiếu hàng.
 */

export type ShipBase = 'confirmed' | 'lsx_pending' | 'lsx_issued' | 'completed'
export type ShipDerived = ShipBase | 'partially_shipped' | 'shipped'

/** Dung sai hợp lệ 0–100; null/NaN = 0. */
export function tolerance(pct: number | null | undefined): number {
  const n = Number(pct)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.min(n, 100)
}

/** Số còn được xuất của MỘT dòng, đã cộng dung sai: qty × (1 + tol) − đã xuất. */
export function shipCapacity(
  lineQty: number,
  shipped: number,
  tolerancePct: number | null | undefined,
): number {
  const cap = lineQty * (1 + tolerance(tolerancePct) / 100) - shipped
  return cap > 0 ? Math.round(cap * 100) / 100 : 0
}

/** Trạng thái suy ra từ tổng đã xuất của CẢ đơn. */
export function shipStatus(
  base: ShipBase,
  shippedTotal: number,
  orderTotal: number,
  tolerancePct: number | null | undefined,
): ShipDerived {
  if (!(shippedTotal > 0) || !(orderTotal > 0)) return base
  const enough = orderTotal * (1 - tolerance(tolerancePct) / 100)
  return shippedTotal + 1e-9 >= enough ? 'shipped' : 'partially_shipped'
}

/**
 * Trạng thái NỀN của đơn khi chưa/không còn đợt xuất — lấy từ lệnh: lệnh đã xong
 * → 'completed'; có lệnh → 'lsx_issued' (hoặc 'lsx_pending' khi lệnh chờ duyệt);
 * chưa có lệnh → 'confirmed'. Đơn đang ở trạng thái nền thì giữ nguyên.
 */
export function baseStatus(
  orderStatus: string,
  lsxStatus: string | null | undefined,
  hasLsx: boolean,
): ShipBase {
  if (
    orderStatus === 'confirmed' ||
    orderStatus === 'lsx_pending' ||
    orderStatus === 'lsx_issued' ||
    orderStatus === 'completed'
  ) {
    return orderStatus
  }
  if (lsxStatus === 'completed') return 'completed'
  if (!hasLsx) return 'confirmed'
  return lsxStatus === 'pending_approval' ? 'lsx_pending' : 'lsx_issued'
}

/**
 * Giao THIẾU bao nhiêu so với mức đủ (đã trừ dung sai)? 0 = đủ. Dùng khi xác
 * nhận "đã giao": thiếu thì bắt ghi lý do, không chặn (khách có thể huỷ phần còn).
 */
export function deliveryShortfall(
  shippedTotal: number,
  orderTotal: number,
  tolerancePct: number | null | undefined,
): number {
  const enough = orderTotal * (1 - tolerance(tolerancePct) / 100)
  const gap = enough - shippedTotal
  return gap > 1e-9 ? Math.round(gap * 100) / 100 : 0
}

/** Các trạng thái mà "Xác nhận đã giao" có nghĩa (hàng đã/đang rời xưởng). */
export const DELIVERABLE_STATUSES: ReadonlySet<string> = new Set([
  'completed',
  'partially_shipped',
  'shipped',
])
