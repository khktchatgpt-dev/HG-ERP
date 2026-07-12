/**
 * Quy đổi đơn vị vật tư qua base_unit (bảng item_uom — migration 0044) — thuần,
 * dùng cả server (ghi PO/phiếu kho) lẫn client (form nhập theo đơn vị NCC).
 *
 * Mỗi đơn vị khai hệ số `to_base`: 1 unit = to_base × base_unit.
 *   base_unit 'cây', ống 6m: mét.to_base = 1/6, kg.to_base = 1/8.4…
 * Làm tròn 6 số lẻ (khớp numeric(18,6) của cột to_base) để không ra float rác.
 */

export type Uom = {
  /** Nhãn đơn vị: 'cây' | 'kg' | 'mét' | 'thùng'… */
  unit: string
  /** 1 unit = to_base × base_unit. Phải > 0. */
  to_base: number
}

const round6 = (n: number) => Math.round(n * 1_000_000) / 1_000_000

/** Quy SL từ một đơn vị về base_unit: qty × to_base. */
export function toBase(qty: number, toBaseFactor: number): number {
  if (!(toBaseFactor > 0)) throw new Error('to_base phải > 0')
  return round6(qty * toBaseFactor)
}

/** Quy SL từ base_unit ra một đơn vị: qty / to_base. */
export function fromBase(qtyBase: number, toBaseFactor: number): number {
  if (!(toBaseFactor > 0)) throw new Error('to_base phải > 0')
  return round6(qtyBase / toBaseFactor)
}

/** Đổi trực tiếp giữa 2 đơn vị của cùng vật tư: qty × from.to_base ÷ to.to_base. */
export function convert(qty: number, from: Uom, to: Uom): number {
  if (!(from.to_base > 0) || !(to.to_base > 0)) throw new Error('to_base phải > 0')
  return round6((qty * from.to_base) / to.to_base)
}
