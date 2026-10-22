import { authService } from '@/modules/core/auth/auth.service'
import { khoangKyService } from '@/modules/dept/hr/cham-cong/khoang-ky.service'
import { chamCongService } from '@/modules/dept/hr/cham-cong/cham-cong.service'
import { todayVn } from '@/lib/date-vn'
import { CoMatScreen } from '../co-mat-screen'

/** CHẤM CÔNG › CÓ MẶT THEO TỔ — tổ × ngày, số người có ít nhất 1 lượt quẹt. */
export default async function CoMatPage({
  searchParams,
}: {
  searchParams: Promise<{ thang?: string }>
}) {
  const sp = await searchParams
  const user = await authService.requirePageUser()
  const homNay = todayVn()
  const k = await chamCongService.kyCong(
    user,
    await khoangKyService.chon(sp.thang, homNay),
    homNay,
  )
  return <CoMatScreen k={k} />
}
