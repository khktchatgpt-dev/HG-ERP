import { notFound } from 'next/navigation'
import { fileImageSrcMap } from '@/server/file-image'
import { authService } from '@/modules/core/auth/auth.service'
import { buildLsxSupplyDetail } from '@/modules/dept/supply/lsx-supply.service'
import { todayVn } from '@/lib/date-vn'
import { HoSoLenhScreen } from './HoSoLenhScreen'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await authService.requirePageUser()
  const d = await buildLsxSupplyDetail(user, id, todayVn()).catch(() => null)
  return { title: d ? `Mua hàng · Hồ sơ ${d.code}` : 'Mua hàng · Hồ sơ lệnh' }
}

/**
 * HỒ SƠ LỆNH trong khu Mua hàng (16/09/2026 — chủ dự án: "cung ứng chưa có
 * trang để xem thông tin lệnh sản xuất, không dùng trang của sales").
 *
 * Cùng `buildLsxSupplyDetail` với màn vật tư của lệnh — không service mới, nên
 * hai màn không thể nói khác nhau về cùng một lệnh. Quyền vào đã do layout khu
 * gác (`canEnterWorkspace(user, 'planning')`), và service tự chặn theo phòng.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await authService.requirePageUser()
  const today = todayVn()
  const detail = await buildLsxSupplyDetail(user, id, today)
  if (!detail) notFound()
  // Đường dẫn ảnh CỐ ĐỊNH theo id (HMAC), không phải URL ký đổi mỗi lượt
  // render — xem ghi chú ở màn vật tư của lệnh.
  const imageUrls = fileImageSrcMap(detail.products.map((p) => p.image_file_id))
  return <HoSoLenhScreen lsx={detail} today={today} imageUrls={imageUrls} />
}
