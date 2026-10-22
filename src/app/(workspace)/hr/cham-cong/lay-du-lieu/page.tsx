import { authService } from '@/modules/core/auth/auth.service'
import { khoangKyService } from '@/modules/dept/hr/cham-cong/khoang-ky.service'
import { chamCongService } from '@/modules/dept/hr/cham-cong/cham-cong.service'
import { todayVn } from '@/lib/date-vn'
import { LayDuLieuScreen } from '../lay-du-lieu'

/** CHẤM CÔNG › LẤY DỮ LIỆU TỪ MÁY — khoảng lấy, dải ngày, tình trạng máy, lịch sử lấy. */
export default async function LayDuLieuPage({
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
  return <LayDuLieuScreen k={k} />
}
