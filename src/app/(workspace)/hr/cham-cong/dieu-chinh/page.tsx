import { authService } from '@/modules/core/auth/auth.service'
import { dieuChinhService } from '@/modules/dept/hr/cham-cong/dieu-chinh.service'
import { todayVn } from '@/lib/date-vn'
import { DieuChinhScreen } from '../dieu-chinh-screen'
import { chonThang } from '../ky-cong.shared'
import { khoangKyService } from '@/modules/dept/hr/cham-cong/khoang-ky.service'

/** CHẤM CÔNG › ĐIỀU CHỈNH CÔNG — chờ duyệt (mọi kỳ) + lịch sử điều chỉnh trong tháng. */
export default async function DieuChinhPage({
  searchParams,
}: {
  searchParams: Promise<{ thang?: string; xem?: string }>
}) {
  const sp = await searchParams
  const user = await authService.requirePageUser()
  const thang = chonThang(sp.thang, todayVn())
  const [y, m] = thang.split('-').map(Number)
  const den = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
  const [d, dsKy] = await Promise.all([
    dieuChinhService.trang(user, `${thang}-01`, den),
    khoangKyService.ds(),
  ])
  return (
    <DieuChinhScreen d={d} dsKy={dsKy} thang={thang} xem={sp.xem === 'thang' ? 'thang' : 'cho'} />
  )
}
