import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canCreateProducts } from '@/modules/dept/technical/technical.service'
import { productImportService } from '@/modules/dept/technical/product-import.service'
import { NhapExcelScreen } from './NhapExcelScreen'

/**
 * Thêm sản phẩm hàng loạt từ Excel (07/10/2026). Cùng quyền với "Thêm sản
 * phẩm" — không có quyền thì về thư viện, nút đã khoá sẵn ở đó.
 */
export default async function NhapExcelPage() {
  const user = await authService.requirePageUser()
  if (!(await canCreateProducts(user))) redirect('/products')
  // Ba con số cột "Thư viện hiện có" của màn chưa chọn file.
  const facts = await productImportService.libraryFacts()
  return <NhapExcelScreen facts={facts} />
}
