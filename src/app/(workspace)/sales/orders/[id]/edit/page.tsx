import { notFound, redirect } from 'next/navigation'
import { canMutateOwned } from '@/lib/record-ownership'
import { authService } from '@/modules/core/auth/auth.service'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { ordersService } from '@/modules/dept/sales/orders.service'
import { customersRepo } from '@/modules/dept/sales/sales.repo'
import { productsRepo } from '@/modules/dept/technical/technical.repo'
import { toQuotePickPayload } from '@/modules/dept/sales/orders.view'
import { HttpError } from '@/server/http'
import { OrderForm } from '@/components/sales/OrderForm'

/** Trang sửa đơn (khách thay đổi) — dùng chung OrderForm, ghi lịch sử khi lưu. */
export default async function EditOrderPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await authService.requirePageUser()
  const { id } = await params

  const dept = user.department_id
    ? await departmentsRepo.findById(user.department_id)
    : null
  if (user.role !== 'admin' && dept?.name !== 'Bán Hàng') {
    redirect(`/sales/orders/${id}`)
  }

  let data
  try {
    data = await ordersService.detail(user, id)
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound()
    throw e
  }
  const { order, lines } = data
  // Của ai người đó sửa (07/08/2026) — chặn cả đường vào thẳng URL /edit, không
  // chỉ ẩn nút. Service vẫn là chốt chặn cuối.
  if (!canMutateOwned(user, order.created_by)) {
    redirect(`/sales/orders/${id}`)
  }
  if (order.status === 'delivered' || order.status === 'cancelled') {
    redirect(`/sales/orders/${id}`)
  }

  // CHỈ các SP đang nằm trên dòng — ô chọn tự tìm ở server (xem ProductPicker).
  const [{ rows: customers }, lineProducts] = await Promise.all([
    customersRepo.list({ status: 'active', page: 1, page_size: 1000 }),
    productsRepo.listPickByIds(lines.map((l) => l.product_id)),
  ])

  return (
    <OrderForm
      mode="edit"
      customers={customers.map((c) => ({ id: c.id, name: c.name }))}
      lineProducts={lineProducts.map(toQuotePickPayload)}
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
        price_term: order.price_term,
        payment_terms: order.payment_terms,
        deposit_percent: order.deposit_percent,
        qty_tolerance_pct: order.qty_tolerance_pct,
        port_of_loading: order.port_of_loading,
        port_of_discharge: order.port_of_discharge,
        payment_method: order.payment_method,
        required_docs: order.required_docs,
        partial_shipment: order.partial_shipment,
        transhipment: order.transhipment,
      }}
      initialLines={lines.map((l) => ({
        product_id: l.product_id,
        qty: l.qty,
        unit_price: l.unit_price,
        ship_date: l.ship_date,
        note: l.note ?? '',
      }))}
    />
  )
}
