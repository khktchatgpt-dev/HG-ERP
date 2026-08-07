import { redirect } from 'next/navigation'

/**
 * Trang cũ — thư viện SP giờ ở khu DÙNG CHUNG `/products` (mọi phòng xem được).
 * Giữ redirect để link/bookmark cũ vẫn hoạt động.
 */
export default function LegacyTechProductsPage() {
  redirect('/products')
}
