/**
 * DÒNG NÀO PHẢI GHI KG CÂN THỰC khi nhập kho (chủ dự án chốt 01/10/2026).
 *
 * Nhôm, thép mua theo cây nhưng TÍNH TIỀN THEO KG, và điều khoản mẫu nhôm ghi
 * rõ "khối lượng thanh toán = khối lượng thực nhận sau khi hai bên cân". Không
 * có kg cân thì Cung ứng không chốt được kg thanh toán, Kế toán không đối chiếu
 * được hoá đơn. Cột `warehouse_movements.qty2_actual` có từ trước nhưng chưa màn
 * nào ghi — hai phiếu thép ngày 27/09 đều để trống.
 *
 * Luật: đơn mẫu Nhôm định hình / Sắt-thép-tấm theo kg, HOẶC dòng tính giá theo
 * đơn vị 2 mà đơn vị 2 là kg. Dùng chung cho form (nói trước khi bấm) và server
 * (chặn thật).
 */

const KG_TEMPLATES = new Set(['aluminium', 'metal_kg'])

export function canCanKg(
  template: string | null | undefined,
  line: { price_basis?: string | null; unit2?: string | null },
): boolean {
  if (template && KG_TEMPLATES.has(template)) return true
  return line.price_basis === 'unit2' && /^\s*kg\s*$/i.test(line.unit2 ?? '')
}

/**
 * Kg dự kiến cho số cây nhận lần này — suy từ tổng kg của dòng đơn theo tỉ lệ
 * số lượng. Chỉ để gợi ý và so lệch, KHÔNG thay số cân.
 */
export function kgDuKien(
  qty: number,
  line: { qty_ordered: number; qty2: number | null },
): number | null {
  if (!line.qty2 || !line.qty_ordered || qty <= 0) return null
  return Math.round(((line.qty2 * qty) / line.qty_ordered) * 100) / 100
}

/** Lệch % của kg cân so với kg dự kiến (âm = cân nhẹ hơn). */
export function lechKg(kgCan: number, kgDuKienVal: number | null): number | null {
  if (!kgDuKienVal || kgDuKienVal <= 0 || !(kgCan > 0)) return null
  return Math.round(((kgCan - kgDuKienVal) / kgDuKienVal) * 1000) / 10
}
