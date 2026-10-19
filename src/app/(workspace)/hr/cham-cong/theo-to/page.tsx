import { authService } from '@/modules/core/auth/auth.service'
import { chamCongService } from '@/modules/dept/hr/cham-cong/cham-cong.service'
import { todayVn } from '@/lib/date-vn'
import { TheoToScreen } from '../theo-to'
import { chonThang } from '../ky-cong.shared'

/** CHẤM CÔNG › BẢNG CHẤM CÔNG THEO TỔ — người × ngày; `?to=` chọn tổ (link gửi được). */
export default async function TheoToPage({
  searchParams,
}: {
  searchParams: Promise<{ thang?: string; to?: string }>
}) {
  const sp = await searchParams
  const user = await authService.requirePageUser()
  const homNay = todayVn()
  const k = await chamCongService.kyCong(user, chonThang(sp.thang, homNay), homNay)
  return <TheoToScreen key={sp.to ?? ''} k={k} toDau={sp.to} />
}
