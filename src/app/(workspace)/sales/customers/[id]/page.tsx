import { notFound, redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { salesService, isSalesUser } from '@/modules/dept/sales/sales.service'
import { quotesService } from '@/modules/dept/sales/quotes.service'
import { ordersService } from '@/modules/dept/sales/orders.service'
import { ordersRepo } from '@/modules/dept/sales/orders.repo'
import { lastPricesForCustomer } from '@/modules/dept/sales/quotes.repo'
import { productsRepo } from '@/modules/dept/technical/technical.repo'
import { fileImageSrc } from '@/server/file-image'
import { HttpError } from '@/server/http'
import { HoSoKhachScreen } from './HoSoKhachScreen'

/**
 * Hồ sơ khách hàng (khuôn E): khách là ai · làm ăn ra sao (đơn, báo giá, giá đã
 * chào) · dùng ở đâu (SP gắn khách). Server tải song song rồi giao client vẽ.
 */
export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await authService.requirePageUser()
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

  const [{ rows: quotes }, orders, changes, members, { rows: products, total: productTotal }, lastPrices] =
    await Promise.all([
      quotesService.list(user, { customer_id: id, page: 1, page_size: 500 }),
      ordersService.listByCustomer(user, id),
      ordersRepo.listChangesByCustomer(id),
      salesService.members([user.id, customer.owner_id]),
      productsRepo.list({ customer_id: id, active_only: false, page: 1, page_size: 200 }),
      lastPricesForCustomer(id),
    ])
  const totals = await ordersRepo.totalsByOrderIds(orders.map((o) => o.id))
  // Giá đã chào có thể trỏ tới SP không gắn khách (báo giá chéo) — tra tên riêng.
  const priceIds = lastPrices.map((p) => p.product_id).filter((pid) => !products.some((p) => p.id === pid))
  const extra = priceIds.length ? await productsRepo.listPickByIds(priceIds) : []
  const nameOf = new Map<string, { code: string; name: string }>()
  for (const p of products) nameOf.set(p.id, { code: p.code, name: p.name })
  for (const p of extra) nameOf.set(p.id, { code: p.code, name: p.name })

  return (
    <HoSoKhachScreen
      customer={customer}
      quotes={quotes.map((q) => ({
        id: q.id,
        code: q.code,
        status: q.status,
        currency: q.currency,
        valid_from: q.valid_from,
        valid_to: q.valid_to,
        revision_no: q.revision_no,
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
        updated_at: o.updated_at,
        total: totals[o.id] ?? 0,
      }))}
      changes={changes.map((c) => ({
        id: c.id,
        order_id: c.order_id,
        order_code: c.order_code,
        changed_by_name: c.changed_by_name,
        type: (c.change as { type?: string }).type ?? 'update',
        note: c.note,
        created_at: c.created_at,
      }))}
      products={products.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        customer_item_code: p.customer_item_code,
        unit: p.unit,
        bom_status: p.bom_status,
        is_active: p.is_active,
        image_url: p.image_file_id ? fileImageSrc(p.image_file_id) : null,
      }))}
      productTotal={productTotal}
      lastPrices={lastPrices.map((lp) => ({
        product_id: lp.product_id,
        code: nameOf.get(lp.product_id)?.code ?? '?',
        name: nameOf.get(lp.product_id)?.name ?? '',
        unit_price: lp.unit_price,
        quote_code: lp.quote_code,
        quoted_at: lp.quoted_at,
      }))}
      currentUserId={user.id}
      role={user.role}
      members={members}
    />
  )
}
