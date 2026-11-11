import { authService } from '@/modules/core/auth/auth.service'
import { entriesService } from '@/modules/dept/production/entries.service'
import { isProductionStaff } from '@/modules/dept/production/perms'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { vnTodayIso } from '@/lib/local-date'
import { SoNgayScreen } from './SoNgayScreen'
import type { DocRow } from './so-ngay.shared'

export const dynamic = 'force-dynamic'

/**
 * SỔ NGÀY & CHỐT SỔ — dựng lại KHÔNG kit 11/11/2026 (bản vẽ
 * https://claude.ai/artifact/QSwyPC46SM81EEQfJiAycT). Một hàng một tổ kỳ vọng
 * ghi sổ (`listDay.teams`), phiếu của ngày gom dưới tổ, chốt sổ / mở khoá tại
 * chỗ (mở khoá bắt lý do — 0295). `?date=` chọn ngày; mặc định hôm nay.
 */
export default async function NgayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const [sp, user] = await Promise.all([searchParams, authService.requirePageUser()])
  const today = vnTodayIso()
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? '') ? (sp.date as string) : today
  const [data, matrix, depts, staff] = await Promise.all([
    entriesService.listDay(user, date),
    entriesService.dayMatrix(user, date, 7),
    departmentsRepo.list(),
    isProductionStaff(user),
  ])
  const teamName = new Map(depts.map((d) => [d.id, d.name]))

  // Σ đạt / phế / sửa per phiếu từ dòng sổ của ngày.
  const sums = new Map<
    string,
    { qty: number; defect: number; rework: number; lines: number }
  >()
  for (const e of data.entries) {
    if (!e.doc_id) continue
    const s = sums.get(e.doc_id) ?? { qty: 0, defect: 0, rework: 0, lines: 0 }
    s.qty += Number(e.qty)
    s.defect += Number(e.defect_qty)
    s.rework += Number(e.rework_qty ?? 0)
    s.lines++
    sums.set(e.doc_id, s)
  }
  const docs: DocRow[] = data.docs.map((x) => {
    const s = sums.get(x.id)
    return {
      id: x.id,
      doc_no: x.doc_no,
      lsx_id: x.production_order_id,
      lsx_code: x.lsx_code,
      stage: x.stage,
      status: x.status,
      team_id: x.team_department_id,
      created_by_name: x.created_by_name,
      created_at: x.created_at,
      total_qty: Math.round((s?.qty ?? 0) * 100) / 100,
      total_defect: Math.round((s?.defect ?? 0) * 100) / 100,
      total_rework: Math.round((s?.rework ?? 0) * 100) / 100,
      line_count: s?.lines ?? 0,
    }
  })

  const canLock = user.role === 'admin' || staff
  const canUnlock = user.role === 'admin' || user.role === 'manager'
  const myTeamId =
    user.department_id && data.teams.some((t) => t.id === user.department_id)
      ? user.department_id
      : null

  return (
    <SoNgayScreen
      date={date}
      today={today}
      teams={data.teams}
      docs={docs}
      locks={data.locks.map((l) => ({
        team_id: l.team_department_id,
        team_name: l.team_name,
        locked_by_name: l.locked_by_name,
        locked_at: l.locked_at,
      }))}
      unlocks={data.unlocks}
      unlockedPast={data.unlocked_past.map((u) => ({
        entry_date: u.entry_date,
        team_id: u.team_department_id,
        team_name: teamName.get(u.team_department_id) ?? '?',
      }))}
      matrix={matrix}
      canLock={canLock}
      canUnlock={canUnlock}
      myTeamId={myTeamId}
    />
  )
}
