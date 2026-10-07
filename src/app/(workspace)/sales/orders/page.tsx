import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { ordersService } from '@/modules/dept/sales/orders.service'
import { ordersRepo } from '@/modules/dept/sales/orders.repo'
import { customersRepo } from '@/modules/dept/sales/sales.repo'
import { usersRepo } from '@/modules/core/users/users.repo'
import { canMutateOwned } from '@/lib/record-ownership'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { SoDonHangScreen } from './SoDonHangScreen'
import type { DonRow } from './so-don-hang.shared'

/**
 * Trần tải một lượt. Sổ 53 đơn (10/2026) ~ 300 đơn/năm: bốc cả sổ vẫn nhẹ vài
 * năm tới, và bốc hết mới lọc/đếm phía client được. Chạm trần thì thanh trạng
 * thái nói ra chứ không cắt ngầm.
 */
const PAGE_CAP = 500

export default async function SalesOrdersPage() {
  const user = await authService.requirePageUser()
  // Cùng cửa với service (RBAC) — nút nào hiện thì bấm được.
  const canEdit = await canAction(user, 'sales.order.manage')

  const [{ rows: orders, total }, { rows: customers }] = await Promise.all([
    ordersService.list(user, { page: 1, page_size: PAGE_CAP }),
    customersRepo.list({ status: 'all', page: 1, page_size: 1000 }),
  ])
  const ownerByCustomer = new Map(customers.map((c) => [c.id, c.owner_id]))
  const ids = orders.map((o) => o.id)

  /*
   * Bốn lô phụ, mỗi lô MỘT truy vấn cho cả trang: dòng (SL · giá · tuần giao ·
   * mã SP/mã khách để tìm), Σ đã xuất (0120), mã lệnh, tên người tạo.
   */
  const [lines, shippedByOrder, lsxCodes, creatorNames] = await Promise.all([
    ordersRepo.listLinesByOrders(ids),
    ordersRepo.shippedByOrderIds(ids),
    productionRepo.listCodesByIds([
      ...new Set(orders.map((o) => o.production_order_id).filter((v) => v !== null)),
    ]),
    usersRepo.displayNamesByIds([
      ...new Set(orders.map((o) => o.created_by).filter((v) => v !== null)),
    ]),
  ])
  const linesByOrder = new Map<string, typeof lines>()
  for (const l of lines) {
    const arr = linesByOrder.get(l.order_id) ?? []
    arr.push(l)
    linesByOrder.set(l.order_id, arr)
  }

  const rows: DonRow[] = orders.map((o) => {
    const ls = linesByOrder.get(o.id) ?? []
    const missing: string[] = []
    if (!o.customer_po_no) missing.push('PO')
    if (ls.some((l) => !l.ship_date)) missing.push('tuần giao')
    if (!o.price_term || (!o.payment_terms && !o.payment_method))
      missing.push('điều khoản')
    if (ls.some((l) => !(l.unit_price > 0))) missing.push('giá')
    return {
      id: o.id,
      code: o.code,
      customer_id: o.customer_id,
      customer_name: o.customer_name,
      customer_po_no: o.customer_po_no,
      status: o.status,
      currency: o.currency,
      due_date: o.due_date,
      created_at: o.created_at,
      lines: ls.length,
      qty: ls.reduce((s, l) => s + l.qty, 0),
      shipped: shippedByOrder[o.id] ?? 0,
      total: ls.reduce((s, l) => s + l.qty * l.unit_price, 0),
      lsx_id: o.production_order_id,
      lsx_code: o.production_order_id
        ? (lsxCodes.get(o.production_order_id) ?? null)
        : null,
      created_by: o.created_by,
      created_by_name: o.created_by ? (creatorNames.get(o.created_by) ?? null) : null,
      customer_owner_id: ownerByCustomer.get(o.customer_id) ?? null,
      can_edit: canEdit && canMutateOwned(user, o.created_by),
      search: ls.map((l) => `${l.product_code} ${l.customer_item_code ?? ''}`).join(' '),
      missing,
    }
  })

  return (
    <SoDonHangScreen
      orders={rows}
      customers={customers.map((c) => ({ id: c.id, name: c.name }))}
      canEdit={canEdit}
      me={{
        id: user.id,
        name: user.name ?? user.email,
        ownsCustomers: customers.some((c) => c.owner_id === user.id),
      }}
      total={total}
    />
  )
}
