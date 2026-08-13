import { authService } from '@/modules/core/auth/auth.service'
import { posService } from '@/modules/dept/supply/pos.service'
import { posRepo } from '@/modules/dept/supply/pos.repo'
import { supplyRepo } from '@/modules/dept/supply/supply.repo'
import { suppliersService, isSupplyStaff } from '@/modules/dept/supply/suppliers.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { canAction } from '@/modules/core/rbac/rbac.service'
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

  /*
   * TRẦN SỐ ĐƠN NẠP MỘT LẦN.
   *
   * Màn này gom đơn THEO LỆNH ở client, mà gom thì phải có đủ đơn của lệnh —
   * phân trang phía server sẽ cắt một lệnh làm hai trang và cộng ra số sai ngay
   * ở đầu thẻ. Nên vẫn nạp một lượt, nhưng có trần, và trần thì phải NÓI RA:
   * bản cũ để 300 im lặng, tức khi vượt là mất đơn mà không ai biết.
   */
  const PAGE_CAP = 1000
  const [{ rows: pos }, { rows: suppliers }, lsxs] = await Promise.all([
    posService.list(user, { page: 1, page_size: PAGE_CAP }),
    suppliersService.list(user, { active_only: true, page: 1, page_size: 500 }),
    productionRepo.listActive(),
  ])
  const truncated = pos.length >= PAGE_CAP

  // Tổng tiền + tiến độ về kho theo dòng + LSX phụ, mỗi thứ 1 truy vấn gộp —
  // cột Giá trị, cột "Về kho x/y dòng" (0126) và đơn gộp nhiều lệnh (0125).
  const poIds = pos.map((p) => p.id)
  const [totals, lineDone, extraLsx] = await Promise.all([
    posRepo.totalsByPoIds(poIds),
    supplyRepo.lineDoneByPoIds(poIds),
    posRepo.extraLsxByPoIds(poIds),
  ])

  /*
   * KHÔNG nạp danh sách NV nhận bàn giao ở đây nữa: bàn giao đã chuyển hẳn sang
   * trang chi tiết đơn (`/planning/pos/[id]`), nơi có đủ ngữ cảnh để quyết. Màn
   * danh sách vì thế bớt được hai truy vấn (rbac + users) trên MỌI lần mở trang.
   */

  return (
    <PosManager
      pos={pos.map((p) => ({
        ...p,
        total: totals[p.id] ?? 0,
        lines_done: lineDone.get(p.id)?.done ?? 0,
        lines_total: lineDone.get(p.id)?.total ?? 0,
        extra_lsx: extraLsx.get(p.id) ?? [],
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
      truncatedAt={truncated ? PAGE_CAP : null}
      openId={view ?? null}
    />
  )
}
