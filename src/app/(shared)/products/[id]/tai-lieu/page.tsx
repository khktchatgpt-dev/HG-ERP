import { authService } from '@/modules/core/auth/auth.service'
import {
  canEditBom,
  canEditProducts,
  canLockProducts,
  productsService,
} from '@/modules/dept/technical/technical.service'
import { filesService } from '@/modules/core/files/files.service'
import { usersRepo } from '@/modules/core/users/users.repo'
import { ProductFilesPanel } from '@/components/technical/ProductFilesPanel'
import { BomControlPanel } from '@/components/technical/BomControlPanel'

const dt = (s: string | null) => (s ? new Date(s).toLocaleString('vi-VN') : null)

/** Tab Tài liệu — bản vẽ / BOM / hướng dẫn lắp ráp. Panel file tự nạp danh sách
 *  phía client; khối KIỂM SOÁT BẢN DÙNG (0140) cần dữ liệu SP nên nạp ở đây. */
export default async function ProductFilesPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await authService.requirePageUser()
  const { id } = await params
  const [canEdit, canLock, canBom, product] = await Promise.all([
    canEditProducts(user),
    canLockProducts(user),
    canEditBom(user),
    productsService.get(user, id),
  ])

  const files = await filesService.listForProduct(user, id).catch(() => [])
  const boms = files.filter((f) => f.doc_type === 'bom')
  const bomFile = boms.find((f) => f.id === product.bom_file_id) ?? null

  // Tên người khoá — hiện thẳng trên khối thay vì một uuid vô nghĩa.
  const actorIds = [product.locked_by].filter(Boolean) as string[]
  const actors = actorIds.length > 0 ? await usersRepo.list() : []
  const nameOf = (uid: string | null) =>
    uid ? (actors.find((u) => u.id === uid)?.name ?? null) : null

  return (
    <div className="flex flex-col gap-3 pb-6">
      <BomControlPanel
        productId={id}
        locked={product.locked_at != null}
        lockedAtLabel={dt(product.locked_at)}
        lockedByName={nameOf(product.locked_by)}
        lockNote={product.lock_note}
        bomCheckedAtLabel={dt(product.bom_checked_at)}
        bomFileName={bomFile?.filename ?? null}
        bomFileCount={boms.length}
        unlockedAtLabel={dt(product.unlocked_at)}
        unlockReason={product.unlock_reason}
        canLock={canLock}
        canEditBom={canBom}
      />
      <ProductFilesPanel
        productId={id}
        canEdit={canEdit && product.locked_at == null}
        bomFileId={product.bom_file_id}
        canSetBomFile={canEdit && product.locked_at == null}
      />
    </div>
  )
}
