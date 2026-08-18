import { notFound } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { posService } from '@/modules/dept/supply/pos.service'
import { isSupplyStaff } from '@/modules/dept/supply/suppliers.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { rbacRepo } from '@/modules/core/rbac/rbac.repo'
import { usersRepo } from '@/modules/core/users/users.repo'
import { approvalEventsRepo } from '@/modules/core/approvals/approvals.repo'
import { HttpError } from '@/server/http'
import { PoDetailScreen } from './PoDetailScreen'

/**
 * CHI TIẾT MỘT ĐƠN ĐẶT VẬT TƯ — trang thật, thay cho modal.
 *
 * Modal cũ nhét chuỗi liên kết, stepper 8 bước, bảng dòng hàng, hồ sơ đính kèm
 * và tám nút thao tác vào một khung `max-w-4xl`; đơn hai chục dòng là phải cuộn
 * trong cuộn. Nặng hơn: nó không có URL — không gửi được cho đồng nghiệp "xem
 * hộ đơn này", F5 là mất, back/forward sai, và không mở nổi hai đơn cạnh nhau
 * để so.
 *
 * Quyền giống hệt màn danh sách và server vẫn enforce lại trong `pos.service`
 * (assertPoOwner) — mọi thứ tính ở đây chỉ để ẨN NÚT, không phải để chặn.
 */
export default async function PoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await authService.requirePageUser()

  const [supplyStaff, canManageAny, canApprove] = await Promise.all([
    isSupplyStaff(user),
    canAction(user, 'supply.po.manage_any'),
    canAction(user, 'supply.po.approve'),
  ])

  // Đơn không tồn tại → 404 của Next, không phải màn lỗi đỏ: gõ nhầm id trên
  // thanh địa chỉ là chuyện thường, không phải sự cố.
  let detail
  try {
    detail = await posService.detail(user, id)
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound()
    throw e
  }
  const { po, lines, status_lines, extra_lsx, warehouse_docs } = detail

  const [history, shipments] = await Promise.all([
    approvalEventsRepo.listByEntity('po', po.id),
    posService.listShipments(user, po.id),
  ])

  /*
   * NV cung ứng nhận BÀN GIAO (0128) — chỉ nạp cho người bàn giao được. Loại
   * tài khoản `admin`: vai admin được seed ĐỦ mọi permission nên lọc thuần theo
   * quyền sẽ kéo cả IT lẫn Giám đốc vào ô chọn. Giống hệt màn danh sách.
   */
  let staff: { id: string; name: string }[] = []
  if (canManageAny || canApprove) {
    const memberIds = new Set(await rbacRepo.userIdsWithPermission('supply.member'))
    staff = (await usersRepo.list({ active_only: true }))
      .filter((u) => u.role !== 'admin' && memberIds.has(u.id))
      .map((u) => ({ id: u.id, name: u.name ?? u.email }))
  }

  const isSupply = user.role === 'admin' || supplyStaff
  const manageAny = user.role === 'admin' || canManageAny
  // Quyền GHI trên ĐƠN NÀY (0128): người phụ trách, trưởng phòng CƯ, hoặc admin.
  const canEdit =
    isSupply && (manageAny || (po.assigned_to != null && po.assigned_to === user.id))

  return (
    <PoDetailScreen
      po={{
        id: po.id,
        code: po.code,
        status: po.status,
        template: po.template,
        supplier_id: po.supplier_id,
        supplier_name: po.supplier_name,
        lsx_code: po.lsx_code,
        order_code: po.order_code,
        production_order_id: po.production_order_id,
        currency: po.currency,
        vat_rate: po.vat_rate,
        price_includes_vat: po.price_includes_vat,
        discount_amount: po.discount_amount,
        contract_no: po.contract_no,
        expected_at: po.expected_at,
        terms: po.terms,
        terms_quality: po.terms_quality,
        terms_delivery_place: po.terms_delivery_place,
        terms_payment: po.terms_payment,
        terms_invoice: po.terms_invoice,
        terms_lead_time: po.terms_lead_time,
        note: po.note,
        signer_role: po.signer_role,
        assigned_to: po.assigned_to,
        assignee_name: po.assignee_name,
        approved_at: po.approved_at,
        ordered_at: po.ordered_at,
        confirmed_at: po.confirmed_at,
        confirmed_note: po.confirmed_note,
        created_at: po.created_at,
      }}
      lines={lines}
      statusLines={status_lines}
      extraLsx={extra_lsx}
      shipments={shipments}
      history={history}
      warehouseDocs={warehouse_docs}
      canEdit={canEdit}
      isSupply={isSupply}
      canApprove={canApprove}
      canReassign={manageAny || canApprove}
      staff={staff}
    />
  )
}
