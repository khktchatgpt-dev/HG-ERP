import { notFound, redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { salesService, isSalesUser } from '@/modules/dept/sales/sales.service'
import { quotesService } from '@/modules/dept/sales/quotes.service'
import { ordersService } from '@/modules/dept/sales/orders.service'
import { HttpError } from '@/server/http'
import { CustomerDetail } from './CustomerDetail'

/**
 * Hồ sơ khách hàng + lịch sử báo giá/đơn (FR-SAL-01). Server component: đọc KH
 * + danh sách báo giá/đơn của KH rồi giao cho client render (tabs, bảng).
 */
export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = (await authService.currentUser())!
  const allowed = user.role === 'admin' || (await isSalesUser(user))
  if (!allowed) redirect('/')

  const { id } = await params

  let customer
  try {
    customer = await salesService.get(user, id)
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound()
    throw e
  }

  const [{ rows: quotes }, orders] = await Promise.all([
    quotesService.list(user, { customer_id: id, page: 1, page_size: 500 }),
    ordersService.listByCustomer(user, id),
  ])

  return (
    <CustomerDetail
      customer={customer}
      quotes={quotes.map((q) => ({
        id: q.id,
        code: q.code,
        status: q.status,
        currency: q.currency,
        valid_from: q.valid_from,
        valid_to: q.valid_to,
        created_at: q.created_at,
      }))}
      orders={orders.map((o) => ({
        id: o.id,
        code: o.code,
        quote_code: o.quote_code,
        customer_po_no: o.customer_po_no,
        status: o.status,
        currency: o.currency,
        due_date: o.due_date,
        created_at: o.created_at,
      }))}
    />
  )
}
