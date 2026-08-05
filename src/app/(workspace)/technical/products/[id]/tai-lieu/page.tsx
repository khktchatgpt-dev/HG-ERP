import { authService } from '@/modules/core/auth/auth.service'
import { canEditProducts } from '@/modules/dept/technical/technical.service'
import { ProductFilesPanel } from '@/components/technical/ProductFilesPanel'

/** Tab Tài liệu — bản vẽ / BOM / hướng dẫn lắp ráp. Panel tự nạp danh sách file
 *  phía client nên trang này không cần query gì thêm. */
export default async function ProductFilesPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = (await authService.currentUser())!
  const { id } = await params
  const canEdit = await canEditProducts(user)

  return (
    <div className="pb-6">
      <ProductFilesPanel productId={id} canEdit={canEdit} />
    </div>
  )
}
