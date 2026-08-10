import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { customersRepo } from '@/modules/dept/sales/sales.repo'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { ImportQuoteScreen } from './ImportQuoteScreen'

/**
 * Nhập báo giá từ file Excel — dành cho tờ báo giá có SẢN PHẨM MỚI (ảnh + thông
 * số đi kèm trong file). Gác quyền y như lập báo giá tay.
 */
export default async function ImportQuotePage() {
  const user = await authService.requirePageUser()
  if (!(await canAction(user, 'sales.quote.manage'))) redirect('/sales/quotes')

  const { rows } = await customersRepo.list({
    status: 'active',
    page: 1,
    page_size: 1000,
  })
  return (
    <ImportQuoteScreen
      customers={rows.map((c) => ({
        id: c.id,
        name: c.name,
        default_currency: c.default_currency,
      }))}
    />
  )
}
