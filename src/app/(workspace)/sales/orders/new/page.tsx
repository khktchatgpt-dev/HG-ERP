import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { quotesService } from '@/modules/dept/sales/quotes.service'
import { customersRepo } from '@/modules/dept/sales/sales.repo'
import { OrderForm } from '@/components/sales/OrderForm'

/** Trang riêng tạo đơn hàng (thay modal chật) — bố cục rộng, có tạo nhanh SP. */
export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ quote?: string }>
}) {
  const user = await authService.requirePageUser()
  if (!(await canAction(user, 'sales.order.manage'))) redirect('/sales/orders')
  // Nút "Tạo đơn hàng" trên hồ sơ báo giá đã gửi → chọn sẵn báo giá đó.
  const { quote: initialQuoteId } = await searchParams

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
      initialQuoteId={initialQuoteId ?? null}
      sentQuotes={sentQuotes.map((q) => ({
        id: q.id,
        code: q.code,
        customer_name: q.customer_name,
        currency: q.currency,
      }))}
    />
  )
}
