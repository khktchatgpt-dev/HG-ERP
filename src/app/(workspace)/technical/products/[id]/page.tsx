import { notFound } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { productsService } from '@/modules/dept/technical/technical.service'
import { customersRepo } from '@/modules/dept/sales/sales.repo'
import { filesService } from '@/modules/core/files/files.service'
import { HttpError } from '@/server/http'
import {
  ProductDetailView,
  type ProductView,
} from '@/components/technical/ProductDetailView'

/** Trang chi tiết sản phẩm (tách riêng khỏi thư viện) — đủ trường + ảnh + BOM. */
export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = (await authService.currentUser())!
  const { id } = await params
  const canEdit = user.role === 'admin' || user.role === 'manager'

  let data
  try {
    data = await productsService.getBom(user, id)
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound()
    throw e
  }
  const { product, lines } = data

  const [customer, imageUrl] = await Promise.all([
    product.customer_id
      ? customersRepo.findById(product.customer_id).catch(() => null)
      : null,
    product.image_file_id
      ? filesService.getDownloadUrl(user, product.image_file_id).catch(() => null)
      : null,
  ])

  const view: ProductView = {
    id: product.id,
    code: product.code,
    name: product.name,
    category: product.category,
    customer_item_code: product.customer_item_code,
    description_en: product.description_en,
    unit: product.unit,
    bom_status: product.bom_status,
    packing: product.packing ?? {},
    image_file_id: product.image_file_id,
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
    is_active: product.is_active,
  }

  return (
    <ProductDetailView
      product={view}
      customerName={customer?.name ?? null}
      imageUrl={imageUrl}
      bom={lines.map((l) => ({
        material_code: l.material_code,
        material_name: l.material_name,
        material_unit: l.material_unit,
        qty_per_unit: l.qty_per_unit,
        note: l.note,
      }))}
      canEdit={canEdit}
    />
  )
}
