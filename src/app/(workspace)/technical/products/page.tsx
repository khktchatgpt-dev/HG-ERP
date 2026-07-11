import { authService } from '@/modules/core/auth/auth.service'
import { productsService } from '@/modules/dept/technical/technical.service'
import { customersRepo } from '@/modules/dept/sales/sales.repo'
import { materialsRepo } from '@/modules/dept/warehouse/warehouse.repo'
import { ProductsManager } from './ProductsManager'

export default async function TechnicalProductsPage() {
  const user = (await authService.currentUser())!
  const canEdit = user.role === 'admin' || user.role === 'manager'

  // Vật tư nạp trực tiếp từ repo (read-only) cho BOM editor — API kho guard
  // theo phòng Kho nên không gọi qua service kho được từ đây.
  const [{ rows }, { rows: customers }, { rows: materials }] = await Promise.all([
    productsService.list(user, { page: 1, page_size: 1000, active_only: false }),
    customersRepo.list({ active_only: true, page: 1, page_size: 1000 }),
    materialsRepo.list({ active_only: true, page: 1, page_size: 1000 }),
  ])

  return (
    <ProductsManager
      products={rows.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        category: p.category,
        customer_id: p.customer_id,
        customer_item_code: p.customer_item_code,
        description_en: p.description_en,
        unit: p.unit,
        bom_status: p.bom_status,
        packing: p.packing ?? {},
        drawing_url: p.drawing_url,
        bom_url: p.bom_url,
        image_file_id: p.image_file_id,
        notes: p.notes,
        name_de: p.name_de,
        shipping_mark: p.shipping_mark,
        barcode: p.barcode,
        showroom_sample: p.showroom_sample,
        reference_price: p.reference_price,
        tech_spec: p.tech_spec ?? {},
        hs_code: p.hs_code,
        origin_country: p.origin_country,
        material: p.material,
        max_load_kg: p.max_load_kg,
        assembly: p.assembly,
        set_contents: p.set_contents,
        is_active: p.is_active,
      }))}
      customers={customers.map((c) => ({ id: c.id, name: c.name }))}
      materials={materials.map((m) => ({
        id: m.id,
        code: m.code,
        name: m.name,
        unit: m.unit,
      }))}
      canEdit={canEdit}
    />
  )
}
