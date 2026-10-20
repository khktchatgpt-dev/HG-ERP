import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { chamCongService } from '@/modules/dept/hr/cham-cong/cham-cong.service'
import { todayVn } from '@/lib/date-vn'
import { TongQuanScreen } from './tong-quan'
import { chonThang } from './ky-cong.shared'

/** Link cũ của trang một-trang-5-bước (12→17/10/2026) → trang mới tương ứng (câu 19). */
const BUOC_CU: Record<string, string> = {
  'du-lieu': '/hr/cham-cong/luot',
  'nhan-vien': '/hr/nhan-vien',
}

/**
 * CHẤM CÔNG › TỔNG QUAN — cửa ngõ của nhóm Chấm công (tách trang 17/10/2026: menu 3
 * nhóm cha Nhân sự · Chấm công · Tính công; mỗi trang một việc).
 */
export default async function TongQuanPage({
  searchParams,
}: {
  searchParams: Promise<{ thang?: string; buoc?: string }>
}) {
  const sp = await searchParams
  if (sp.buoc) {
    const toi = BUOC_CU[sp.buoc] ?? '/hr/cham-cong'
    redirect(
      sp.thang && toi.startsWith('/hr/cham-cong') ? `${toi}?thang=${sp.thang}` : toi,
    )
  }
  const user = await authService.requirePageUser()
  const homNay = todayVn()
  const k = await chamCongService.kyCong(user, chonThang(sp.thang, homNay), homNay, true)
  return <TongQuanScreen k={k} />
}
