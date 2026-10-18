import { authService } from '@/modules/core/auth/auth.service'
import { hoSoLuongService } from '@/modules/dept/hr/luong/ho-so-luong.service'
import { HoSoLuongScreen } from './HoSoLuongScreen'

export const metadata = { title: 'Hồ sơ lương' }

/** Hồ sơ lương (B4) — `?thang=YYYY-MM`: kỳ để xem bản đang hiệu lực (mặc định kỳ đang mở). */
export default async function HoSoLuongPage({
  searchParams,
}: {
  searchParams: Promise<{ thang?: string }>
}) {
  const user = await authService.requirePageUser()
  const sp = await searchParams
  const thang =
    sp.thang && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.thang) ? sp.thang : undefined
  const h = await hoSoLuongService.trang(user, thang)
  return <HoSoLuongScreen key={h.thang} h={h} />
}
