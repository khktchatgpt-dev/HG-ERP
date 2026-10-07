import { notFound, redirect } from 'next/navigation'
import { canMutateOwned } from '@/lib/record-ownership'
import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { ordersService } from '@/modules/dept/sales/orders.service'
import { customersRepo } from '@/modules/dept/sales/sales.repo'
import { productsRepo } from '@/modules/dept/technical/technical.repo'
import { toQuotePickPayload } from '@/modules/dept/sales/orders.view'
import { HttpError } from '@/server/http'
import { DonHangForm } from '../../_form/DonHangForm'

/** Trang sửa đơn (khách thay đổi) — cùng form khuôn F, ghi lịch sử khi lưu. */
export default async function EditOrderPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await authService.requirePageUser()
  const { id } = await params

  if (!(await canAction(user, 'sales.order.manage'))) {
    redirect(`/sales/orders/${id}`)
  }

  let data
  try {
    data = await ordersService.detail(user, id)
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound()
    throw e
  }
  const { order, lines, shippedByLine } = data
  // Của ai người đó sửa (07/08/2026) — chặn cả đường vào thẳng URL /edit, không
  // chỉ ẩn nút. Service vẫn là chốt chặn cuối.
  if (!canMutateOwned(user, order.created_by)) {
    redirect(`/sales/orders/${id}`)
  }
  if (order.status === 'delivered' || order.status === 'cancelled' || order.status === 'shipped') {
    redirect(`/sales/orders/${id}`)
  }

  // CHỈ các SP đang nằm trên dòng — ô chọn tự tìm ở server.
  const [{ rows: customers }, lineProducts] = await Promise.all([
    customersRepo.list({ status: 'active', page: 1, page_size: 1000 }),
    productsRepo.listPickByIds(lines.map((l) => l.product_id)),
  ])

  return (
    <DonHangForm
      mode="edit"
      customers={customers.map((c) => ({
        id: c.id,
        name: c.name,
        default_currency: c.default_currency,
        default_price_term: c.default_price_term,
        default_payment_terms: c.default_payment_terms,
        port_of_discharge: c.port_of_discharge,
      }))}
      lineProducts={lineProducts.map(toQuotePickPayload)}
      order={{
        id: order.id,
        code: order.code,
        customer_id: order.customer_id,
        customer_name: order.customer_name,
        currency: order.currency,
        status: order.status,
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
        id: l.id,
        product_id: l.product_id,
        qty: l.qty,
        unit_price: l.unit_price,
        ship_date: l.ship_date,
        note: l.note ?? '',
        shipped: shippedByLine[l.id] ?? 0,
      }))}
    />
  )
}
