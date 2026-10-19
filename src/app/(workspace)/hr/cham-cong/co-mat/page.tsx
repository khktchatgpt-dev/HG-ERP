import { authService } from '@/modules/core/auth/auth.service'
import { chamCongService } from '@/modules/dept/hr/cham-cong/cham-cong.service'
import { todayVn } from '@/lib/date-vn'
import { CoMatScreen } from '../co-mat-screen'
import { chonThang } from '../ky-cong.shared'

/** CHẤM CÔNG › CÓ MẶT THEO TỔ — tổ × ngày, số người có ít nhất 1 lượt quẹt. */
export default async function CoMatPage({
  searchParams,
}: {
  searchParams: Promise<{ thang?: string }>
}) {
  const sp = await searchParams
  const user = await authService.requirePageUser()
  const homNay = todayVn()
  const k = await chamCongService.kyCong(user, chonThang(sp.thang, homNay), homNay)
  return <CoMatScreen k={k} />
}
