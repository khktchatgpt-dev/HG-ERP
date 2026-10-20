/**
 * ĐVT CỦA DÒNG ĐÃ LÀ KG (10/10/2026). Mẫu nhôm / sắt-inox tính tiền theo kg qua
 * kg/m × dài cây hoặc kg/đơn vị — nhưng có vật tư bán THẲNG theo kg (NHO0090
 * "Nhôm 20x40", ĐVT Kg). Dòng đó: SL đặt chính là số kg, không cần barem; trước
 * đây bị chặn lưu vì "thiếu kg/m" và rơi khỏi dòng "Tổng số KG" trên phiếu.
 */
export function laDvtKg(unit: string | null | undefined): boolean {
  const u = (unit ?? '').trim().toLowerCase()
  return u === 'kg' || u === 'kgs' || u === 'kí' || u === 'ký' || u === 'kilogram'
}
