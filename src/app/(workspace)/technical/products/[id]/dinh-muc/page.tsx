import { notFound } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { productsService } from '@/modules/dept/technical/technical.service'
import { HttpError } from '@/server/http'
import { ProductPartsTab } from '@/components/technical/ProductPartsTab'

/** Tab Định mức — chỉ nạp định mức + món trong bộ, không kéo phần hồ sơ. */
export default async function ProductPartsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = (await authService.currentUser())!
  const { id } = await params
  const canEdit = user.role === 'admin' || user.role === 'manager'

  let data
  try {
    data = await productsService.getPartsInfo(user, id)
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound()
    throw e
  }

  return (
    <ProductPartsTab
      productId={id}
      parts={data.parts}
      partGroups={data.groups}
      clusters={data.clusters}
      setItems={data.setItems}
      paintCoverage={data.product.paint_coverage_m2_per_kg ?? null}
      baseMaterial={data.product.base_material ?? null}
      canEdit={canEdit}
    />
  )
}
