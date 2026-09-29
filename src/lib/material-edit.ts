/**
 * PANEL SỬA VẬT TƯ (khu Mua hàng, 29/09/2026) — phần thuần, có test.
 *
 * Luật tính tiền (barem, ĐVT, xoá ô khi đổi nhóm) nằm ở `useMaterialCore` +
 * `material-form-guards`; file này chỉ thêm hai thứ panel mới cần.
 */

/**
 * DÀI CÂY ĐỌC TỪ TÊN — "Thép ống kẽm phi 15.9x0.6x6m" → 6.
 *
 * Đo 29/09: SAT1231 có kg/m nhưng ô dài cây TRỐNG dù tên ghi "6m" — mỗi đơn
 * sắt theo kg lại phải gõ tay. Chỉ GỢI Ý (người dùng bấm mới điền), không tự
 * ghi: "6m" trong tên đôi khi là chiều dài bó, không phải cây.
 * Chỉ nhận số đứng sau dấu nhân / khoảng trắng và ngay trước "m" rời (không
 * phải "mm", "m2"), trong khoảng cây thật 1–13 m.
 */
export function barLengthFromName(name: string): number | null {
  const re = /(?:^|[\s×xX*])(\d+(?:[.,]\d+)?)\s*m(?![a-zA-Z0-9²])/g
  let last: number | null = null
  for (const m of name.matchAll(re)) {
    const v = Number(m[1].replace(',', '.'))
    if (v >= 1 && v <= 13) last = v
  }
  return last
}

/**
 * MỘT CÂU nói vì sao chưa lưu được — thứ tự = thứ tự người dùng nên gỡ.
 * null = lưu được.
 */
export function saveBlockReason(s: {
  name: string
  unit: string
  unitUnconfirmed: boolean
  baremUnconfirmed: boolean
  kgOffPct: number | null
  clearedUnconfirmed: string[]
}): string | null {
  if (!s.name.trim()) return 'thiếu tên vật tư'
  if (!s.unit.trim()) return 'thiếu ĐVT đặt hàng'
  if (s.unitUnconfirmed)
    return `ĐVT “${s.unit.trim()}” chưa có trong danh mục — xác nhận hoặc chọn lại`
  if (s.baremUnconfirmed)
    return s.kgOffPct != null
      ? `kg/m lệch ${Math.round(s.kgOffPct * 100)}% so với số đọc từ tên — xác nhận hoặc sửa`
      : 'barem lệch quá ngưỡng — xác nhận hoặc sửa'
  if (s.clearedUnconfirmed.length)
    return `đổi nhóm sẽ xoá ${s.clearedUnconfirmed.join(', ')} — xác nhận xoá`
  return null
}
