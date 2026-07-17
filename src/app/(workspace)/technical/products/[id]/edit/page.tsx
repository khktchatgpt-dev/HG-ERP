import { notFound, redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { productsService } from '@/modules/dept/technical/technical.service'
import { customersRepo } from '@/modules/dept/sales/sales.repo'
import { HttpError } from '@/server/http'
import { ProductForm, type ProductFull } from '@/components/technical/ProductForm'

/** Trang Sửa sản phẩm (trang riêng thay modal) — nạp SP đầy đủ. */
export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = (await authService.currentUser())!
  const { id } = await params
  const canEdit = user.role === 'admin' || user.role === 'manager'
  if (!canEdit) redirect(`/technical/products/${id}`)

  let product
  try {
    product = await productsService.get(user, id)
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound()
    throw e
  }

  const { rows: customers } = await customersRepo.list({
    active_only: true,
    page: 1,
    page_size: 1000,
  })

  const initial: ProductFull = {
    id: product.id,
    image_file_id: product.image_file_id,
    code: product.code,
    name: product.name,
    category: product.category,
    customer_id: product.customer_id,
    customer_item_code: product.customer_item_code,
    description_en: product.description_en,
    unit: product.unit,
    bom_status: product.bom_status,
    packing: product.packing ?? {},
    notes: product.notes,
    name_foreign: product.name_foreign,
    shipping_mark: product.shipping_mark,
    barcode: product.barcode,
    showroom_sample: product.showroom_sample,
    reference_price: product.reference_price,
    tech_spec: product.tech_spec ?? {},
    hs_code: product.hs_code,
    origin_country: product.origin_country,
    material: product.material,
    max_load_kg: product.max_load_kg,
    assembly: product.assembly,
    set_contents: product.set_contents,
  }

  return (
    <ProductForm
      mode="edit"
      initial={initial}
      customers={customers.map((c) => ({ id: c.id, name: c.name }))}
    />
  )
}
