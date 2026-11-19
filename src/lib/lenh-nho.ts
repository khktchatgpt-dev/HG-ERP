/**
 * NHỚ LỆNH ĐANG LÀM của thống kê (Dán sổ / File mẫu): mở lại là ra đúng lệnh vừa dùng, khỏi tìm
 * trong danh sách nhiều lệnh. Lưu bằng cookie (không phải localStorage) để SERVER đọc được và
 * trang dựng sẵn đúng lệnh — không nhấp nháy, không lệch giữa server và trình duyệt.
 */
export const COOKIE_LENH = 'hg_dan_so_lenh'

/** Id lệnh đã nhớ nếu còn nằm trong danh sách đang chạy, không thì lệnh đầu. */
export function lenhBanDau(
  nho: string | null | undefined,
  ids: readonly string[],
): string {
  return nho && ids.includes(nho) ? nho : (ids[0] ?? '')
}

/** Ghi nhớ (chạy ở trình duyệt). Không có cookie thì thôi — màn vẫn chạy. */
export function ghiLenhNho(id: string): void {
  try {
    document.cookie = `${COOKIE_LENH}=${encodeURIComponent(id)}; path=/; max-age=31536000; samesite=lax`
  } catch {
    /* bỏ qua */
  }
}
