import { authService } from '@/modules/core/auth/auth.service'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { ordersService } from '@/modules/dept/sales/orders.service'
import { quotesService } from '@/modules/dept/sales/quotes.service'
import { customersRepo } from '@/modules/dept/sales/sales.repo'
import { productsRepo } from '@/modules/dept/technical/technical.repo'
import { OrdersManager } from './OrdersManager'

export default async function SalesOrdersPage() {
  const user = (await authService.currentUser())!
  const dept = user.department_id
    ? await departmentsRepo.findById(user.department_id)
    : null
  const canEdit = user.role === 'admin' || dept?.name === 'Kinh Doanh'
  const canIssue = user.role === 'admin' || user.role === 'manager'

  const [
    { rows: orders },
    { rows: approvedQuotes },
    { rows: customers },
    { rows: products },
  ] = await Promise.all([
    ordersService.list(user, { page: 1, page_size: 500 }),
    quotesService.list(user, { status: 'approved', page: 1, page_size: 500 }),
    customersRepo.list({ active_only: true, page: 1, page_size: 1000 }),
    productsRepo.list({ active_only: true, page: 1, page_size: 1000 }),
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
        currency: o.currency,
        due_date: o.due_date,
        deposit_percent: o.deposit_percent,
        price_term: o.price_term,
        payment_terms: o.payment_terms,
        container_summary: o.container_summary,
        note: o.note,
        created_at: o.created_at,
      }))}
      approvedQuotes={approvedQuotes.map((q) => ({
        id: q.id,
        code: q.code,
        customer_name: q.customer_name,
        currency: q.currency,
      }))}
      customers={customers.map((c) => ({ id: c.id, name: c.name }))}
      products={products.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        unit: p.unit,
        customer_id: p.customer_id,
        customer_item_code: p.customer_item_code,
        bom_status: p.bom_status,
      }))}
      canEdit={!!canEdit}
      canIssue={canIssue}
    />
  )
}
