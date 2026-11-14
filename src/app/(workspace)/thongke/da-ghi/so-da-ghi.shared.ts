/** Định dạng dùng chung của Sổ đã ghi (màn + lưới). */
export { cx, dm, dmy, fmt, gio } from '../ngay/so-ngay.shared'

/** Số trong ô gõ: "1.080", "2,5" — parseSo đọc lại đúng kiểu này. */
export const fmtIn = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 4 })

/** Kg một số lẻ. */
export const kgTxt = (n: number) =>
  n.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

const THU_DAI = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']
export const thuDai = (iso: string) => THU_DAI[new Date(`${iso}T00:00:00Z`).getUTCDay()]
