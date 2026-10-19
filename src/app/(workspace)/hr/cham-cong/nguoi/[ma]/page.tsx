import { todayVn } from '@/lib/date-vn'
import { MotNguoiScreen } from '../../mot-nguoi'
import { chonThang } from '../../ky-cong.shared'

/**
 * CHẤM CÔNG › MỘT NGƯỜI — link gửi được (`/hr/cham-cong/nguoi/604?thang=2026-10`).
 * Dữ liệu tải ở client theo khoảng người xem chọn; trang chỉ đặt kỳ mặc định.
 * Quyền xem đã gác ở layout nhóm Chấm công.
 */
export default async function MotNguoiPage({
  params,
  searchParams,
}: {
  params: Promise<{ ma: string }>
  searchParams: Promise<{ thang?: string }>
}) {
  const [{ ma }, sp] = await Promise.all([params, searchParams])
  const homNay = todayVn()
  const thang = chonThang(sp.thang, homNay)
  const [y, m] = thang.split('-').map(Number)
  const den = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
  return (
    <MotNguoiScreen
      ky={{ thang, tu: `${thang}-01`, den, homNay }}
      ma={decodeURIComponent(ma)}
    />
  )
}
