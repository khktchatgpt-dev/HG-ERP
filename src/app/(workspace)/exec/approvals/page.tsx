import { authService } from '@/modules/core/auth/auth.service'
import { posService } from '@/modules/dept/supply/pos.service'
import { posRepo } from '@/modules/dept/supply/pos.repo'
import { productionService } from '@/modules/dept/production/production.service'
import { ApprovalsManager } from '../ApprovalsManager'

/**
 * Màn phê duyệt tập trung (FR-ADM-03): duyệt Lệnh sản xuất (FR-SAL-06) +
 * đơn đặt vật tư (BR-05). Báo giá bán KHÔNG qua đây — hồ sơ riêng của Sales.
 * (Dời từ /exec về đây 07/2026 — /exec giờ là Toàn cảnh điều hành.)
 */
export default async function ExecApprovalsPage() {
  const user = (await authService.currentUser())!

  const [{ rows: pendingPos }, { rows: pendingLsx }] = await Promise.all([
    posService.list(user, { status: 'pending_approval', page: 1, page_size: 200 }),
    productionService.list(user, {
      status: 'pending_approval',
      page: 1,
      page_size: 200,
    }),
  ])

  // GĐ cần thấy giá trị cam kết trước khi duyệt — tính tổng tiền từng PO từ lines.
  const totals = await Promise.all(
    pendingPos.map(async (p) => {
      const lines = await posRepo.listLines(p.id)
      return {
        id: p.id,
        total: lines.reduce((s, l) => s + l.qty_ordered * (l.unit_price ?? 0), 0),
        lines_count: lines.length,
      }
    }),
  )
  const totalById = new Map(totals.map((t) => [t.id, t]))

  return (
    <ApprovalsManager
      pos={pendingPos.map((p) => ({
        id: p.id,
        code: p.code,
        supplier_name: p.supplier_name,
        lsx_code: p.lsx_code,
        order_code: p.order_code,
        expected_at: p.expected_at,
        created_at: p.created_at,
        currency: p.currency,
        total: totalById.get(p.id)?.total ?? 0,
        lines_count: totalById.get(p.id)?.lines_count ?? 0,
      }))}
      lsxs={pendingLsx.map((l) => ({
        id: l.id,
        code: l.code,
        order_code: l.order_code,
        customer_name: l.customer_name,
        created_at: l.created_at,
      }))}
    />
  )
}
