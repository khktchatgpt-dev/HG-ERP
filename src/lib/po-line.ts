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

/**
 * QUY ĐỔI ĐÓNG GÓI MUA — dùng chung form soạn đơn và phiếu in/xuất Excel (0128).
 *
 * SL đặt luôn theo ĐVT gốc; hai hàm này chỉ phục vụ dòng chữ "≈ 27,2 bì" và nút
 * gợi ý làm tròn lên nguyên bao — đúng phép chia nhân viên vẫn tự bấm trong
 * Excel (13.596 con ÷ 500 → 28 bì = 14.000 con). Không đụng vào tiền.
 */
export function packCount(qty: number, packSize: number | null): number | null {
  if (!packSize || packSize <= 0 || !(qty > 0)) return null
  return Math.round((qty / packSize) * 100) / 100
}

/** SL làm tròn LÊN nguyên bao — 0/không đóng gói thì trả nguyên số. */
export function roundUpToPack(qty: number, packSize: number | null): number {
  if (!packSize || packSize <= 0 || !(qty > 0)) return qty
  return Math.ceil(qty / packSize - 1e-9) * packSize
}

export type PoQtyTotal = { label: string; value: number }

/**
 * Dòng "Tổng số …" ngay dưới bảng hàng của phiếu in / file xuất.
 *
 * Mẫu tính tiền theo kg (nhôm, inox/sắt) cộng cột tổng kg → đúng một dòng.
 * Mẫu còn lại cộng SL đặt nhưng TÁCH THEO ĐVT: cộng "10 cây + 5 thùng" ra 15 là
 * số rác. Bản trước xử lý bằng cách BỎ HẲN dòng tổng khi đơn trộn đơn vị — im
 * lặng, và rơi đúng vào mẫu phụ kiện vốn gần như luôn trộn Con/Cái/Bộ/Mét. Giờ
 * in mỗi ĐVT một dòng, thứ tự theo lần xuất hiện đầu tiên trong đơn.
 */
export function qtyTotals(
  kgBased: boolean,
  lines: readonly {
    material_unit: string
    qty_ordered: number
    qty2?: number | null
  }[],
): PoQtyTotal[] {
  if (kgBased) {
    const kg = lines.reduce((s, l) => s + (l.qty2 ?? 0), 0)
    return kg > 0 ? [{ label: 'Tổng số KG', value: kg }] : []
  }
  const byUnit = new Map<string, number>()
  for (const l of lines) {
    const u = (l.material_unit ?? '').trim()
    byUnit.set(u, (byUnit.get(u) ?? 0) + (Number(l.qty_ordered) || 0))
  }
  return [...byUnit]
    .filter(([, v]) => v > 0)
    .map(([u, v]) => ({ label: u ? `Tổng số ${u.toUpperCase()}` : 'Tổng số', value: v }))
}

const sameUnit = (a: string | null | undefined, b: string | null | undefined) =>
  (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase()

/**
 * ĐƠN GIÁ ĐIỀN SẴN cho dòng mới — và điền sai còn tệ hơn để trống.
 *
 * Mỗi con số giá đều đi kèm một ĐƠN VỊ ngầm: mẫu nhôm/inox là đ/kg, mẫu còn lại
 * là đ/ĐVT mua. Bản trước điền thẳng `last_purchase_price` của danh mục mà không
 * xét đơn vị — 478 mã đang khai `price_unit = 'kg'`, nên đặt một trong số đó ở
 * mẫu Đơn giản là chép giá đ/kg vào ô đ/cây, lệch cỡ 6 lần và không cảnh báo gì.
 *
 * Thứ tự: giá của ĐƠN GẦN NHẤT (số hai bên đã ký) → giá tham chiếu ở danh mục.
 * Nguồn nào lệch đơn vị với mẫu đang soạn thì BỎ QUA, để trống cho người mua gõ.
 */
export function prefillPrice(
  templatePriceUnit: string | null,
  m: {
    last_po?: { unit_price: number; price_unit: string | null } | null
    last_purchase_price?: number | null
    price_unit?: string | null
  },
): number | '' {
  const po = m.last_po
  if (po && po.unit_price > 0 && sameUnit(po.price_unit, templatePriceUnit)) {
    return po.unit_price
  }
  const cat = Number(m.last_purchase_price)
  if (cat > 0 && sameUnit(m.price_unit, templatePriceUnit)) return cat
  return ''
}

/** Nhãn đơn giá cho UI/in: "Đơn giá/kg" khi tính theo đv2, "Đơn giá" khi thường. */
export function priceUnitLabel(
  basis: PriceBasis | null | undefined,
  unit2: string | null | undefined,
): string {
  return (basis ?? 'unit') === 'unit2' && unit2 ? `Đơn giá/${unit2}` : 'Đơn giá'
}
