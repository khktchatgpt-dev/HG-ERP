import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { quotesService } from '@/modules/dept/sales/quotes.service'
import { customersRepo } from '@/modules/dept/sales/sales.repo'
import { DonHangForm } from '../_form/DonHangForm'

/** Trang tạo đơn hàng — khuôn F (lưới nhập liệu), 07/10/2026. */
export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ quote?: string; customer?: string }>
}) {
  const user = await authService.requirePageUser()
  if (!(await canAction(user, 'sales.order.manage'))) redirect('/sales/orders')
  // Nút "Tạo đơn hàng" trên hồ sơ báo giá đã gửi → chọn sẵn báo giá đó.
  // `?customer=` từ hồ sơ khách → chọn sẵn khách, nguồn Trực tiếp.
  const { quote: initialQuoteId, customer: preselect } = await searchParams

  // Không nạp thư viện SP: form bắt đầu từ 0 dòng, ô chọn SP tự tìm ở server.
  const [{ rows: sentQuotes }, { rows: customers }] = await Promise.all([
    quotesService.list(user, { status: 'sent', page: 1, page_size: 500 }),
    customersRepo.list({ status: 'active', page: 1, page_size: 1000 }),
  ])

  return (
    <DonHangForm
      mode="create"
      customers={customers.map((c) => ({
        id: c.id,
        name: c.name,
        default_currency: c.default_currency,
        default_price_term: c.default_price_term,
        default_payment_terms: c.default_payment_terms,
        port_of_discharge: c.port_of_discharge,
      }))}
      lineProducts={[]}
      initialQuoteId={initialQuoteId ?? null}
      preselectCustomerId={
        preselect && customers.some((c) => c.id === preselect) ? preselect : undefined
      }
      sentQuotes={sentQuotes.map((q) => ({
        id: q.id,
        code: q.code,
        customer_name: q.customer_name,
        currency: q.currency,
      }))}
    />
  )
}
