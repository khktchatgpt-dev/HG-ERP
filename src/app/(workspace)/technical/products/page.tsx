import { authService } from '@/modules/core/auth/auth.service'
import { productsService } from '@/modules/dept/technical/technical.service'
import { ProductsManager } from './ProductsManager'

export default async function TechnicalProductsPage() {
  const user = (await authService.currentUser())!
  const canEdit = user.role === 'admin' || user.role === 'manager'

  const { rows } = await productsService.list(user, {
    page: 1,
    page_size: 1000,
    active_only: false,
  })

  return (
    <ProductsManager
      products={rows.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        category: p.category,
        drawing_url: p.drawing_url,
        bom_url: p.bom_url,
        notes: p.notes,
        is_active: p.is_active,
      }))}
      canEdit={canEdit}
    />
  )
}
