import { authService } from '@/modules/core/auth/auth.service'
import { jobsService } from '@/modules/dept/production/jobs.service'
import { componentsService } from '@/modules/dept/production/components.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { isProductionStaff } from '@/modules/dept/production/perms'
import { resolveNavCapabilities } from '@/workspaces/access'
import { resolveTeamStage } from '@/lib/stage-for-dept'
import { duongDiCuaLenh, toChuaChot, viecKeHoach, viecQuanDoc } from '@/lib/vao-viec-sx'
import { vnTodayIso } from '@/lib/local-date'
import { VaoViecScreen } from './VaoViecScreen'

export const dynamic = 'force-dynamic'

/**
 * VÀO VIỆC — cửa vào khu Sản xuất (khuôn A), 10/11/2026 thay Tình hình xưởng
 * (bản vẽ https://claude.ai/artifact/AMZpLvxJAaZKCDimF93qJL). Tải song song:
 * overview (cùng hàm với Lệnh sản xuất), shapingOverview (cùng hàm với Lộ
 * trình công đoạn), danh mục công đoạn + tổ (công đoạn chưa có tổ), năng lực
 * nav (ai thấy bảng việc nào). Khối "Khi xưởng chạy" dùng lại nguyên số của
 * Tình hình xưởng cũ.
 */
export default async function ProductionEntryPage() {
  const user = await authService.requirePageUser()
  const today = vnTodayIso()

  const [{ rows, workload, pulse }, shaping, stages, depts, caps, canRecord] =
    await Promise.all([
      jobsService.overview(user),
      componentsService.shapingOverview(),
      productionRepo.listStages(),
      departmentsRepo.list(),
      resolveNavCapabilities(user),
      (async () => user.role === 'admin' || (await isProductionStaff(user)))(),
    ])

  const coTo = new Set(
    depts
      .filter((d) => d.workspace_id === 'production')
      .map((d) => resolveTeamStage(d, stages))
      .filter((s): s is string => !!s),
  )
  const congDoanChuaTo = stages.filter((s) => !coTo.has(s.code)).map((s) => s.label)

  const buoc = duongDiCuaLenh(rows, shaping, today, pulse.qty)
  const viecKH = caps.has('production.plan') ? viecKeHoach(rows, shaping, today) : null
  const viecQD = caps.has('production.overview')
    ? viecQuanDoc(rows, {
        today,
        congDoanChuaTo,
        toChuaChot: toChuaChot(workload),
        lenhDuKeHoach: rows.filter((r) => r.jobs_total > 0 && r.jobs_no_end === 0).length,
      })
    : null

  return (
    <VaoViecScreen
      rows={rows}
      workload={workload}
      pulse={pulse}
      canRecord={canRecord}
      buoc={buoc}
      viecKH={viecKH}
      viecQD={viecQD}
      today={today}
    />
  )
}
