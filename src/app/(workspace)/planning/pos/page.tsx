import { authService } from '@/modules/core/auth/auth.service'
import { posService } from '@/modules/dept/supply/pos.service'
import { posRepo } from '@/modules/dept/supply/pos.repo'
import { supplyRepo } from '@/modules/dept/supply/supply.repo'
import { suppliersService, isSupplyStaff } from '@/modules/dept/supply/suppliers.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { rbacRepo } from '@/modules/core/rbac/rbac.repo'
import { usersRepo } from '@/modules/core/users/users.repo'
import { PosManager } from './PosManager'

/**
 * Quản lý đơn đặt hàng. Soạn / sửa / nhân bản đơn đều ở trang riêng
 * (`/planning/pos/new`, `/planning/pos/[id]/edit`) nên trang này KHÔNG nạp danh
 * mục vật tư — trước đây kéo 1.000 vật tư chỉ để nuôi form sửa trong modal.
 *
 * Có nạp DANH SÁCH LSX ĐANG CHẠY, và chỉ 4 trường nhẹ. Trang xếp đơn theo lệnh
 * nên phải biết cả những lệnh CHƯA có đơn nào — thứ mà bảng đơn không thể suy
 * ra, vì lệnh chưa đặt gì thì đơn giản là không có dòng nào nhắc tới nó.
 *
 * Quyền (0128): `canEdit` = là NV cung ứng (điều kiện nền); thao tác trên TỪNG
 * đơn còn xét người phụ trách — PosManager tính theo `meId`/`canManageAny`,
 * server enforce lại trong pos.service (assertPoOwner).
 */
export default async function PlanningPosPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const user = await authService.requirePageUser()
  const [supplyStaff, canManageAny, canApprove] = await Promise.all([
    isSupplyStaff(user),
    canAction(user, 'supply.po.manage_any'),
    canAction(user, 'supply.po.approve'),
  ])
  const canEdit = user.role === 'admin' || supplyStaff
  // `?view=<id>`: form soạn đơn redirect về đây sau khi LƯU NHÁP (0116) — mở
  // ngay chi tiết đơn vừa tạo để người soạn kiểm tra rồi bấm "Gửi GĐ duyệt".
  const { view } = await searchParams

  const [{ rows: pos }, { rows: suppliers }, lsxs] = await Promise.all([
    posService.list(user, { page: 1, page_size: 300 }),
    suppliersService.list(user, { active_only: true, page: 1, page_size: 500 }),
    productionRepo.listActive(),
  ])

  // Tổng tiền + tiến độ về kho theo dòng, mỗi thứ 1 truy vấn gộp — cột Giá trị
  // và cột "Về kho x/y dòng" (0126).
  const [totals, lineDone] = await Promise.all([
    posRepo.totalsByPoIds(pos.map((p) => p.id)),
    supplyRepo.lineDoneByPoIds(pos.map((p) => p.id)),
  ])

  /*
   * Danh sách NV cung ứng nhận BÀN GIAO (0128) — chỉ nạp cho người bàn giao được.
   * Loại tài khoản `admin`: vai admin được seed ĐỦ MỌI permission trong DB (kể cả
   * supply.member), nên lọc thuần theo quyền sẽ kéo cả IT lẫn Giám đốc vào ô
   * "chọn nhân viên cung ứng". Họ vốn thao tác được mọi đơn nhờ bypass — không
   * ai cần bàn giao đơn cho họ.
   */
  let staff: { id: string; name: string }[] = []
  if (canManageAny || canApprove) {
    const memberIds = new Set(await rbacRepo.userIdsWithPermission('supply.member'))
    staff = (await usersRepo.list({ active_only: true }))
      .filter((u) => u.role !== 'admin' && memberIds.has(u.id))
      .map((u) => ({ id: u.id, name: u.name ?? u.email }))
  }

  return (
    <PosManager
      pos={pos.map((p) => ({
        ...p,
        total: totals[p.id] ?? 0,
        lines_done: lineDone.get(p.id)?.done ?? 0,
        lines_total: lineDone.get(p.id)?.total ?? 0,
      }))}
      suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
      lsxs={lsxs.map((l) => ({
        id: l.id,
        code: l.code,
        order_codes: l.order_codes,
        customer_name: l.customer_name,
        materials_due_at: l.materials_due_at,
      }))}
      canEdit={!!canEdit}
      canApprove={canApprove}
      canManageAny={user.role === 'admin' || canManageAny}
      meId={user.id}
      staff={staff}
      openId={view ?? null}
    />
  )
}
