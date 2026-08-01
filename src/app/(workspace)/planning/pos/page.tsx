import { authService } from '@/modules/core/auth/auth.service'
import { posService } from '@/modules/dept/supply/pos.service'
import { posRepo } from '@/modules/dept/supply/pos.repo'
import { suppliersService, isSupplyStaff } from '@/modules/dept/supply/suppliers.service'
import { PosManager } from './PosManager'

/**
 * Danh sách đơn đặt vật tư. Soạn / sửa / nhân bản đơn đều ở trang riêng
 * (`/planning/pos/new`, `/planning/pos/[id]/edit`) nên trang này KHÔNG cần nạp
 * danh mục vật tư và LSX nữa — trước đây kéo 1.000 vật tư + 200 LSX chỉ để nuôi
 * form sửa trong modal.
 */
export default async function PlanningPosPage() {
  const user = (await authService.currentUser())!
  const canEdit = user.role === 'admin' || (await isSupplyStaff(user))
  const canApprove = user.role === 'admin' || user.role === 'manager'

  const [{ rows: pos }, { rows: suppliers }] = await Promise.all([
    posService.list(user, { page: 1, page_size: 300 }),
    suppliersService.list(user, { active_only: true, page: 1, page_size: 500 }),
  ])

  // Tổng tiền từng PO (1 truy vấn gộp) — cho cột Giá trị.
  const totals = await posRepo.totalsByPoIds(pos.map((p) => p.id))

  return (
    <PosManager
      pos={pos.map((p) => ({ ...p, total: totals[p.id] ?? 0 }))}
      suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
      canEdit={!!canEdit}
      canApprove={canApprove}
    />
  )
}
