import { notFound } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import {
  canEditProducts,
  productsService,
} from '@/modules/dept/technical/technical.service'
import { HttpError } from '@/server/http'
import { ProductSpecsTab } from '@/components/technical/ProductSpecsTab'
import { toProductView } from '@/components/technical/product-sections'

/** Tab Thông số — đặc tính SP + thông số in trên LSX. Định mức nằm ở tab riêng. */
export default async function ProductSpecsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await authService.requirePageUser()
  const { id } = await params
  const canEdit = await canEditProducts(user)

  let data
  let suggestions: Record<string, string[]> = {}
  try {
    ;[data, suggestions] = await Promise.all([
      productsService.getProfileInfo(user, id),
      productsService.fieldSuggestions(),
    ])
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound()
    throw e
  }

  return (
    <ProductSpecsTab
      product={toProductView(data.product)}
      // Phương án đóng gói chỉ để BÙ mấy ô CBM/thùng hiện chỉ-đọc ở đây — cùng
      // nguồn với tab Đóng gói, tránh hai trang nói hai số khác nhau.
      packingOptions={data.packing}
      // Số dòng định mức THẬT trong app — thẻ "Số liệu từ định mức" cần, để
      // phân biệt với `part_count` chép từ file Excel.
      bomRows={data.bomRows}
      suggestions={suggestions}
      canEdit={canEdit}
    />
  )
}
