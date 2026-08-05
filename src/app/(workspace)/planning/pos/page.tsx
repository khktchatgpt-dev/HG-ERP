import { authService } from '@/modules/core/auth/auth.service'
import { posService } from '@/modules/dept/supply/pos.service'
import { posRepo } from '@/modules/dept/supply/pos.repo'
import { suppliersService, isSupplyStaff } from '@/modules/dept/supply/suppliers.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { PosManager } from './PosManager'

/**
 * Quản lý đơn đặt hàng. Soạn / sửa / nhân bản đơn đều ở trang riêng
 * (`/planning/pos/new`, `/planning/pos/[id]/edit`) nên trang này KHÔNG nạp danh
 * mục vật tư — trước đây kéo 1.000 vật tư chỉ để nuôi form sửa trong modal.
 *
 * Có nạp DANH SÁCH LSX ĐANG CHẠY, và chỉ 4 trường nhẹ. Trang xếp đơn theo lệnh
 * nên phải biết cả những lệnh CHƯA có đơn nào — thứ mà bảng đơn không thể suy
 * ra, vì lệnh chưa đặt gì thì đơn giản là không có dòng nào nhắc tới nó.
 */
export default async function PlanningPosPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const user = (await authService.currentUser())!
  const canEdit = user.role === 'admin' || (await isSupplyStaff(user))
  const canApprove = user.role === 'admin' || user.role === 'manager'
  // `?view=<id>`: form soạn đơn redirect về đây sau khi LƯU NHÁP (0116) — mở
  // ngay chi tiết đơn vừa tạo để người soạn kiểm tra rồi bấm "Gửi GĐ duyệt".
  const { view } = await searchParams

  const [{ rows: pos }, { rows: suppliers }, lsxs] = await Promise.all([
    posService.list(user, { page: 1, page_size: 300 }),
    suppliersService.list(user, { active_only: true, page: 1, page_size: 500 }),
    productionRepo.listActive(),
  ])

  // Tổng tiền từng PO (1 truy vấn gộp) — cho cột Giá trị.
  const totals = await posRepo.totalsByPoIds(pos.map((p) => p.id))

  return (
    <PosManager
      pos={pos.map((p) => ({ ...p, total: totals[p.id] ?? 0 }))}
      suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
      lsxs={lsxs.map((l) => ({
        id: l.id,
        code: l.code,
        order_codes: l.order_codes,
        customer_name: l.customer_name,
      }))}
      canEdit={!!canEdit}
      canApprove={canApprove}
      openId={view ?? null}
    />
  )
}
