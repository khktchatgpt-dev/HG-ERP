import { authService } from '@/modules/core/auth/auth.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { productionService } from '@/modules/dept/production/production.service'
import { outputsRepo } from '@/modules/dept/production/outputs.repo'
import { incidentsService } from '@/modules/dept/production/incidents.service'
import { defectStats } from '@/lib/exec-ops'
import { ProductionPipeline } from './ProductionPipeline'

/**
 * Tiến độ sản xuất — góc nhìn Ban Giám đốc: kanban toàn bộ LSX đang chạy theo
 * công đoạn dây chuyền (nút thắt, hạn giao, năng suất, chất lượng). GĐ chỉ xem;
 * click thẻ mở hồ sơ LSX (/exec/lsx). Dữ liệu lắp từ view tracking + sản lượng
 * (bulk, không lặp summary per LSX). Gate ở exec/layout.
 */
export default async function ExecProductionPage() {
  const user = (await authService.currentUser())!

  const now = new Date()
  const isoToday = now.toISOString().slice(0, 10)
  const past = new Date(now)
  past.setDate(past.getDate() - 6) // 7 ngày gồm hôm nay
  const iso7ago = past.toISOString().slice(0, 10)

  const [rows, stages, outputs7, incidents] = await Promise.all([
    productionService.tracking(),
    productionRepo.listStages(),
    outputsRepo.listRange(iso7ago, isoToday),
    incidentsService.list(user, { status: 'open' }).catch(() => []),
  ])

  const todayQty = outputs7
    .filter((o) => o.entry_date === isoToday)
    .reduce((s, o) => s + o.qty, 0)
  const defectRate = defectStats(outputs7).rate
  const incidentLsxIds = [
    ...new Set(
      incidents.map((i) => i.production_order_id).filter((x): x is string => !!x),
    ),
  ]

  return (
    <ProductionPipeline
      rows={rows}
      stages={stages}
      incidentLsxIds={incidentLsxIds}
      todayQty={todayQty}
      defectRate={defectRate}
    />
  )
}
