import { authService } from '@/modules/core/auth/auth.service'
import { kyCongService } from '@/modules/dept/hr/cham-cong/ky-cong.service'
import { khoangKyService } from '@/modules/dept/hr/cham-cong/khoang-ky.service'
import { todayVn } from '@/lib/date-vn'
import { KyCongScreen } from './KyCongScreen'
import { MUC_KY, type MucKy } from './ky.shared'

/** Kỳ công (B3): tổ xác nhận, chốt kỳ, mở lại. `?thang=YYYY-MM` — mặc định kỳ đang mở. */
export default async function KyCongPage({
  searchParams,
}: {
  searchParams: Promise<{ thang?: string; muc?: string }>
}) {
  const user = await authService.requirePageUser()
  const sp = await searchParams
  const thang =
    sp.thang && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.thang)
      ? sp.thang
      : await khoangKyService.thangCua(todayVn())
  const k = await kyCongService.trang(user, thang)
  const muc: MucKy = (MUC_KY as readonly string[]).includes(sp.muc ?? '')
    ? (sp.muc as MucKy)
    : 'theo-to'
  // key: đổi kỳ / trạng thái → dựng lại màn (tổ đang chọn, hộp đang mở thuộc kỳ cũ).
  return (
    <KyCongScreen
      key={`${k.thang}|${k.trangThai}|${k.ky?.lanChot ?? 0}`}
      k={k}
      muc={muc}
    />
  )
}
