import { authService } from '@/modules/core/auth/auth.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { outputsService } from '@/modules/dept/production/outputs.service'
import { ProductionBoard, type BoardRow } from './ProductionBoard'

/**
 * BẢNG TỔNG tiến độ sản xuất (SX-P5 — FR-RP-01, thay sheet `quan li`):
 * mọi chi tiết của các LSX đang chạy × tiến độ từng công đoạn, thiếu/đủ,
 * %HT, trạng thái, đồng bộ. Xuất CSV (Excel mở trực tiếp — FR-RP-05).
 * Quy mô dev (~vài chục lệnh) nên tổng hợp tuần tự per LSX là đủ nhanh.
 *
 * Server component DÙNG CHUNG cho 2 shell (guard khác nhau ở page):
 *   /production/board — chỉ GĐ/QL (phần riêng của giám đốc, user chốt 07/2026)
 *   /planning/board   — thêm Kế hoạch/Cung ứng (lập kế hoạch mua vật tư)
 */
export async function BoardScreen() {
  const user = (await authService.currentUser())!

  const [{ rows: running }, stages] = await Promise.all([
    productionRepo.list({ page: 1, page_size: 50 }),
    productionRepo.listStages(),
  ])
  const active = running.filter(
    (l) => l.status === 'approved' || l.status === 'in_progress',
  )

  const rows: BoardRow[] = []
  const synced: { lsx_code: string; product_code: string; qty: number; sets: number }[] =
    []
  for (const lsx of active) {
    const s = await outputsService.summary(user, lsx.id)
    const productByLine = new Map(
      s.synced_by_line.map((l) => [l.order_line_id, l.product_code]),
    )
    for (const c of s.components) {
      rows.push({
        lsx_id: lsx.id,
        lsx_code: lsx.code,
        customer_name: lsx.customer_name,
        product_code: productByLine.get(c.order_line_id) ?? '',
        cluster: c.cluster,
        name: c.name,
        total_needed: c.total_needed,
        stages: c.summary.stages.map((st) => ({
          stage: st.stage,
          done: st.done,
          missing: st.missing,
          defect: st.defect,
        })),
        allowed_stages: c.allowed_stages,
        pct_total: c.summary.pct_total,
        status: c.summary.status,
      })
    }
    for (const l of s.synced_by_line) {
      if (l.has_components) {
        synced.push({
          lsx_code: lsx.code,
          product_code: l.product_code,
          qty: l.qty,
          sets: l.synced_sets,
        })
      }
    }
  }

  return (
    <ProductionBoard
      rows={rows}
      stages={stages}
      synced={synced}
      lsxCount={active.length}
    />
  )
}
