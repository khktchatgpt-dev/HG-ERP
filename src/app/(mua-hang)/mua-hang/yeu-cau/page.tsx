import { todayVn } from '@/lib/date-vn'
import { authService } from '@/modules/core/auth/auth.service'
import { buildLsxSupplyRows } from '@/modules/dept/supply/lsx-supply.service'
import { isSupplyStaff } from '@/modules/dept/supply/suppliers.service'
import { assessMeetingRisk } from '@/lib/supply-meeting'
import { YeuCauScreen } from './YeuCauScreen'
import { posRepo } from '@/modules/dept/supply/pos.repo'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { defaultScope, myLsxIds, parseScope } from '@/lib/supply-scope'

export const metadata = { title: 'Mua hàng · Vật tư theo lệnh' }
export const dynamic = 'force-dynamic'

/**
 * VẬT TƯ THEO LỆNH — Khuôn C, dựng bằng kit (Đợt 3, 15/09/2026).
 *
 * Thay trang tạm. Đây là chỗ nút "Vật tư theo lệnh" ở màn Đơn mua dẫn tới, và
 * tới 15/09 nó mở ra một trang "Chưa dựng theo sổ thiết kế mới" — chủ dự án
 * báo đúng: "phần vật tư theo lệnh sao tôi thấy trống không".
 *
 * Câu trang trả lời: "Lệnh nào còn thiếu đồ, cần đặt gì?" — nên trục chính là
 * MỨC RỦI RO, không phải danh sách lệnh xếp theo mã. Mỗi dòng nói ba điều mà
 * người mua cần để quyết: vướng gì, ai đang cầm bóng, làm gì tiếp.
 *
 * KHÔNG VIẾT SERVICE MỚI: `buildLsxSupplyRows` + `assessMeetingRisk` là đúng
 * hai thứ `/planning/lsx`, ba trang Họp và file Excel họp đang dùng — một
 * nguồn số cho tất cả, nên màn này không thể nói khác bảng họp.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ pham_vi?: string; muc?: string }>
}) {
  const sp = await searchParams
  const user = await authService.requirePageUser()
  const today = todayVn()
  const [rows, supplyStaff, owned, canApprove] = await Promise.all([
    buildLsxSupplyRows(user, today),
    isSupplyStaff(user),
    posRepo.listOwnership(),
    user.role === 'admin' ? Promise.resolve(true) : canAction(user, 'supply.po.approve'),
  ])
  // Lệnh của tôi = lệnh có đơn của tôi (lib/supply-scope) — gồm lệnh gộp.
  const mine = myLsxIds(owned, user.id)

  return (
    <YeuCauScreen
      today={today}
      rows={rows.map((r) => {
        const risk = assessMeetingRisk(r, today)
        return {
          id: r.id,
          code: r.code,
          customer_name: r.customer_name,
          order_codes: r.order_codes,
          ship_date: r.ship_date,
          materials_due_at: r.materials_due_at,
          products: r.products.length,
          posTotal: r.posTotal,
          posUnsent: r.posUnsent,
          posOpen: r.posOpen,
          posLate: r.posLate,
          level: risk.level,
          reason: risk.reason,
          owner: risk.owner,
          action: risk.action,
          mine: mine.has(r.id),
          // Người đảm nhận = người phụ trách các đơn trên lệnh (0128) — màn
          // /planning/lsx đã bày, màn mới làm rơi (đo 27/09/2026).
          buyers: [...new Set(r.pos.map((p) => p.assignee_name).filter((x): x is string => !!x))],
        }
      })}
      canEdit={user.role === 'admin' || supplyStaff}
      meId={user.id}
      defaultScope={defaultScope({ canApprove })}
      urlScope={parseScope(sp.pham_vi)}
      initialMuc={sp.muc ?? null}
    />
  )
}
