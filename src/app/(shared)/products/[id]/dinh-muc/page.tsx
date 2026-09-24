import { notFound } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { catalogsService } from '@/modules/core/catalogs/catalogs.service'
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

  // Danh mục công đoạn — để Kỹ thuật KHAI lộ trình của cụm (0097 đã có chỗ lưu
  // `first_stage`/`final_stage`, nhưng chưa màn nào cho gõ vào). Không hằng số
  // hoá 12 mã ở client: danh mục sửa được ở /admin, hằng số hoá là drift.
  const stages = (await catalogsService.list(user, 'production_stage'))
    .filter((s) => s.is_active)
    .map((s) => ({ code: s.code, label: s.label }))

  return (
    <ProductPartsTab
      productId={id}
      parts={data.parts}
      partGroups={data.groups}
      clusters={data.clusters}
      stages={stages}
      setItems={data.setItems}
      paintCoverage={data.product.paint_coverage_m2_per_kg ?? null}
      actualWeightKg={data.product.actual_weight_kg ?? null}
      baseMaterial={data.product.base_material ?? null}
      canEdit={canEdit}
    />
  )
}
