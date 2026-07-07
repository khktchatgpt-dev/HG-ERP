import { authService } from '@/modules/core/auth/auth.service'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { quotesService } from '@/modules/dept/sales/quotes.service'
import { customersRepo } from '@/modules/dept/sales/sales.repo'
import { productsRepo } from '@/modules/dept/technical/technical.repo'
import { QuotesManager } from './QuotesManager'

export default async function SalesQuotesPage() {
  const user = (await authService.currentUser())!
  const dept = user.department_id
    ? await departmentsRepo.findById(user.department_id)
    : null
  const canEdit = user.role === 'admin' || dept?.name === 'Kinh Doanh'
  const canApprove = user.role === 'admin' || user.role === 'manager'

  const [{ rows: quotes }, { rows: customers }, { rows: products }] = await Promise.all([
    quotesService.list(user, { page: 1, page_size: 500 }),
    customersRepo.list({ active_only: true, page: 1, page_size: 1000 }),
    productsRepo.list({ active_only: true, page: 1, page_size: 1000 }),
  ])

  return (
    <QuotesManager
      quotes={quotes.map((q) => ({
        id: q.id,
        code: q.code,
        customer_id: q.customer_id,
        customer_name: q.customer_name,
        status: q.status,
        currency: q.currency,
        valid_from: q.valid_from,
        valid_to: q.valid_to,
        price_term: q.price_term,
        payment_terms: q.payment_terms,
        note: q.note,
        rejected_reason: q.rejected_reason,
        created_at: q.created_at,
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
      canApprove={canApprove}
    />
  )
}
