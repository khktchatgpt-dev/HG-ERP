import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { productsService } from '@/modules/dept/technical/technical.service'
import { catalogsService } from '@/modules/core/catalogs/catalogs.service'
import { FRAME_MATERIALS, PRODUCT_TYPES } from '@/lib/product-code'
import { ProductForm } from '@/components/technical/ProductForm'

/** Trang Thêm sản phẩm — chỉ phần nhận diện, phần còn lại điền ở trang chi tiết. */
export default async function NewProductPage() {
  const user = (await authService.currentUser())!
  const canEdit = user.role === 'admin' || user.role === 'manager'
  if (!canEdit) redirect('/technical/products')

  const defaultType = PRODUCT_TYPES[0].code
  const defaultMaterial = FRAME_MATERIALS[0].code

  // Nhãn khách/nhóm chỉ để GỢI Ý khi gõ — không ràng buộc danh mục khách (0091).
  // Mã đầu tiên cấp luôn ở server: mở form là thấy mã, khỏi chớp một nhịp trống.
  const [names, initialCode, catalog] = await Promise.all([
    productsService.customerNames(),
    productsService.nextCode(user, defaultType, defaultMaterial),
    catalogsService.list(user, 'product_category'),
  ])

  return (
    <ProductForm
      defaultType={defaultType}
      defaultMaterial={defaultMaterial}
      initialCode={initialCode}
      customerNames={names.map((n) => n.name)}
      categories={catalog
        .filter((c) => c.is_active)
        .map((c) => ({ code: c.code, label: c.label }))}
    />
  )
}
