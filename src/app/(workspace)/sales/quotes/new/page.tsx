import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { customersRepo } from '@/modules/dept/sales/sales.repo'
import { productsRepo } from '@/modules/dept/technical/technical.repo'
import { toProductPick } from '@/modules/dept/sales/orders.view'
import { QuoteForm } from '@/components/sales/QuoteForm'

/** Trang lập báo giá (trang riêng, bố cục rộng, hiện đủ quy cách SP). */
export default async function NewQuotePage() {
  const user = (await authService.currentUser())!
  const dept = user.department_id
    ? await departmentsRepo.findById(user.department_id)
    : null
  const canEdit = user.role === 'admin' || dept?.name === 'Bán Hàng'
  if (!canEdit) redirect('/sales/quotes')

  const [{ rows: customers }, { rows: products }] = await Promise.all([
    customersRepo.list({ active_only: true, page: 1, page_size: 1000 }),
    productsRepo.list({ active_only: true, page: 1, page_size: 1000 }),
  ])

  return (
    <QuoteForm
      mode="create"
      customers={customers.map((c) => ({
        id: c.id,
        name: c.name,
        default_currency: c.default_currency,
        default_price_term: c.default_price_term,
        default_payment_terms: c.default_payment_terms,
      }))}
      products={products.map(toProductPick)}
    />
  )
}
