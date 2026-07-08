import { authService } from '@/modules/core/auth/auth.service'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { ordersService } from '@/modules/dept/sales/orders.service'
import { customersRepo } from '@/modules/dept/sales/sales.repo'
import { OrdersManager } from './OrdersManager'

export default async function SalesOrdersPage() {
  const user = (await authService.currentUser())!
  const dept = user.department_id
    ? await departmentsRepo.findById(user.department_id)
    : null
  const canEdit = user.role === 'admin' || dept?.name === 'Bán Hàng'

  const [{ rows: orders }, { rows: customers }] = await Promise.all([
    ordersService.list(user, { page: 1, page_size: 500 }),
    customersRepo.list({ active_only: true, page: 1, page_size: 1000 }),
  ])

  return (
    <OrdersManager
      orders={orders.map((o) => ({
        id: o.id,
        code: o.code,
        quote_code: o.quote_code,
        customer_id: o.customer_id,
        customer_name: o.customer_name,
        customer_po_no: o.customer_po_no,
        status: o.status,
        due_date: o.due_date,
        created_at: o.created_at,
      }))}
      customers={customers.map((c) => ({ id: c.id, name: c.name }))}
      canEdit={canEdit}
    />
  )
}
