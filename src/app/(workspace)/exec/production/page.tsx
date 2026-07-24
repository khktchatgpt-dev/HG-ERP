import { lsxService } from '@/modules/dept/production/lsx.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { entriesRepo } from '@/modules/dept/production/entries.repo'
import { defectStats } from '@/lib/exec-ops'
import { ProductionPipeline } from './ProductionPipeline'

/**
 * Tiến độ sản xuất — góc nhìn Ban Giám đốc: kanban LSX theo giai đoạn vòng
 * đời (tiến độ jobs — 0084), hạn giao, năng suất, chất lượng. GĐ chỉ xem;
 * click thẻ mở hồ sơ LSX (/exec/lsx). Gate ở exec/layout.
 */
export default async function ExecProductionPage() {
  const now = new Date()
  const isoToday = now.toISOString().slice(0, 10)
  const past = new Date(now)
  past.setDate(past.getDate() - 6) // 7 ngày gồm hôm nay
  const iso7ago = past.toISOString().slice(0, 10)

  const [rows, stages, outputs7] = await Promise.all([
    lsxService.tracking(),
    productionRepo.listStages(),
    entriesRepo.listRange(iso7ago, isoToday),
  ])

  const todayQty = outputs7
    .filter((o) => o.entry_date === isoToday)
    .reduce((s, o) => s + o.qty, 0)
  const defectRate = defectStats(outputs7).rate

  return (
    <ProductionPipeline
      rows={rows}
      stages={stages}
      incidentLsxIds={[]}
      todayQty={todayQty}
      defectRate={defectRate}
    />
  )
}
