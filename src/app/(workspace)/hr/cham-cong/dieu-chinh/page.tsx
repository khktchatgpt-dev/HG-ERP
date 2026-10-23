import { authService } from '@/modules/core/auth/auth.service'
import { dieuChinhService } from '@/modules/dept/hr/cham-cong/dieu-chinh.service'
import { todayVn } from '@/lib/date-vn'
import { DieuChinhScreen } from '../dieu-chinh-screen'
import { khoangKyService } from '@/modules/dept/hr/cham-cong/khoang-ky.service'

/** CHẤM CÔNG › ĐIỀU CHỈNH CÔNG — chờ duyệt (mọi kỳ) + lịch sử điều chỉnh trong kỳ. */
export default async function DieuChinhPage({
  searchParams,
}: {
  searchParams: Promise<{ thang?: string; xem?: string }>
}) {
  const sp = await searchParams
  const user = await authService.requirePageUser()
  const thang = await khoangKyService.chon(sp.thang, todayVn())
  // Lịch sử lọc theo KHOẢNG KỲ Nhân sự đã đặt (25→25), không theo tháng dương lịch.
  const k = await khoangKyService.cua(thang)
  const [d, dsKy] = await Promise.all([
    dieuChinhService.trang(user, k.tu, k.den),
    khoangKyService.ds(),
  ])
  return (
    <DieuChinhScreen
      d={d}
      dsKy={dsKy}
      thang={thang}
      xem={sp.xem === 'thang' ? 'thang' : 'cho'}
    />
  )
}
