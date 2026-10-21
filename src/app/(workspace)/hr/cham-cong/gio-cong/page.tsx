import { authService } from '@/modules/core/auth/auth.service'
import { gioCongService } from '@/modules/dept/hr/cham-cong/gio-cong.service'
import { khoangKyService } from '@/modules/dept/hr/cham-cong/khoang-ky.service'
import { todayVn } from '@/lib/date-vn'
import { GioCongScreen } from './GioCongScreen'

/**
 * CHẤM CÔNG › BẢNG GIỜ CÔNG — `?thang=YYYY-MM` chọn kỳ (26 tháng trước → 25 tháng này;
 * mặc định kỳ chứa hôm nay), `?bp=` chọn bộ phận / 'vp' / 'all' (link gửi được).
 */
export default async function GioCongPage({
  searchParams,
}: {
  searchParams: Promise<{ thang?: string; bp?: string }>
}) {
  const sp = await searchParams
  const user = await authService.requirePageUser()
  const homNay = todayVn()
  const thang =
    sp.thang && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.thang) ? sp.thang : await khoangKyService.thangCua(homNay)
  const b = await gioCongService.bang(user, thang, homNay)
  return <GioCongScreen key={`${thang}|${sp.bp ?? ''}`} b={b} bpDau={sp.bp} />
}
