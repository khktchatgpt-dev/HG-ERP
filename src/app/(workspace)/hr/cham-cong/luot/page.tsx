import { authService } from '@/modules/core/auth/auth.service'
import { chamCongService } from '@/modules/dept/hr/cham-cong/cham-cong.service'
import { todayVn } from '@/lib/date-vn'
import { LuotQuetScreen } from '../luot-quet'
import { khoangKyService } from '@/modules/dept/hr/cham-cong/khoang-ky.service'

/**
 * CHẤM CÔNG › LƯỢT QUẸT — mỗi dòng một người một ngày, đủ mọi lượt máy ghi.
 * `?ngay=` / `?bo-phan=` đặt sẵn bộ lọc (mở từ Có mặt theo tổ).
 */
export default async function LuotPage({
  searchParams,
}: {
  searchParams: Promise<{ thang?: string; ngay?: string; 'bo-phan'?: string }>
}) {
  const sp = await searchParams
  const user = await authService.requirePageUser()
  const homNay = todayVn()
  const thang = await khoangKyService.chon(sp.thang, homNay)
  const [k, kyXuat] = await Promise.all([
    chamCongService.kyCong(user, thang, homNay),
    khoangKyService.cua(thang),
  ])
  const ngay = sp.ngay && /^\d{4}-\d{2}-\d{2}$/.test(sp.ngay) ? sp.ngay : ''
  return (
    <LuotQuetScreen
      key={`${ngay}|${sp['bo-phan'] ?? ''}`}
      k={k}
      kyXuat={{ tu: kyXuat.tu, den: kyXuat.den }}
      ngayDau={ngay}
      boPhanDau={sp['bo-phan'] ?? ''}
    />
  )
}
