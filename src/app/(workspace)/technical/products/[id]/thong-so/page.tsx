import { notFound } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { productsService } from '@/modules/dept/technical/technical.service'
import { HttpError } from '@/server/http'
import { ProductSpecsTab } from '@/components/technical/ProductSpecsTab'
import { toProductView } from '@/components/technical/product-sections'

/** Tab Thông số — đặc tính SP + thông số in trên LSX (+ BOM gắn kho cũ, chỉ đọc). */
export default async function ProductSpecsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = (await authService.currentUser())!
  const { id } = await params
  const canEdit = user.role === 'admin' || user.role === 'manager'

  let data
  let suggestions: Record<string, string[]> = {}
  try {
    ;[data, suggestions] = await Promise.all([
      productsService.getBom(user, id),
      productsService.fieldSuggestions(),
    ])
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound()
    throw e
  }

  return (
    <ProductSpecsTab
      product={toProductView(data.product)}
      bom={data.lines.map((l) => ({
        material_code: l.material_code,
        material_name: l.material_name,
        material_unit: l.material_unit,
        qty_per_unit: l.qty_per_unit,
        note: l.note,
      }))}
      suggestions={suggestions}
      canEdit={canEdit}
    />
  )
}
