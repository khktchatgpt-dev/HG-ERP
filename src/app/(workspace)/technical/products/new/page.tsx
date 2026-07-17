import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { customersRepo } from '@/modules/dept/sales/sales.repo'
import { ProductForm } from '@/components/technical/ProductForm'

/** Trang Thêm sản phẩm (trang riêng, không còn modal che màn hình). */
export default async function NewProductPage() {
  const user = (await authService.currentUser())!
  const canEdit = user.role === 'admin' || user.role === 'manager'
  if (!canEdit) redirect('/technical/products')

  const { rows: customers } = await customersRepo.list({
    active_only: true,
    page: 1,
    page_size: 1000,
  })

  return (
    <ProductForm
      mode="create"
      customers={customers.map((c) => ({ id: c.id, name: c.name }))}
    />
  )
}
