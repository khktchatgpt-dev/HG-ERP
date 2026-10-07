import { notFound, redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { salesService, isSalesUser } from '@/modules/dept/sales/sales.service'
import { quotesService } from '@/modules/dept/sales/quotes.service'
import { ordersService } from '@/modules/dept/sales/orders.service'
import { ordersRepo } from '@/modules/dept/sales/orders.repo'
import { db } from '@/server/db'
import { HttpError } from '@/server/http'
import { HoSoKhachScreen } from './HoSoKhachScreen'

/**
 * Hồ sơ khách hàng + lịch sử báo giá/đơn (FR-SAL-01). Server component: đọc KH
 * + danh sách báo giá/đơn của KH rồi giao cho client render (tabs, bảng).
 */
export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
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

  const [
    { rows: quotes },
    orders,
    changes,
    { data: salesMembers },
    { count: productCount },
  ] = await Promise.all([
    quotesService.list(user, { customer_id: id, page: 1, page_size: 500 }),
    ordersService.listByCustomer(user, id),
    ordersRepo.listChangesByCustomer(id),
    db().from('users').select('id, name, email').eq('is_active', true).order('name'),
    // "Dùng ở đâu": SP trong thư viện gắn khách này — chỉ đếm.
    db()
      .from('technical_products')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', id),
  ])
  // Giá trị từng đơn — thống kê tiền (doanh số năm, TB đơn) tính phía client.
  const totals = await ordersRepo.totalsByOrderIds(orders.map((o) => o.id))

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
      productCount={productCount ?? 0}
      currentUserId={user.id}
      role={user.role}
      members={(salesMembers ?? []).map((m) => ({
        id: m.id,
        label: m.name ?? m.email,
      }))}
    />
  )
}
