import { authService } from '@/modules/core/auth/auth.service'
import {
  canEditProducts,
  productsService,
} from '@/modules/dept/technical/technical.service'
import { ProductFilesPanel } from '@/components/technical/ProductFilesPanel'

/**
 * Tab Tài liệu — bản vẽ / BOM / lắp ráp / chứng chỉ, chia tab và XEM THẲNG
 * trong trang (13/08/2026).
 *
 * KHOÁ/MỞ KHOÁ hồ sơ không ở đây (nút nằm ở header, dùng chung cho mọi tab).
 * Phần "chốt bản BOM đang dùng" (0140) cũng đã BỎ theo yêu cầu user — tab này
 * giờ chỉ làm đúng một việc: giữ và mở tài liệu.
 */
export default async function ProductFilesPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await authService.requirePageUser()
  const { id } = await params
  const [canEdit, product] = await Promise.all([
    canEditProducts(user),
    productsService.get(user, id),
  ])
  // Hồ sơ đã khoá thì không thêm/xoá tài liệu — vẫn xem và tải về bình thường.
  const unlocked = product.locked_at == null

  return (
    <div className="pb-6">
      <ProductFilesPanel productId={id} canEdit={canEdit && unlocked} />
    </div>
  )
}
