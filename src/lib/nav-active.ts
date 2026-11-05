/**
 * MỤC MENU ĐANG SÁNG — một luật cho rail desktop (`NavRailLink`) và menu điện
 * thoại (`NavLink`). Thuần, có test.
 *
 * Href có chuỗi truy vấn (B2, 05/11/2026: `/phan-cong-viec?muc=cua-toi` và
 * `?muc=giao` là HAI mục cùng đường dẫn): sáng khi đường dẫn khớp VÀ `muc` trên
 * URL bằng `muc` của mục. URL không mang `muc` (vào từ chuông `?viec=`, hay gõ
 * tay) thì mục đánh dấu `defaultTab` sáng — server đặt cờ này đúng mục mà trang
 * sẽ mở mặc định (có quyền giao → "Việc tôi giao", không → "Việc của tôi"), nên
 * menu và tab trên trang không bao giờ nói hai đằng.
 */
export function navActive(a: {
  pathname: string
  /** `searchParams.get('muc')` hiện tại; null khi không có. */
  muc: string | null
  href: string
  exact?: boolean
  defaultTab?: boolean
}): boolean {
  const q = a.href.indexOf('?')
  if (q >= 0) {
    const path = a.href.slice(0, q)
    const want = new URLSearchParams(a.href.slice(q + 1)).get('muc')
    if (a.pathname !== path && a.pathname !== `${path}/`) return false
    if (a.muc == null) return !!a.defaultTab
    return a.muc === want
  }
  if (a.exact) return a.pathname === a.href || a.pathname === `${a.href}/`
  return a.pathname === a.href || (a.href !== '/' && a.pathname.startsWith(a.href))
}
