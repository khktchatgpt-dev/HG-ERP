/**
 * CÁCH GIAO của một đơn mua — suy từ câu "Địa điểm giao hàng" đang có trên đơn
 * (01/10/2026, bước 1 của đợt giao nhận + phí vận chuyển).
 *
 * Đo 97 đơn: hàng về xưởng Gia Lai theo bốn đường, và mỗi đường một kiểu việc:
 *   xuong      NCC chở tận xưởng — cước NCC chịu, Kho nhận thẳng (52 đơn)
 *   chanh      NCC gửi chành xe ở TP.HCM, chành chở ra — HG trả cước (7 đơn)
 *   tu_lay     "Tại kho bên bán" — HG thuê xe đi lấy (4 đơn)
 *   nhap_khau  cảng đi / cảng đến, CIF… (2 đơn)
 * và 32 đơn để trống → `null` ("chưa ghi"), KHÔNG đoán là tận xưởng.
 *
 * Thuần, không chạm DB: màn "Đang về" và mọi chỗ sau này (ô chọn Cách giao,
 * chuyến hàng) dùng chung một hàm, nên một đơn không thể mang hai nhãn.
 * Câu được ghi rất lệch nhau ("Nhà xe Hùng vịnh…", "Chành xe hùng vịnh…") —
 * so bằng chữ bỏ dấu, thường hoá.
 */

export type CachGiao = 'xuong' | 'chanh' | 'tu_lay' | 'nhap_khau'

export const CACH_GIAO_LABEL: Record<CachGiao, string> = {
  xuong: 'Tận xưởng',
  chanh: 'Gửi chành',
  tu_lay: 'HG tự lấy',
  nhap_khau: 'Nhập khẩu',
}

/** Bỏ dấu tiếng Việt + thường hoá (đ → d). */
function bo(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
}

export function cachGiao(place: string | null | undefined): CachGiao | null {
  const t = bo(place ?? '').trim()
  if (!t) return null
  // Thứ tự có chủ ý: "cảng" đứng trước vì câu nhập khẩu có thể nhắc cả "kho".
  if (/\b(cang|cif|fob|incoterm)\b/.test(t)) return 'nhap_khau'
  if (/\b(chanh|nha xe|bai xe|gui xe)\b/.test(t)) return 'chanh'
  if (/kho ben ban|tai kho (ncc|nha cung cap)|ben mua (tu )?(den )?lay|tu lay/.test(t))
    return 'tu_lay'
  return 'xuong'
}

/**
 * Tên chành / nhà xe rút từ câu nơi giao, cho cột Cách giao ("Gửi chành · Hùng
 * Vịnh"). Lấy phần sau chữ "chành"/"nhà xe" tới dấu phẩy đầu tiên, giữ chữ hoa
 * như người gõ nhưng viết hoa chữ đầu mỗi từ để ba cách ghi hiện như nhau.
 */
export function tenChanh(place: string | null | undefined): string | null {
  if (cachGiao(place) !== 'chanh') return null
  const m = (place ?? '').match(/(?:chành xe|chành|nhà xe|bãi xe)\s+([^,.;]+)/i)
  const ten = m?.[1]?.trim()
  if (!ten) return null
  return ten
    .split(/\s+/)
    .map((w) => w.charAt(0).toLocaleUpperCase('vi') + w.slice(1).toLocaleLowerCase('vi'))
    .join(' ')
}
