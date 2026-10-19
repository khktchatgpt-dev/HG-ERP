/**
 * NHÓM VẬT TƯ CHO MÃ TỰ CẤP từ dòng tự gõ của đơn mua (19/10/2026).
 *
 * Dòng tự gõ chỉ có ở mẫu gỗ nhưng không phải dòng nào cũng là gỗ: đơn gia
 * công An Khánh (PO-2026-0136) đặt bộ nệm và vải mái che — cấp mã vào nhóm Gỗ
 * là xếp sai chỗ, Kho tìm không ra. Đoán theo TỪ trong tên, từ khoá nệm đứng
 * trước vải vì "Bộ nệm … (không vải mái che)" là nệm. Không khớp gì thì Gỗ.
 */
export const NHOM_GO = 'Gỗ - ván - chi tiết gỗ mua ngoài'
export const NHOM_NEM = 'Mút - xốp - nệm - gòn'
export const NHOM_VAI = 'Vải - da - chỉ - phụ liệu may'
export const NHOM_MAY = 'Dây mây - vật liệu đan'

const LUAT: [RegExp, string][] = [
  [/(?<![\p{L}])(nệm|đệm|mút|xốp|gòn|gối)(?![\p{L}])/u, NHOM_NEM],
  [/(?<![\p{L}])(mây|đan|cói|lục bình)(?![\p{L}])/u, NHOM_MAY],
  [/(?<![\p{L}])(vải|da|chỉ|bạt|dù)(?![\p{L}])/u, NHOM_VAI],
]

export function nhomChoDongTuGo(name: string): string {
  const s = name.normalize('NFC').toLowerCase()
  return LUAT.find(([re]) => re.test(s))?.[1] ?? NHOM_GO
}
