/**
 * CHUYỂN THƯ VIỆN SP CŨ → MỚI (20/11/2026). Chủ dự án: "nhấn xem chi tiết một SP
 * lại dẫn vào giao diện sản phẩm cũ". Hàng chục chỗ (đơn hàng, LSX, mua hàng,
 * tìm kiếm, QR thẻ treo ĐÃ IN) còn trỏ `/products/<id>[/<tab>]` — đổi từng link
 * vẫn sót, nên `proxy.ts` đổi hướng TẤT CẢ ở một chỗ, theo hàm thuần này.
 *
 *   /products                       → /thu-vien (?customer= → ?kh=, ?showroom=)
 *   /products/new                   → /thu-vien
 *   /products/<id>                  → /thu-vien/<id>
 *   /products/<id>/<tab>            → /thu-vien/<id>?tab=<tab mới>
 *   /technical/products…            → như /products…
 *
 * `?cu=1` giữ nguyên trang cũ — lối thoát cho phần chưa chuyển (đổi / xoá ảnh, lộ
 * trình — bước B5) cho tới khi xoá hẳn thư mục cũ.
 */

/** Tab của trang cũ → tab của hồ sơ mới; `null` = mở hồ sơ ở tab mặc định. */
const TAB: Record<string, string | null> = {
  'dinh-muc': 'dinh-muc',
  'dong-goi': 'dong-goi',
  'tai-lieu': 'tai-lieu',
  'lich-su': 'lich-su',
  'thong-so': null,
  'lo-trinh': null,
}

export const HO_SO_TABS = [
  'dinh-muc',
  'dong-goi',
  'thanh-phan',
  'tai-lieu',
  'lich-su',
] as const
export type HoSoTab = (typeof HO_SO_TABS)[number]
export const isHoSoTab = (v: unknown): v is HoSoTab =>
  typeof v === 'string' && (HO_SO_TABS as readonly string[]).includes(v)

/** Trả đường dẫn mới (kèm query) hoặc `null` nếu không phải trang thư viện cũ. */
export function chuyenThuVienCu(pathname: string, search: string): string | null {
  let path = pathname
  if (path === '/technical/products' || path.startsWith('/technical/products/'))
    path = path.slice('/technical'.length)
  if (path !== '/products' && !path.startsWith('/products/')) return null

  const sp = new URLSearchParams(search)
  if (sp.get('cu') === '1') return path === pathname ? null : path + (search || '')

  const parts = path.split('/').filter(Boolean) // ['products', id?, tab?]
  const id = parts[1]
  if (!id || id === 'new') {
    const out = new URLSearchParams()
    const kh = sp.get('customer')
    if (kh) out.set('kh', kh)
    const q = sp.get('q')
    if (q) out.set('q', q)
    const sr = sp.get('showroom')
    if (sr === 'co') out.set('mau', 'co')
    if (sr === 'chua_the') {
      out.set('mau', 'co')
      out.set('the', 'chua')
    }
    const qs = out.toString()
    return qs ? `/thu-vien?${qs}` : '/thu-vien'
  }
  const tab = parts[2] ? (TAB[parts[2]] ?? null) : null
  return tab ? `/thu-vien/${id}?tab=${tab}` : `/thu-vien/${id}`
}
