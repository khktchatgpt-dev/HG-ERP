import { notFound, redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { customersRepo } from '@/modules/dept/sales/sales.repo'
import { productsRepo } from '@/modules/dept/technical/technical.repo'
import { quotesService } from '@/modules/dept/sales/quotes.service'
import { toQuotePickPayload } from '@/modules/dept/sales/orders.view'
import { HttpError } from '@/server/http'
import { QuoteForm } from '@/components/sales/QuoteForm'

/**
 * Sửa báo giá nháp (chỉ draft) — dùng chung QuoteForm. Chỉ nạp ĐÚNG các SP đang
 * nằm trên dòng (không phải cả thư viện): ô chọn SP tự tìm ở server.
 */
export default async function EditQuotePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await authService.requirePageUser()
  const { id } = await params

  const dept = user.department_id
    ? await departmentsRepo.findById(user.department_id)
    : null
  const canEdit = user.role === 'admin' || dept?.name === 'Bán Hàng'
  if (!canEdit) redirect(`/sales/quotes/${id}`)

  let data
  try {
    data = await quotesService.detail(user, id)
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound()
    throw e
  }
  const { quote, lines } = data
  // Chỉ báo giá nháp mới sửa được — đã gửi thì bất biến.
  if (quote.status !== 'draft') redirect(`/sales/quotes/${id}`)

  const [{ rows: customers }, lineProducts] = await Promise.all([
    customersRepo.list({ status: 'active', page: 1, page_size: 1000 }),
    productsRepo.listPickByIds(lines.map((l) => l.product_id)),
  ])

  return (
    <QuoteForm
      mode="edit"
      customers={customers.map((c) => ({
        id: c.id,
        name: c.name,
        default_currency: c.default_currency,
        default_price_term: c.default_price_term,
        default_payment_terms: c.default_payment_terms,
      }))}
      lineProducts={lineProducts.map(toQuotePickPayload)}
      initial={{
        id: quote.id,
        code: quote.code,
        customer_id: quote.customer_id,
        currency: quote.currency,
        valid_from: quote.valid_from,
        valid_to: quote.valid_to,
        price_term: quote.price_term,
        payment_terms: quote.payment_terms,
        note: quote.note,
      }}
      initialLines={lines.map((l) => ({
        product_id: l.product_id,
        unit_price: l.unit_price,
        discount_pct: l.discount_pct,
        note: l.note,
      }))}
    />
  )
}
