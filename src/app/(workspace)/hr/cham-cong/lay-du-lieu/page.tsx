import { authService } from '@/modules/core/auth/auth.service'
import { chamCongService } from '@/modules/dept/hr/cham-cong/cham-cong.service'
import { todayVn } from '@/lib/date-vn'
import { LayDuLieuScreen } from '../lay-du-lieu'
import { chonThang } from '../ky-cong.shared'

/** CHẤM CÔNG › LẤY DỮ LIỆU TỪ MÁY — khoảng lấy, dải ngày, tình trạng máy, lịch sử lấy. */
export default async function LayDuLieuPage({
  searchParams,
}: {
  searchParams: Promise<{ thang?: string }>
}) {
  const sp = await searchParams
  const user = await authService.requirePageUser()
  const homNay = todayVn()
  const k = await chamCongService.kyCong(user, chonThang(sp.thang, homNay), homNay)
  return <LayDuLieuScreen k={k} />
}
