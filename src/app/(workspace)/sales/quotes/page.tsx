import { authService } from '@/modules/core/auth/auth.service'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { quotesRepo } from '@/modules/dept/sales/quotes.repo'
import { quotesService } from '@/modules/dept/sales/quotes.service'
import { customersRepo } from '@/modules/dept/sales/sales.repo'
import { QuotesManager } from './QuotesManager'

export default async function SalesQuotesPage() {
  const user = await authService.requirePageUser()
  const dept = user.department_id
    ? await departmentsRepo.findById(user.department_id)
    : null
  const canEdit = user.role === 'admin' || dept?.name === 'Bán Hàng'

  const [{ rows: quotes }, { rows: customers }] = await Promise.all([
    quotesService.list(user, { page: 1, page_size: 500 }),
    customersRepo.list({ status: 'active', page: 1, page_size: 1000 }),
  ])
  // Số dòng SP + tên người lập — hai dữ kiện sổ báo giá cần mà list gốc không có.
  const [lineCounts, ownerNames] = await Promise.all([
    quotesRepo.lineCountByQuoteIds(quotes.map((q) => q.id)),
    quotesRepo.ownerNamesByIds(
      quotes.map((q) => q.created_by).filter(Boolean) as string[],
    ),
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
        created_at: q.created_at,
        line_count: lineCounts.get(q.id) ?? 0,
        owner_name: q.created_by ? (ownerNames.get(q.created_by) ?? null) : null,
      }))}
      customers={customers.map((c) => ({ id: c.id, name: c.name }))}
      canEdit={!!canEdit}
    />
  )
}
