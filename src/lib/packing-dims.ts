/**
 * MỘT quy tắc duy nhất để lấy kích thước SẢN PHẨM cho mọi chứng từ bán hàng
 * (báo giá, đơn hàng, bản in).
 *
 * Vì sao cần: dài×rộng×cao của một sản phẩm đang nằm ở HAI nơi, hai đơn vị —
 *   • `packing.l_cm / w_cm / h_cm`  (cm, người gõ tay)
 *   • `length_mm / width_mm / height_mm` (mm, bộ trích từ file BOM ghi)
 * Đo trên dữ liệu thật 10/08/2026: **12/593 SP có bộ cm, 353/593 có bộ mm**. Chỗ
 * nào chỉ đọc `packing` thì coi như mù với 341 SP đã có số đầy đủ — tờ báo giá in
 * ra trống chỗ kích thước dù hồ sơ đã khai đủ.
 *
 * Quy tắc: **số gõ tay luôn thắng**, thiếu mới quy từ mm sang cm. Giá trị bù chỉ
 * để HIỆN / IN, không ghi ngược vào `packing` — hồ sơ vẫn một nguồn.
 *
 * ⚠️ Đây là bản VÁ HIỂN THỊ, chưa phải bản hợp nhất. Hai bộ số vẫn tồn tại song
 * song và 3/4 SP có cả hai đang lệch nhau (hoán vị trục / số đo khác nhau) — xem
 * `docs/bao-gia-upload-excel-plan.md` §2, cần chủ dự án chốt trục rồi mới gộp
 * được về một bộ.
 */

export type DimsCm = {
  l_cm?: number
  w_cm?: number
  h_cm?: number
}

export type DimsMm = {
  length_mm: number | null
  width_mm: number | null
  height_mm: number | null
}

/** mm → cm, làm tròn 2 số lẻ (700mm → 70, 555mm → 55.5). */
export const mmToCm = (mm: number | null | undefined): number | undefined =>
  mm != null ? Math.round((mm / 10) * 100) / 100 : undefined

/**
 * Trộn kích thước mm vào bộ `packing` để chứng từ hiện đủ ba chiều.
 * Chỉ đụng 3 ô kích thước SP; mọi ô đóng gói (carton, NW/GW, loading) giữ nguyên.
 */
export function packingWithDims<T extends object>(pk: T, p: DimsMm): T & DimsCm {
  const cm = pk as DimsCm
  return {
    ...pk,
    l_cm: cm.l_cm ?? mmToCm(p.length_mm),
    w_cm: cm.w_cm ?? mmToCm(p.width_mm),
    h_cm: cm.h_cm ?? mmToCm(p.height_mm),
  }
}

/** Chuỗi "68 × 62 × 99" (cm) — null khi thiếu bất kỳ chiều nào. */
export function dimsText(pk: DimsCm): string | null {
  return pk.l_cm != null && pk.w_cm != null && pk.h_cm != null
    ? `${pk.l_cm} × ${pk.w_cm} × ${pk.h_cm}`
    : null
}
