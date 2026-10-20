import { todayVn } from '@/lib/date-vn'
import { kyCuaThang, thangCuaNgay } from '@/lib/cham-cong/ky-gio-cong'
import { MotNguoiScreen } from '../../mot-nguoi'

/**
 * CHẤM CÔNG › MỘT NGƯỜI — link gửi được (`/hr/cham-cong/nguoi/604?thang=2026-10`).
 * `thang` là KỲ công (kỳ 10 = 26/09 → 25/10, cùng kỳ với Bảng công), mặc định kỳ chứa
 * hôm nay. Dữ liệu tải ở client theo khoảng người xem chọn; trang chỉ đặt kỳ mặc định.
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
  const thang =
    sp.thang && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.thang) ? sp.thang : thangCuaNgay(homNay)
  return (
    <MotNguoiScreen ky={{ thang, ...kyCuaThang(thang), homNay }} ma={decodeURIComponent(ma)} />
  )
}
