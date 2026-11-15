/**
 * SỐ TRONG Ô LƯỚI NHẬP LIỆU — một luật cho cả GÕ TAY lẫn DÁN (15/11/2026).
 *
 * Bảng chi tiết từng đọc hai kiểu: gõ "1.390" ra 1,39 (dấu chấm thập phân), dán
 * chính chuỗi đó ra 1390 (po-paste). Ô Dài cắt gõ "1.390" là lưu 1,39 mm không
 * một lời báo. Luật Việt, không đoán:
 *  - Dấu PHẨY là thập phân: "1,25" = 1,25 · "1,125" = 1,125 (ĐM kg ba số lẻ).
 *  - Dấu CHẤM trước đúng 3 chữ số là nhóm nghìn: "1.390" = 1390, "1.390,5".
 *    Ngoại lệ phần nguyên chỉ là 0: "0.525" = 0,525.
 *  - Dấu chấm không theo nhóm 3 là thập phân (thói quen gõ máy): "2.5", "1.25".
 *  - Kiểu Anh chỉ nhận khi không thể hiểu khác: "1,390.5", "1,234,567".
 *  - Còn lại (chữ, "1,2,3", "1.2.3") → KHÔNG đọc được: trả null để màn tô đỏ,
 *    không âm thầm thành ô trống.
 * `hienSo` viết ngược lại bằng dấu phẩy, không nhóm nghìn — `docSo(hienSo(x)) === x`
 * nên số đã lưu mở ra rồi lưu lại không bao giờ bị đổi (có test).
 */

/** Chuỗi trong ô → số; null khi trống HOẶC không đọc được (phân biệt bằng `laSoSai`). */
export function docSo(raw: string | null | undefined): number | null {
  const s = (raw ?? '').replace(/[\s ]/g, '')
  if (!s || /[^\d.,-]/.test(s) || !/\d/.test(s)) return null
  let t: string
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s) && !/^-?0\./.test(s)) {
    t = s.replace(/\./g, '').replace(',', '.') // 1.390 · 1.390,5
  } else if (/^-?\d{1,3}(,\d{3})+\.\d+$/.test(s) || /^-?\d{1,3}(,\d{3}){2,}$/.test(s)) {
    t = s.replace(/,/g, '') // 1,390.5 · 1,234,567 (kiểu Anh, không lẫn được)
  } else if (/^-?\d*,\d+$/.test(s)) {
    t = s.replace(',', '.') // 1,25 · ,5
  } else if (/^-?\d*\.?\d+$/.test(s) || /^-?\d+$/.test(s)) {
    t = s // 2.5 · 0.525 · 1390
  } else {
    return null
  }
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/** Ô có chữ mà không đọc ra số — màn phải tô đỏ, không được coi như trống. */
export const laSoSai = (raw: string | null | undefined) =>
  (raw ?? '').trim() !== '' && docSo(raw) == null

/** Số → chuỗi cho ô: phẩy thập phân, không nhóm nghìn (1390 · 1,125 · 0,525). */
export function hienSo(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return ''
  return String(n).replace('.', ',')
}

/** Lúc rời ô: số đọc được thì viết lại chuẩn (gõ "1.390" thấy ngay "1390"); sai giữ nguyên để tô đỏ. */
export function chuanHoaO(raw: string): string {
  if (!raw.trim()) return ''
  const n = docSo(raw)
  return n == null ? raw.trim() : hienSo(n)
}
