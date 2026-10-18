import { authService } from '@/modules/core/auth/auth.service'
import { bangLuongService } from '@/modules/dept/hr/luong/bang-luong.service'
import { thangCuaNgay } from '@/lib/cham-cong/ky-gio-cong'
import { todayVn } from '@/lib/date-vn'
import { BangLuongScreen } from './BangLuongScreen'
import { MUC_BL, type MucBl } from './bang-luong.shared'

export const metadata = { title: 'Bảng lương' }

/** Bảng lương theo kỳ (B5). `?thang=YYYY-MM` — mặc định kỳ đang mở. */
export default async function BangLuongPage({
  searchParams,
}: {
  searchParams: Promise<{ thang?: string; muc?: string }>
}) {
  const user = await authService.requirePageUser()
  const sp = await searchParams
  const thang =
    sp.thang && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.thang)
      ? sp.thang
      : thangCuaNgay(todayVn())
  const b = await bangLuongService.trang(user, thang)
  const muc: MucBl = (MUC_BL as readonly string[]).includes(sp.muc ?? '')
    ? (sp.muc as MucBl)
    : 'bang'
  return (
    <BangLuongScreen
      key={`${b.thang}|${b.bang?.trangThai ?? '-'}|${b.bang?.lanTinh ?? 0}`}
      b={b}
      muc={muc}
    />
  )
}
