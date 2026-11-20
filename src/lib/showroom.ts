/**
 * Khu mẫu trong showroom (0304, phiếu 101026 PKD). Chủ dự án 20/11/2026: chỉ cần
 * KHU, không cần dãy kệ ("quy mô nhỏ"). Một danh sách cho Excel thư viện SP, thẻ
 * treo và ô chọn trên hồ sơ SP — khớp ràng buộc `technical_products_showroom_zone_check`.
 */
export const SHOWROOM_ZONES = ['A1', 'A2', 'B1', 'B2', 'C', 'K1', 'K2'] as const
export type ShowroomZone = (typeof SHOWROOM_ZONES)[number]

export const isShowroomZone = (v: unknown): v is ShowroomZone =>
  typeof v === 'string' && (SHOWROOM_ZONES as readonly string[]).includes(v)
