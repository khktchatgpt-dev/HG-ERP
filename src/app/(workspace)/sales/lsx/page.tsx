import { authService } from '@/modules/core/auth/auth.service'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { lsxService } from '@/modules/dept/production/lsx.service'
import { lsxLinesRepo } from '@/modules/dept/production/lsx-lines.repo'
import { ordersRepo } from '@/modules/dept/sales/orders.repo'
import { usersRepo } from '@/modules/core/users/users.repo'
import { LsxWorkbench, type AwaitingOrder, type LsxRow } from './LsxWorkbench'

/**
 * Trang LỆNH SẢN XUẤT của Sales — thay trang "Theo dõi đơn" cũ (route
 * /sales/tracking nay chuyển hướng về đây). Bảng theo dõi ĐƠN vẫn còn nguyên
 * cho Kế hoạch (/planning/tracking) và Ban GĐ (/exec/tracking).
 */
export default async function SalesLsxPage() {
  const user = await authService.requirePageUser()
  const dept = user.department_id
    ? await departmentsRepo.findById(user.department_id)
    : null
  const canIssue = user.role === 'admin' || dept?.name === 'Bán Hàng'

  const [{ rows: lsxRows }, awaitingOrders] = await Promise.all([
    lsxService.list(user, { page: 1, page_size: 300 }),
    ordersRepo.listAwaitingLsx(),
  ])

  // Số dòng/SL: của LỆNH lấy từ dòng lệnh, của ĐƠN chờ phát lấy từ dòng đơn.
  // Người LẬP lệnh — một truy vấn cho cả trang (0119).
  const creatorNames = await usersRepo.displayNamesByIds([
    ...new Set(lsxRows.map((r) => r.created_by).filter((v) => v !== null)),
  ])

  const [lsxSummary, awaitingLines] = await Promise.all([
    lsxLinesRepo.summaryByLsx(lsxRows.map((r) => r.id)),
    ordersRepo.listLinesByOrders(awaitingOrders.map((o) => o.id)),
  ])
  const perOrder = new Map<string, { lines: number; qty: number }>()
  for (const l of awaitingLines) {
    const cur = perOrder.get(l.order_id) ?? { lines: 0, qty: 0 }
    cur.lines += 1
    cur.qty += Number(l.qty) || 0
    perOrder.set(l.order_id, cur)
  }

  const awaiting: AwaitingOrder[] = awaitingOrders.map((o) => ({
    id: o.id,
    code: o.code,
    customer_id: o.customer_id,
    customer_name: o.customer_name,
    due_date: o.due_date,
    line_count: perOrder.get(o.id)?.lines ?? 0,
    qty: perOrder.get(o.id)?.qty ?? 0,
  }))

  const rows: LsxRow[] = lsxRows.map((r) => ({
    id: r.id,
    code: r.code,
    customer_id: r.customer_id,
    customer_name: r.customer_name,
    order_codes: r.order_codes,
    status: r.status,
    revision: r.revision,
    issued_at: r.issued_at,
    created_by_name: r.created_by ? (creatorNames.get(r.created_by) ?? null) : null,
    ship_date: r.ship_date,
    lines: lsxSummary.get(r.id)?.lines ?? 0,
    qty: lsxSummary.get(r.id)?.qty ?? 0,
  }))

  return <LsxWorkbench awaiting={awaiting} rows={rows} canIssue={canIssue} />
}
