import { authService } from '@/modules/core/auth/auth.service'
import { assetsService } from '@/modules/core/assets/assets.service'
import { HomeScreen } from './HomeScreen'

export const metadata = { title: 'Máy móc · Trang đầu' }

export default async function Page({
  searchParams,
}: {
  /** `?xem=hom-nay|tong-quan` — bản trang đầu người xem chọn lần trước. */
  searchParams: Promise<{ xem?: string }>
}) {
  const user = await authService.requirePageUser()
  const [{ xem }, d] = await Promise.all([searchParams, assetsService.home(user)])
  // Mặc định như demo MOCA: ai duyệt mà không sửa (Giám đốc) vào "Tổng quan",
  // còn lại (Tổ Cơ điện, người báo hỏng) vào "Việc hôm nay".
  const fallback = d.meta.can_approve && !d.meta.can_work ? 'tong-quan' : 'hom-nay'
  const view = xem === 'tong-quan' || xem === 'hom-nay' ? xem : fallback
  return <HomeScreen d={d} initialView={view} />
}
