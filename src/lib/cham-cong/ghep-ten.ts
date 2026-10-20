/**
 * GHÉP MÃ TRÊN MÁY ↔ NHÂN VIÊN — hàm thuần, không chạm DB.
 *
 * Đo 15/10/2026 trên 2.017 mã của hai máy: tên máy chỉ là 2 CHỮ CUỐI họ tên
 * ("Trương Văn Hùng" → "VĂN HÙNG"), máy .203 có dấu, .201 không dấu, có khi viết
 * tắt chữ đầu ("D KHUONG"). Nên so "tên máy có phải ĐUÔI của họ tên không", bỏ dấu.
 */

/** Bỏ dấu, viết hoa, gọn khoảng trắng — để so tên máy (.201 không dấu) với họ tên. */
export function khongDau(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Tên trên máy có khớp phần cuối họ tên không. Mỗi chữ của tên máy so với chữ cùng
 * vị trí tính từ cuối; chữ 1 ký tự là chữ viết tắt (khớp chữ đầu).
 * khopDuoiTen('Phạm Văn Trọn', 'VAN TRON') === true
 */
export function khopDuoiTen(hoTen: string, tenMay: string | null | undefined): boolean {
  const a = khongDau(hoTen).split(' ').filter(Boolean)
  const b = khongDau(tenMay).split(' ').filter(Boolean)
  if (!b.length || b.length > a.length) return false
  const lech = a.length - b.length
  return b.every((t, i) =>
    t.length === 1 ? a[lech + i].startsWith(t) : a[lech + i] === t,
  )
}

/** Mã NV trong sổ tay hay có số 0 đầu ("00604"); mã trên máy thì không ("604"). */
export const boSo0 = (ma: string) => ma.trim().replace(/^0+(?=\d)/, '')
