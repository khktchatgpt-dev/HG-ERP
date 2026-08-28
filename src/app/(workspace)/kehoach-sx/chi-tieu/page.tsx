import { authService } from '@/modules/core/auth/auth.service'
import { targetsService } from '@/modules/dept/production/targets.service'
import { canManagePlan } from '@/modules/dept/production/perms'
import { TargetsGrid } from './TargetsGrid'

export const dynamic = 'force-dynamic'

/**
 * CHỈ TIÊU NGÀY (GĐ 2.2 — 0168): Kế hoạch giao chỉ tiêu per tổ × công đoạn.
 * Ô trống = không giao → Toàn cảnh dùng số SUY từ lộ trình; ô 0 = chỉ tiêu
 * thật ("hôm nay tổ này làm việc khác").
 */
export default async function TargetsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const user = await authService.requirePageUser()
  const sp = await searchParams
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? '')
    ? sp.date!
    : new Date().toISOString().slice(0, 10)
  const [data, canEdit] = await Promise.all([
    targetsService.getDay(user, date),
    canManagePlan(user),
  ])
  return (
    <TargetsGrid
      date={data.date}
      teams={data.teams}
      stages={data.stages}
      targets={data.targets}
      canEdit={canEdit}
    />
  )
}
