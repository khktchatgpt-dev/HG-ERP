import { notFound } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { productsService } from '@/modules/dept/technical/technical.service'
import { filesService } from '@/modules/core/files/files.service'
import { HttpError } from '@/server/http'
import { ProductProfileTab } from '@/components/technical/ProductProfileTab'
import { toProductView } from '@/components/technical/product-sections'

/** Tab Hồ sơ — chỉ thông tin cơ bản + ảnh. Quy cách / thông số / tài liệu / định
 *  mức nằm ở tab riêng nên trang này KHÔNG nạp BOM hay phương án đóng gói. */
export default async function ProductProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = (await authService.currentUser())!
  const { id } = await params
  const canEdit = user.role === 'admin' || user.role === 'manager'

  let product
  // Giá trị đã dùng ở SP khác → datalist gợi ý cho các ô gõ tự do khi sửa.
  let suggestions: Record<string, string[]> = {}
  try {
    ;[product, suggestions] = await Promise.all([
      productsService.get(user, id),
      productsService.fieldSuggestions(),
    ])
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound()
    throw e
  }

  const imageUrl = product.image_file_id
    ? await filesService.getDownloadUrl(user, product.image_file_id).catch(() => null)
    : null

  return (
    <ProductProfileTab
      product={toProductView(product)}
      imageUrl={imageUrl}
      suggestions={suggestions}
      canEdit={canEdit}
    />
  )
}
