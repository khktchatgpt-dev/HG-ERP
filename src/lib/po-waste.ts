import { normUnit } from './bom-unit'

/**
 * HAO HỤT KHI ĐẶT MUA — cột "SL Đặt hàng hh 3%" có trong 12/12 mẫu đơn giấy
 * của phòng Cung ứng (đọc từ 4 file sổ ngày 07/09/2026).
 *
 * Vì sao 3%: cắt hụt, hàng lỗi, mất vặt ở xưởng. Phòng đặt dư một ít thay vì
 * phải mở đơn bổ sung cho vài cây thép — mở đơn tốn nhiều hơn phần dư.
 */
export const HAO_HUT_MAC_DINH = 3

/**
 * Đơn vị KHÔNG CHIA NHỎ ĐƯỢC: mua 296,4 cây thép hay 0,7 cái bản lề là vô
 * nghĩa — nhà cung cấp giao số nguyên. Các đơn vị đo lường (kg, m, m², lít)
 * thì chia nhỏ được nên chỉ làm tròn lẻ.
 */
const DON_VI_NGUYEN = new Set([
  'cai',
  'con',
  'chiec',
  'pc',
  'pcs',
  'cay',
  'thanh',
  'ong',
  'bar',
  'tam',
  'bo',
  'to',
  'cuon',
  'thung',
  'hop',
  'bich',
  'can',
  'chai',
  'vien',
  'soi',
  'doi',
  'cap',
])

/**
 * SỐ ĐẶT = số còn phải đặt + hao hụt, LÀM TRÒN LÊN.
 *
 * Luôn làm tròn LÊN chứ không tròn gần nhất: tròn xuống là thiếu, mà thiếu thì
 * phải mở thêm một đơn — đúng cái việc mà cộng hao hụt sinh ra để tránh.
 *
 * `pct` là phần trăm (3 = 3%). 0 hoặc âm coi như không cộng hao hụt, nhưng VẪN
 * làm tròn lên theo đơn vị: 287,81 cây thì vẫn phải đặt 288 cây.
 */
export function slDatHang(qty: number, pct: number, unit: string | null): number {
  if (!Number.isFinite(qty) || qty <= 0) return 0
  const he = Number.isFinite(pct) && pct > 0 ? 1 + pct / 100 : 1
  const raw = qty * he
  if (DON_VI_NGUYEN.has(normUnit(unit))) return Math.ceil(raw - 1e-9)
  // Đơn vị đo lường: giữ hai số lẻ, vẫn tròn LÊN.
  return Math.ceil(raw * 100 - 1e-9) / 100
}
