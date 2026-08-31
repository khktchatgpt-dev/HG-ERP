import { notFound } from 'next/navigation'
import { fileImageSrc } from '@/server/file-image'
import { authService } from '@/modules/core/auth/auth.service'
import {
  canEditProducts,
  productsService,
} from '@/modules/dept/technical/technical.service'
import { catalogsService } from '@/modules/core/catalogs/catalogs.service'
import { usersRepo } from '@/modules/core/users/users.repo'
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
  const user = await authService.requirePageUser()
  const { id } = await params
  const canEdit = await canEditProducts(user)

  let data
  // Giá trị đã dùng ở SP khác → datalist gợi ý cho các ô gõ tự do khi sửa.
  let suggestions: Record<string, string[]> = {}
  // Danh mục SP là danh mục dùng chung (admin quản lý ở /admin/catalogs) — đổ vào
  // ô "Danh mục" dạng select thay vì để gõ tự do.
  let categories: { code: string; label: string }[] = []
  // Nhân sự đang làm việc — đổ vào ô "Người phụ trách" (0144). Không lọc theo
  // phòng: hồ sơ SP là khu dùng chung, SP của khách nào thì sale bên đó cũng có
  // thể là người cầm hồ sơ.
  let owners: { id: string; name: string }[] = []
  try {
    const [profile, suggest, catalog, staff] = await Promise.all([
      productsService.getProfileInfo(user, id),
      productsService.fieldSuggestions(),
      catalogsService.list(user, 'product_category'),
      usersRepo.list({ active_only: true }),
    ])
    data = profile
    suggestions = suggest
    categories = catalog
      .filter((c) => c.is_active)
      .map((c) => ({ code: c.code, label: c.label }))
    owners = staff.map((u) => ({ id: u.id, name: u.name || u.email }))
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound()
    throw e
  }

  // Đường dẫn cố định thay URL ký — xem `@/server/file-image` (chuyện phí tối
  // ưu ảnh của Vercel).
  const imageUrl = data.product.image_file_id
    ? fileImageSrc(data.product.image_file_id)
    : null

  return (
    <ProductProfileTab
      product={toProductView(data.product)}
      packingOptions={data.packing}
      imageUrl={imageUrl}
      suggestions={suggestions}
      categories={categories}
      owners={owners}
      // Tên tra sẵn ở server (`getProfileInfo`) chứ không dò trong `owners`:
      // danh sách đó chỉ có người ĐANG làm việc, người lập đã nghỉ sẽ mất tên.
      creatorName={data.creatorName}
      canEdit={canEdit}
    />
  )
}
