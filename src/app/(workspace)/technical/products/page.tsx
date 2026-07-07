import { authService } from '@/modules/core/auth/auth.service'
import { productsService } from '@/modules/dept/technical/technical.service'
import { customersRepo } from '@/modules/dept/sales/sales.repo'
import { ProductsManager } from './ProductsManager'

export default async function TechnicalProductsPage() {
  const user = (await authService.currentUser())!
  const canEdit = user.role === 'admin' || user.role === 'manager'

  const [{ rows }, { rows: customers }] = await Promise.all([
    productsService.list(user, { page: 1, page_size: 1000, active_only: false }),
    customersRepo.list({ active_only: true, page: 1, page_size: 1000 }),
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
        notes: p.notes,
        is_active: p.is_active,
      }))}
      customers={customers.map((c) => ({ id: c.id, name: c.name }))}
      canEdit={canEdit}
    />
  )
}
