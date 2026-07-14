/**
 * Tính tiền dòng đơn đặt vật tư — CÔNG THỨC DUY NHẤT cho cả server (tổng chi
 * NCC, phiếu in) lẫn client (form tạo/sửa PO, chi tiết). Logic thuần, testable.
 *
 * Giá đơn vị kép (0053 — mô hình SAP Order Price Unit thu gọn):
 *   price_basis = 'unit'  → thành tiền = SL đặt (ĐVT mua)  × đơn giá
 *   price_basis = 'unit2' → thành tiền = qty2 (tổng kg/m²) × đơn giá
 * unit2 mà thiếu qty2 (dữ liệu dở dang) → coi như 0, không âm thầm rơi về unit
 * để tránh in ra tổng sai với hoá đơn NCC.
 */

export type PriceBasis = 'unit' | 'unit2'

export type PoLineAmountInput = {
  qty_ordered: number
  unit_price: number | null
  price_basis?: PriceBasis | null
  qty2?: number | null
}

export function poLineAmount(l: PoLineAmountInput): number {
  const price = l.unit_price ?? 0
  if ((l.price_basis ?? 'unit') === 'unit2') return (l.qty2 ?? 0) * price
  return l.qty_ordered * price
}

/** Nhãn đơn giá cho UI/in: "Đơn giá/kg" khi tính theo đv2, "Đơn giá" khi thường. */
export function priceUnitLabel(
  basis: PriceBasis | null | undefined,
  unit2: string | null | undefined,
): string {
  return (basis ?? 'unit') === 'unit2' && unit2 ? `Đơn giá/${unit2}` : 'Đơn giá'
}
