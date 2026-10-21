import { todayVn } from '@/lib/date-vn'
import { doiThang, khoangKy, thangCua } from '@/lib/cham-cong/khoang-ky'
import { khoangKyService } from '@/modules/dept/hr/cham-cong/khoang-ky.service'
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
  const ds = await khoangKyService.ds()
  const thang =
    sp.thang && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.thang) ? sp.thang : thangCua(homNay, ds)
  const k = khoangKy(thang, ds)
  const truoc = khoangKy(doiThang(thang, -1), ds)
  return (
    <MotNguoiScreen
      ky={{ thang, tu: k.tu, den: k.den, homNay, truoc: { tu: truoc.tu, den: truoc.den } }}
      ma={decodeURIComponent(ma)}
    />
  )
}
