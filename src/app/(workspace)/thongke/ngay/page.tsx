import { authService } from '@/modules/core/auth/auth.service'
import { entriesService } from '@/modules/dept/production/entries.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { isProductionStaff } from '@/modules/dept/production/perms'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { vnTodayIso } from '@/lib/local-date'
import { NgayScreen } from './NgayScreen'

export const dynamic = 'force-dynamic'

/**
 * SỔ NGÀY (B3 Sổ Sản Lượng v2): mọi phiếu của MỘT ngày gom theo TỔ + chốt sổ
 * cuối ngày per tổ. Chốt xong thì ghi/sửa/xoá phiếu của (tổ × ngày) đó bị khoá
 * — mở lại do Ban quản lý, có lưu vết.
 */
export default async function NgayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const user = await authService.requirePageUser()
  const sp = await searchParams
  const today = vnTodayIso()
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? '') ? (sp.date as string) : today

  const [day, stages, depts] = await Promise.all([
    entriesService.listDay(user, date),
    productionRepo.listStages(),
    departmentsRepo.list(),
  ])
  const teamName = new Map(depts.map((d) => [d.id, d.name]))

  // Σ đạt/phế per phiếu từ dòng sổ của ngày.
  const sums = new Map<string, { qty: number; defect: number; lines: number }>()
  for (const e of day.entries) {
    if (!e.doc_id) continue
    const s = sums.get(e.doc_id) ?? { qty: 0, defect: 0, lines: 0 }
    s.qty += Number(e.qty)
    s.defect += Number(e.defect_qty)
    s.lines++
    sums.set(e.doc_id, s)
  }

  const canLock = user.role === 'admin' || (await isProductionStaff(user))
  const canUnlock = user.role === 'admin' || user.role === 'manager'

  return (
    <NgayScreen
      date={date}
      today={today}
      stages={Object.fromEntries(stages.map((s) => [s.code, s.label]))}
      docs={day.docs.map((d) => {
        const s = sums.get(d.id)
        return {
          id: d.id,
          doc_no: d.doc_no,
          lsx_id: d.production_order_id,
          lsx_code: d.lsx_code,
          stage: d.stage,
          status: d.status,
          team_id: d.team_department_id,
          team_name: d.team_name,
          created_by_name: d.created_by_name,
          total_qty: Math.round((s?.qty ?? 0) * 100) / 100,
          total_defect: Math.round((s?.defect ?? 0) * 100) / 100,
          line_count: s?.lines ?? 0,
        }
      })}
      locks={day.locks.map((l) => ({
        team_id: l.team_department_id,
        team_name: l.team_name,
        locked_by_name: l.locked_by_name,
      }))}
      unlockedPast={day.unlocked_past.map((p) => ({
        entry_date: p.entry_date,
        team_id: p.team_department_id,
        team_name: teamName.get(p.team_department_id) ?? '?',
      }))}
      canLock={canLock}
      canUnlock={canUnlock}
    />
  )
}
