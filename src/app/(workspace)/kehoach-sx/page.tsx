import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { jobsService } from '@/modules/dept/production/jobs.service'
import { componentsService } from '@/modules/dept/production/components.service'
import { canManagePlan, isProductionStaff } from '@/modules/dept/production/perms'
import { vnTodayIso } from '@/lib/local-date'
import { GiaoToDanhSachScreen } from './GiaoToDanhSachScreen'
import { resolveChip, toDsRow } from './danh-sach.shared'

export const dynamic = 'force-dynamic'

/**
 * GIAO TỔ & HẠN — danh sách lệnh (khuôn C), dựng lại KHÔNG kit 11/11/2026
 * theo bản vẽ https://claude.ai/artifact/CAmsvjowophhfMkNmANiu9. Hai nguồn
 * song song: `jobsService.overview` (cùng Lệnh SX / Vào việc) và
 * `componentsService.shapingOverview` (cùng Lộ trình công đoạn) — ghép ở
 * `toDsRow`, chỉ đẩy xuống client thứ màn bày. `?lsx=` (từ cột "Vướng gì" của
 * Lệnh SX) mở thẳng màn một lệnh; `?chip=` mở sẵn một trạng thái.
 */
export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ lsx?: string; chip?: string }>
}) {
  const [{ lsx, chip }, user] = await Promise.all([
    searchParams,
    authService.requirePageUser(),
  ])
  if (lsx) redirect(`/kehoach-sx/${lsx}`)
  // Màn ĐIỀU PHỐI (0086): thành viên xưởng thường không xem — về màn của vai.
  const canEditPlan = await canManagePlan(user)
  if (user.role === 'employee' && !canEditPlan && (await isProductionStaff(user))) {
    redirect('/to')
  }
  const [{ rows, stages }, shaping] = await Promise.all([
    jobsService.overview(user),
    componentsService.shapingOverview(),
  ])
  const shapingById = new Map(shaping.map((s) => [s.lsx.id, s]))
  return (
    <GiaoToDanhSachScreen
      rows={rows.map((r) => toDsRow(r, shapingById.get(r.lsx.id)))}
      stages={stages}
      initialChip={resolveChip(chip)}
      today={vnTodayIso()}
    />
  )
}
