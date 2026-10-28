import { authService } from '@/modules/core/auth/auth.service'
import { TraGiaScreen } from './TraGiaScreen'

export const metadata = { title: 'Mua hàng · Tra giá vật tư' }

/**
 * TRA GIÁ VẬT TƯ (28/10/2026) — dán / gõ danh sách món sắp mua, ra NCC từng
 * bán + giá + ai rẻ nhất, chọn NCC rồi (bước sau) xuất Excel bảng so sánh.
 *
 * Trang không nạp gì ở server: danh sách là nháp trên máy người mua, giá tra qua
 * `POST /api/dept/supply/tra-gia` (gác quyền cùng luật với layout của khu).
 */
export default async function Page() {
  const user = await authService.requirePageUser()
  return <TraGiaScreen meId={user.id} />
}
