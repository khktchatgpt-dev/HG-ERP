/**
 * LOẠI QUY ĐỔI (Profile A/B/C) — quy tắc lái form đặt vật tư, tách thành hàm
 * THUẦN để test (tài liệu ItemMaster §2). Form đặt chỉ đọc profile của vật tư
 * rồi ẩn/hiện/khoá ô; công thức tiền vẫn dùng `poLineAmount` (po-line.ts).
 *
 *   A — Đơn vị đơn      : đặt = giá = tồn.        Thành tiền = SL × đơn giá.
 *   B — Quy đổi cố định : hệ số CỨNG, ô kg khoá.  Thành tiền = SL × hệ số × đơn giá.
 *   C — Cân thực tế     : kg lưu riêng, SỬA được. Thành tiền = kg thực × đơn giá.
 */

import { type PriceBasis } from './po-line'

export type ConversionProfile = 'A' | 'B' | 'C'

export const CONVERSION_PROFILES: readonly ConversionProfile[] = ['A', 'B', 'C']

/** Nhãn đầy đủ cho bộ chọn / badge. */
export const PROFILE_LABELS: Record<ConversionProfile, string> = {
  A: 'A — Đơn vị đơn',
  B: 'B — Quy đổi cố định',
  C: 'C — Cân thực tế',
}

/** Nhãn ngắn 1 dòng (badge trong bảng). */
export const PROFILE_SHORT: Record<ConversionProfile, string> = {
  A: 'Đơn vị đơn',
  B: 'Quy đổi cố định',
  C: 'Cân thực tế',
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** B & C có ô "SL tính giá" (qty2 = tổng kg/m²/lít); A tính thẳng trên SL đặt. */
export function hasQty2(profile: ConversionProfile): boolean {
  return profile === 'B' || profile === 'C'
}

/** Ô qty2 khoá không cho sửa? Chỉ B (hệ số cứng). C cho sửa theo kg cân thực. */
export function isQty2Locked(profile: ConversionProfile): boolean {
  return profile === 'B'
}

/**
 * Gợi ý SL tính giá (qty2):
 *  - A: null (không dùng qty2).
 *  - C: ưu tiên kg cân thực từ BOM (`kgNeeded`) nếu có.
 *  - B & C: SL đặt × hệ số/định mức (`unit2_factor`).
 * Thiếu qty/factor → null để form giữ ô trống, người mua tự nhập.
 */
export function suggestQty2(
  profile: ConversionProfile,
  unit2_factor: number | null | undefined,
  qty: number | null | undefined,
  kgNeeded?: number | null,
): number | null {
  if (!hasQty2(profile)) return null
  if (profile === 'C' && kgNeeded != null && kgNeeded > 0) return round2(kgNeeded)
  if (qty != null && qty > 0 && unit2_factor) return round2(qty * unit2_factor)
  return null
}

/**
 * Map profile → cách dựng dòng PO (khớp `price_basis` của pos.schema/po-line):
 *  - A       → 'unit'  (SL đặt × giá), unit2 = null.
 *  - B & C   → 'unit2' (qty2 × giá),   unit2 = đơn vị tính giá của vật tư.
 */
export function profileLineMapping(
  profile: ConversionProfile,
  price_unit: string | null | undefined,
): { price_basis: PriceBasis; unit2: string | null } {
  if (hasQty2(profile)) return { price_basis: 'unit2', unit2: price_unit ?? null }
  return { price_basis: 'unit', unit2: null }
}
