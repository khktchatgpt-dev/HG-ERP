/**
 * GHI CHÚ PHÂN BỔ THEO SẢN PHẨM cho dòng đơn đặt — "300 Bàn 65 gỗ (4c/sp)".
 *
 * Trong sổ Excel của Cung ứng, MỌI dòng đơn phụ kiện đều ghi tay cột Ghi chú
 * kiểu "50 bàn santorin (4c/sp)\n300 bàn 65 gỗ (2c/sp)" — để truy vết SL đặt
 * đến từ sản phẩm nào của lệnh. Dữ liệu ấy hệ thống đã có (bảng chi tiết của
 * LSX / BOM × SL đơn), nên tự sinh sẵn thay vì bắt gõ lại.
 *
 * Logic thuần, dùng ở cả server (needs route dựng breakdown) lẫn client (form
 * đổ breakdown vào ô Ghi chú khi thêm dòng từ nhu cầu).
 */

export type MaterialAllocation = {
  /** Nhãn sản phẩm — tên tiếng Việt của dòng LSX, thiếu thì mã SP. */
  product: string
  /** SL sản phẩm của dòng lệnh (300 bàn). */
  qty: number
  /** Định mức vật tư / 1 sản phẩm (4c/sp) — null khi định mức tính theo kg/m². */
  per_unit: number | null
}

/**
 * Gộp hai danh sách phân bổ (đơn nhiều LSX): cùng nhãn SP + cùng định mức thì
 * cộng SL, còn lại nối đuôi — hai lệnh cùng làm "Bàn Santorin" ra một dòng ghi
 * chú 500 chứ không hai dòng 450 + 50 nói cùng một thứ.
 */
export function mergeAllocations(
  a: MaterialAllocation[],
  b: MaterialAllocation[],
): MaterialAllocation[] {
  const out = a.map((x) => ({ ...x }))
  for (const item of b) {
    const hit = out.find(
      (x) => x.product === item.product && x.per_unit === item.per_unit,
    )
    if (hit) hit.qty += item.qty
    else out.push({ ...item })
  }
  return out
}

const num = (n: number) => n.toLocaleString('vi-VN')

/**
 * Danh sách phân bổ → chuỗi ghi chú, mỗi sản phẩm một dòng, đúng lối ghi trong
 * sổ: "300 Bàn 65 gỗ (4c/sp)". Định mức lẻ (kg/m — 0.42/sp) vẫn in được; thiếu
 * định mức thì chỉ ghi "300 Bàn 65 gỗ".
 */
export function allocationNote(items: MaterialAllocation[]): string {
  return items
    .filter((i) => i.qty > 0 && i.product.trim() !== '')
    .map(
      (i) =>
        `${num(i.qty)} ${i.product.trim()}${
          i.per_unit != null && i.per_unit > 0 ? ` (${num(i.per_unit)}c/sp)` : ''
        }`,
    )
    .join('\n')
}
