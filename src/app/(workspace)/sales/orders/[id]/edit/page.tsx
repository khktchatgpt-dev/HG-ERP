import { notFound, redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { ordersService } from '@/modules/dept/sales/orders.service'
import { customersRepo } from '@/modules/dept/sales/sales.repo'
import { productsRepo } from '@/modules/dept/technical/technical.repo'
import { toProductPick } from '@/modules/dept/sales/orders.view'
import { HttpError } from '@/server/http'
import { OrderForm } from '@/components/sales/OrderForm'

/** Trang sửa đơn (khách thay đổi) — dùng chung OrderForm, ghi lịch sử khi lưu. */
export default async function EditOrderPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = (await authService.currentUser())!
  const { id } = await params

  const dept = user.department_id
    ? await departmentsRepo.findById(user.department_id)
    : null
  const canEdit = user.role === 'admin' || dept?.name === 'Bán Hàng'
  if (!canEdit) redirect(`/sales/orders/${id}`)

  let data
  try {
    data = await ordersService.detail(user, id)
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound()
    throw e
  }
  const { order, lines } = data
  if (order.status === 'delivered' || order.status === 'cancelled') {
    redirect(`/sales/orders/${id}`)
  }

  const [{ rows: customers }, { rows: products }] = await Promise.all([
    customersRepo.list({ active_only: true, page: 1, page_size: 1000 }),
    productsRepo.list({ active_only: true, page: 1, page_size: 1000 }),
  ])

  return (
    <OrderForm
      mode="edit"
      customers={customers.map((c) => ({ id: c.id, name: c.name }))}
      products={products.map(toProductPick)}
      order={{
        id: order.id,
        code: order.code,
        customer_id: order.customer_id,
        customer_name: order.customer_name,
        currency: order.currency,
        quote_code: order.quote_code,
        customer_po_no: order.customer_po_no,
        due_date: order.due_date,
        container_summary: order.container_summary,
        note: order.note,
      }}
      initialLines={lines.map((l) => ({
        product_id: l.product_id,
        qty: l.qty,
        unit_price: l.unit_price,
        note: l.note ?? '',
      }))}
    />
  )
}
