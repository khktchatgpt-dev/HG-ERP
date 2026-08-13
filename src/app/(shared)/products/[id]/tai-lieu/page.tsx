import { authService } from '@/modules/core/auth/auth.service'
import {
  canEditProducts,
  productsService,
} from '@/modules/dept/technical/technical.service'
import { ProductFilesPanel } from '@/components/technical/ProductFilesPanel'

/**
 * Tab Tài liệu — bản vẽ / BOM / hướng dẫn lắp ráp.
 *
 * KHOÁ/MỞ KHOÁ hồ sơ KHÔNG còn ở đây (user chốt 13/08/2026: "mọi thứ xử lí ở
 * trang chi tiết chính") — nút nằm ở header, dùng chung cho mọi tab. Tab này
 * chỉ giữ đúng việc của nó: danh sách file, và nút "Dùng bản này" để chỉ rõ
 * bản BOM đang dùng khi có nhiều file (tiện ích, không bắt buộc).
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
  const unlocked = product.locked_at == null

  return (
    <div className="pb-6">
      <ProductFilesPanel
        productId={id}
        canEdit={canEdit && unlocked}
        bomFileId={product.bom_file_id}
        canSetBomFile={canEdit && unlocked}
      />
    </div>
  )
}
