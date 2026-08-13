import { notFound } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canEditBom, productsService } from '@/modules/dept/technical/technical.service'
import { HttpError } from '@/server/http'
import { ProductPartsTab } from '@/components/technical/ProductPartsTab'

/** Tab Định mức — chỉ nạp định mức + món trong bộ, không kéo phần hồ sơ. */
export default async function ProductPartsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await authService.requirePageUser()
  const { id } = await params
  // Định mức = BOM → luật riêng (`technical.bom.save`), không dùng cờ SP chung.
  const canEdit = await canEditBom(user)

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
      knownMaterials={data.knownMaterials}
      canEdit={canEdit}
    />
  )
}
