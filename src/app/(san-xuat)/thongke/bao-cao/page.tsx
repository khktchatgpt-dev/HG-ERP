import { authService } from '@/modules/core/auth/auth.service'
import { baoCaoService } from '@/modules/dept/production/bao-cao.service'
import { shiftIso, vnTodayIso } from '@/lib/local-date'
import { BaoCaoScreen } from './BaoCaoScreen'
import type { TabKey } from './bao-cao.shared'

export const metadata = { title: 'Sản xuất · Báo cáo' }
export const dynamic = 'force-dynamic'

const ISO = /^\d{4}-\d{2}-\d{2}$/

/**
 * BÁO CÁO SẢN XUẤT (B6, S6). Kỳ mặc định = 7 ngày tới hôm nay; `?from&to&team&tab`
 * trên URL. Đọc: mọi NV vào được khu Sản xuất (cùng tư thế các màn thống kê).
 */
export default async function BaoCaoPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; team?: string; tab?: string }>
}) {
  const user = await authService.requirePageUser()
  const sp = await searchParams
  const today = vnTodayIso()
  const to = sp.to && ISO.test(sp.to) ? sp.to : today
  const from = sp.from && ISO.test(sp.from) ? sp.from : shiftIso(to, -6)
  const data = await baoCaoService.get(user, { from, to, team: sp.team || undefined })
  return <BaoCaoScreen data={data} initialTab={(sp.tab as TabKey | undefined) ?? null} />
}
