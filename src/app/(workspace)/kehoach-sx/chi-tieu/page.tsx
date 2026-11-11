import { authService } from '@/modules/core/auth/auth.service'
import { targetsService } from '@/modules/dept/production/targets.service'
import { canManagePlan } from '@/modules/dept/production/perms'
import { weekStartIso } from '@/lib/exec-ops'
import { vnTodayIso } from '@/lib/local-date'
import { ChiTieuScreen } from './ChiTieuScreen'

export const dynamic = 'force-dynamic'

const ISO = /^\d{4}-\d{2}-\d{2}$/

/**
 * CHỈ TIÊU NGÀY (0168) theo TUẦN — dựng lại KHÔNG kit 11/11/2026 (bản vẽ
 * https://claude.ai/artifact/Y5UN1RKu11M9aMHW1hdCL1). `?tuan=` là một ngày bất
 * kỳ trong tuần muốn xem (`?date=` của màn cũ vẫn hiểu); không có → tuần này.
 */
export default async function TargetsPage({
  searchParams,
}: {
  searchParams: Promise<{ tuan?: string; date?: string }>
}) {
  const [{ tuan, date }, user] = await Promise.all([
    searchParams,
    authService.requirePageUser(),
  ])
  const anchor = ISO.test(tuan ?? '')
    ? tuan!
    : ISO.test(date ?? '')
      ? date!
      : vnTodayIso()
  const [week, canEdit] = await Promise.all([
    targetsService.getWeek(user, weekStartIso(anchor)),
    canManagePlan(user),
  ])
  return <ChiTieuScreen week={week} canEdit={canEdit} />
}
