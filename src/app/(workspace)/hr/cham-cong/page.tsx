import { authService } from '@/modules/core/auth/auth.service'
import { chamCongService } from '@/modules/dept/hr/cham-cong/cham-cong.service'
import { todayVn } from '@/lib/date-vn'
import { KyCongScreen } from './KyCongScreen'
import { BUOC_IDS, type BuocId } from './ky-cong.shared'

/**
 * CHẤM CÔNG = một trang "Kỳ công tháng" (bản vẽ vòng 3, duyệt 12/10/2026).
 * `?thang=YYYY-MM` chọn kỳ (mặc định tháng này), `?buoc=` chọn bước đang mở —
 * gửi link là người nhận mở đúng chỗ.
 */
export default async function ChamCongPage({
  searchParams,
}: {
  searchParams: Promise<{ thang?: string; buoc?: string }>
}) {
  const user = await authService.requirePageUser()
  const sp = await searchParams
  const homNay = todayVn()
  const thang =
    sp.thang && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.thang) ? sp.thang : homNay.slice(0, 7)
  const buoc: BuocId = BUOC_IDS.includes(sp.buoc as BuocId)
    ? (sp.buoc as BuocId)
    : 'du-lieu'
  const k = await chamCongService.kyCong(user, thang, homNay, buoc === 'nhan-vien')
  return <KyCongScreen k={k} buocDau={buoc} />
}
