import { authService } from '@/modules/core/auth/auth.service'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { ordersService } from '@/modules/dept/sales/orders.service'
import { ordersRepo } from '@/modules/dept/sales/orders.repo'
import { customersRepo } from '@/modules/dept/sales/sales.repo'
import { usersRepo } from '@/modules/core/users/users.repo'
import { canMutateOwned } from '@/lib/record-ownership'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { OrdersManager } from './OrdersManager'

export default async function SalesOrdersPage() {
  const user = await authService.requirePageUser()
  const dept = user.department_id
    ? await departmentsRepo.findById(user.department_id)
    : null
  const canEdit = user.role === 'admin' || dept?.name === 'Bán Hàng'

  const [{ rows: orders }, { rows: customers }] = await Promise.all([
    ordersService.list(user, { page: 1, page_size: 500 }),
    customersRepo.list({ status: 'active', page: 1, page_size: 1000 }),
  ])

  /*
   * Hai lô phụ, mỗi lô một truy vấn cho CẢ trang (đừng gọi theo từng đơn):
   *   · lineSummary — SL / số dòng / giá trị, để bảng nói được việc thay vì
   *     chừa hai cột trống như bản cũ.
   *   · lsxCodes    — mã lệnh sản xuất của đơn đã phát lệnh; cột này thay chỗ
   *     cột "Từ BG" cũ (rỗng gần như 100% vì đơn hầu hết nhập thẳng).
   */
  const [lineSummary, lsxCodes, creatorNames] = await Promise.all([
    ordersRepo.lineSummaryByOrderIds(orders.map((o) => o.id)),
    productionRepo.listCodesByIds([
      ...new Set(orders.map((o) => o.production_order_id).filter((v) => v !== null)),
    ]),
    // Người tạo đơn — một truy vấn cho cả trang, không tra theo từng dòng.
    usersRepo.displayNamesByIds([
      ...new Set(orders.map((o) => o.created_by).filter((v) => v !== null)),
    ]),
  ])

  return (
    <OrdersManager
      orders={orders.map((o) => {
        const s = lineSummary[o.id]
        return {
          id: o.id,
          code: o.code,
          quote_code: o.quote_code,
          customer_id: o.customer_id,
          customer_name: o.customer_name,
          customer_po_no: o.customer_po_no,
          status: o.status,
          currency: o.currency,
          due_date: o.due_date,
          created_at: o.created_at,
          lines: s?.lines ?? 0,
          qty: s?.qty ?? 0,
          total: s?.total ?? 0,
          lsx_id: o.production_order_id,
          created_by_name: o.created_by ? (creatorNames.get(o.created_by) ?? null) : null,
          // Của ai người đó sửa (07/08/2026) — tính từng dòng để menu ⋯ ẩn đúng chỗ.
          can_edit: canEdit && canMutateOwned(user, o.created_by),
          lsx_code: o.production_order_id
            ? (lsxCodes.get(o.production_order_id) ?? null)
            : null,
        }
      })}
      customers={customers.map((c) => ({ id: c.id, name: c.name }))}
      canEdit={canEdit}
    />
  )
}
