import { authService } from '@/modules/core/auth/auth.service'
import { posService } from '@/modules/dept/supply/pos.service'
import { ApprovalsManager } from './ApprovalsManager'

/**
 * Màn phê duyệt tập trung (FR-ADM-03): khâu duyệt đơn đặt vật tư (BR-05).
 * Báo giá bán KHÔNG qua đây — là hồ sơ riêng của Sales, sale tự chốt.
 */
export default async function ExecApprovalsPage() {
  const user = (await authService.currentUser())!

  const { rows: pendingPos } = await posService.list(user, {
    status: 'pending_approval',
    page: 1,
    page_size: 200,
  })

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
      }))}
    />
  )
}
