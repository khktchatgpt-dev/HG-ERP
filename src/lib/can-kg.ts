/**
 * DÒNG NÀO CÓ Ô KG CÂN khi nhập kho — KHÔNG BẮT BUỘC (chủ dự án 02/10/2026:
 * "đơn hàng là cây thì nhận đủ số lượng là được").
 *
 * Bản 01/10 bắt ghi kg cho MỌI dòng đơn mẫu nhôm/thép và chặn ghi sổ khi thiếu —
 * kể cả đơn trả tiền theo CÂY (PO-2026-0116 Visa), nên phiếu nhận đủ cây vẫn bị
 * xếp "Cần xử lý". Nay: ô kg chỉ hiện ở dòng TÍNH TIỀN THEO KG (giá theo đơn vị 2
 * = kg), để ai có cân thì ghi; không cân thì kg của đơn (barem) vẫn là số tính tiền.
 * Không chặn ghi sổ, không thành việc phải làm.
 */

export function canCanKg(
  template: string | null | undefined,
  line: { price_basis?: string | null; unit2?: string | null },
): boolean {
  void template // giữ tham số: chỗ gọi cũ truyền mẫu đơn — luật nay chỉ xét dòng
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
