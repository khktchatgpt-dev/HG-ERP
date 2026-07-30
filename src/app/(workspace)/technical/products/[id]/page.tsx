import { notFound } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { productsService } from '@/modules/dept/technical/technical.service'
import { filesService } from '@/modules/core/files/files.service'
import { catalogsService } from '@/modules/core/catalogs/catalogs.service'
import { HttpError } from '@/server/http'
import { ProductProfileTab } from '@/components/technical/ProductProfileTab'
import { toProductView } from '@/components/technical/product-sections'

/**
 * Tab Hồ sơ — thông tin cơ bản + ảnh + tóm tắt đóng gói. Định mức (có SP tới
 * 145 dòng) vẫn KHÔNG nạp ở đây — nặng, tab riêng lo. Phương án đóng gói thì
 * nhẹ (≤ vài kiện) nên nạp kèm: nhiều SP có kiện thật (import từ BOM) nhưng ô
 * tóm tắt đóng gói (nhập tay) bỏ trống — không nạp thì băng "Quy cách xuất
 * khẩu" hiện toàn "—" dù dữ liệu đã có sẵn (withPackingFallback bù chỗ trống).
 */
export default async function ProductProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = (await authService.currentUser())!
  const { id } = await params
  const canEdit = user.role === 'admin' || user.role === 'manager'

  let data
  // Giá trị đã dùng ở SP khác → datalist gợi ý cho các ô gõ tự do khi sửa.
  let suggestions: Record<string, string[]> = {}
  // Danh mục SP là danh mục dùng chung (admin quản lý ở /admin/catalogs) — đổ vào
  // ô "Danh mục" dạng select thay vì để gõ tự do.
  let categories: { code: string; label: string }[] = []
  try {
    const [profile, suggest, catalog] = await Promise.all([
      productsService.getProfileInfo(user, id),
      productsService.fieldSuggestions(),
      catalogsService.list(user, 'product_category'),
    ])
    data = profile
    suggestions = suggest
    categories = catalog
      .filter((c) => c.is_active)
      .map((c) => ({ code: c.code, label: c.label }))
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound()
    throw e
  }

  const imageUrl = data.product.image_file_id
    ? await filesService
        .getDownloadUrl(user, data.product.image_file_id)
        .catch(() => null)
    : null

  return (
    <ProductProfileTab
      product={toProductView(data.product)}
      packingOptions={data.packing}
      bomRows={data.bomRows}
      imageUrl={imageUrl}
      suggestions={suggestions}
      categories={categories}
      canEdit={canEdit}
    />
  )
}
