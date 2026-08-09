import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { customersRepo } from '@/modules/dept/sales/sales.repo'
import { QuoteForm } from '@/components/sales/QuoteForm'

/**
 * Trang lập báo giá (trang riêng, bố cục rộng, hiện đủ quy cách SP).
 *
 * KHÔNG nạp thư viện SP ở đây: ô chọn SP tự tìm ở server khi sale mở nó. Trước
 * đây trang này kéo 537 SP × 49 cột (~715 kB egress Supabase) mỗi lần mở, chỉ để
 * đổ vào một cái `<select>`.
 *
 * `?customer=<id>` chọn sẵn khách — nút "Lập báo giá" ở hồ sơ KH / danh sách KH
 * dùng nó để sale không phải tìm lại khách vừa xem.
 */
export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string }>
}) {
  const user = await authService.requirePageUser()
  const dept = user.department_id
    ? await departmentsRepo.findById(user.department_id)
    : null
  const canEdit = user.role === 'admin' || dept?.name === 'Bán Hàng'
  if (!canEdit) redirect('/sales/quotes')

  const { customer: preselect } = await searchParams
  const { rows: customers } = await customersRepo.list({
    status: 'active',
    page: 1,
    page_size: 1000,
  })

  return (
    <QuoteForm
      mode="create"
      customers={customers.map((c) => ({
        id: c.id,
        name: c.name,
        default_currency: c.default_currency,
        default_price_term: c.default_price_term,
        default_payment_terms: c.default_payment_terms,
      }))}
      // Chỉ nhận id thật có trong danh sách KH đang giao dịch — param bịa thì bỏ qua.
      preselectCustomerId={
        preselect && customers.some((c) => c.id === preselect) ? preselect : undefined
      }
      lineProducts={[]}
    />
  )
}
