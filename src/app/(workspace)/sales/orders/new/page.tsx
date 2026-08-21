import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { quotesService } from '@/modules/dept/sales/quotes.service'
import { customersRepo } from '@/modules/dept/sales/sales.repo'
import { OrderForm } from '@/components/sales/OrderForm'

/** Trang riêng tạo đơn hàng (thay modal chật) — bố cục rộng, có tạo nhanh SP. */
export default async function NewOrderPage() {
  const user = await authService.requirePageUser()
  const dept = user.department_id
    ? await departmentsRepo.findById(user.department_id)
    : null
  const canEdit = user.role === 'admin' || dept?.name === 'Bán Hàng'
  if (!canEdit) redirect('/sales/orders')

  // Không nạp thư viện SP nữa: form tạo đơn bắt đầu từ 0 dòng, ô chọn SP tự tìm
  // ở server khi Sales mở nó (xem ProductPicker).
  const [{ rows: sentQuotes }, { rows: customers }] = await Promise.all([
    quotesService.list(user, { status: 'sent', page: 1, page_size: 500 }),
    customersRepo.list({ status: 'active', page: 1, page_size: 1000 }),
  ])

  return (
    <OrderForm
      mode="create"
      customers={customers.map((c) => ({ id: c.id, name: c.name }))}
      lineProducts={[]}
      sentQuotes={sentQuotes.map((q) => ({
        id: q.id,
        code: q.code,
        customer_name: q.customer_name,
        currency: q.currency,
      }))}
    />
  )
}
