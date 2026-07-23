import { authService } from '@/modules/core/auth/auth.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { outputsService } from '@/modules/dept/production/outputs.service'
import { assessLateRisk } from '@/lib/late-risk'
import { ProductionHome, type ProdCard } from './ProductionHome'

/**
 * Trang chủ workspace Sản xuất (plan-production-workspace P2): các LSX đang
 * chạy dạng CARD LỚN + tìm/lọc/sort (trễ hạn lên đầu). Cả card là nút bấm.
 */
export default async function ProductionHomePage() {
  const user = (await authService.currentUser())!

  const [tracking, stages] = await Promise.all([
    productionRepo.listTracking(),
    productionRepo.listStages(),
  ])
  const stageLabel = (code: string | null) =>
    code ? (stages.find((s) => s.code === code)?.label ?? code) : null

  const today = new Date().toISOString().slice(0, 10)
  // Xưởng chỉ cần lệnh đang chạy: đã duyệt (chờ bắt đầu) + đang sản xuất.
  const running = tracking.filter(
    (r) => r.lsx_status === 'approved' || r.lsx_status === 'in_progress',
  )

  // Tiến độ "bộ đồng bộ" per lệnh: Σ bộ hoàn chỉnh qua công đoạn cuối / Σ SL
  // đặt — thước đo xưởng hiểu ngay ("ra được bao nhiêu bộ hàng"). Lệnh đang
  // chạy chỉ vài cái nên tổng hợp tuần tự per lệnh là đủ nhanh (như board).
  const progressByLsx = new Map<string, { sets: number; qty: number }>()
  await Promise.all(
    running.map(async (r) => {
      try {
        const s = await outputsService.summary(user, r.production_order_id!)
        const withComps = s.synced_by_line.filter((l) => l.has_components)
        if (!withComps.length) return
        progressByLsx.set(r.production_order_id!, {
          sets: withComps.reduce((a, l) => a + l.synced_sets, 0),
          qty: withComps.reduce((a, l) => a + l.qty, 0),
        })
      } catch {
        /* thiếu tiến độ không làm hỏng trang chào */
      }
    }),
  )

  const cards: ProdCard[] = running.map((r) => {
    const risk = assessLateRisk(r, today)
    const prog = progressByLsx.get(r.production_order_id!)
    const pct = prog && prog.qty > 0 ? Math.round((prog.sets / prog.qty) * 100) : null
    return {
      id: r.production_order_id!,
      code: r.lsx_code ?? '?',
      customer_name: r.customer_name,
      order_code: r.code,
      status: r.lsx_status as 'approved' | 'in_progress',
      stage_label:
        r.lsx_status === 'in_progress'
          ? (stageLabel(r.current_stage) ?? 'Đang sản xuất')
          : null,
      ship_date: r.ship_date,
      risk_level: risk?.level ?? null,
      pct,
      sets: prog?.sets ?? null,
      qty: prog?.qty ?? null,
    }
  })

  return <ProductionHome greeting={`Chào ${user.name ?? user.email}`} cards={cards} />
}
