import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { lsxService } from '@/modules/dept/production/lsx.service'
import { lsxLinesRepo } from '@/modules/dept/production/lsx-lines.repo'
import { jobsRepo } from '@/modules/dept/production/jobs.repo'
import { ordersRepo } from '@/modules/dept/sales/orders.repo'
import { shipPlanRepo } from '@/modules/dept/sales/ship-plan.repo'
import { usersRepo } from '@/modules/core/users/users.repo'
import { todayVn } from '@/lib/date-vn'
import { nextLot } from '@/lib/lsx-lots'
import { SoLenhScreen } from './SoLenhScreen'
import type { LenhRow } from './so-lenh.shared'

/**
 * Sổ LỆNH SẢN XUẤT của Sale (khuôn C, kiểu ERP — 07/10/2026). Gác quyền + tải
 * dữ liệu song song: lệnh · dòng/SL · công đoạn · lô 0222 · người lập · đơn
 * chờ phát lệnh. Phát lệnh làm ở trang đơn.
 */
export default async function SalesLsxPage() {
  const user = await authService.requirePageUser()
  const [canIssue, { rows: lsxRows }, awaitingOrders] = await Promise.all([
    canAction(user, 'production.lsx.issue'),
    lsxService.list(user, { page: 1, page_size: 300 }),
    ordersRepo.listAwaitingLsx(),
  ])
  const ids = lsxRows.map((r) => r.id)
  const [summary, jobs, lots, creatorNames] = await Promise.all([
    lsxLinesRepo.summaryByLsx(ids),
    jobsRepo.listByLsxBulk(ids),
    shipPlanRepo.lotsOf(ids),
    usersRepo.displayNamesByIds([
      ...new Set(lsxRows.map((r) => r.created_by).filter((v) => v !== null)),
    ]),
  ])
  const today = todayVn()
  const jobsBy = new Map<string, { done: number; total: number }>()
  for (const j of jobs) {
    const cur = jobsBy.get(j.production_order_id) ?? { done: 0, total: 0 }
    cur.total += 1
    if (j.status === 'done') cur.done += 1
    jobsBy.set(j.production_order_id, cur)
  }
  const lotsBy = new Map<string, typeof lots>()
  for (const l of lots) {
    const arr = lotsBy.get(l.production_order_id) ?? []
    arr.push(l)
    lotsBy.set(l.production_order_id, arr)
  }

  const rows: LenhRow[] = lsxRows.map((r) => {
    const myLots = lotsBy.get(r.id) ?? []
    const nl = nextLot(myLots, today)
    return {
      id: r.id,
      code: r.code,
      customer_id: r.customer_id,
      customer_name: r.customer_name,
      order_codes: r.order_codes,
      status: r.status,
      revision: r.revision,
      priority: r.priority,
      issued_at: r.issued_at,
      created_by: r.created_by,
      created_by_name: r.created_by ? (creatorNames.get(r.created_by) ?? null) : null,
      ship_date: r.ship_date,
      materials_due_at: r.materials_due_at,
      materials_received_at: r.materials_received_at,
      lines: summary.get(r.id)?.lines ?? 0,
      qty: summary.get(r.id)?.qty ?? 0,
      jobs_done: jobsBy.get(r.id)?.done ?? 0,
      jobs_total: jobsBy.get(r.id)?.total ?? 0,
      lots: myLots.length,
      next_lot: nl?.ship_date
        ? { ship_date: nl.ship_date, po: nl.po_ref || nl.po_no }
        : null,
      lot_qty: myLots.reduce((s, l) => s + l.lines.reduce((a, x) => a + x.qty, 0), 0),
    }
  })

  return (
    <SoLenhScreen
      rows={rows}
      awaiting={awaitingOrders.length}
      me={{ id: user.id }}
      canIssue={canIssue}
    />
  )
}
