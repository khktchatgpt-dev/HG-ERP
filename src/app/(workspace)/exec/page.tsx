import { authService } from '@/modules/core/auth/auth.service'
import { quotesService } from '@/modules/dept/sales/quotes.service'
import { posService } from '@/modules/dept/supply/pos.service'
import { ApprovalsManager } from './ApprovalsManager'

/**
 * Màn phê duyệt tập trung (FR-ADM-03): 2 khâu duyệt bắt buộc của đặc tả mục 6 —
 * báo giá bán (BR-04) và đơn đặt vật tư (BR-05, quan trọng nhất).
 */
export default async function ExecApprovalsPage() {
  const user = (await authService.currentUser())!

  const [{ rows: pendingQuotes }, { rows: pendingPos }] = await Promise.all([
    quotesService.list(user, { status: 'pending', page: 1, page_size: 200 }),
    posService.list(user, { status: 'pending_approval', page: 1, page_size: 200 }),
  ])

  return (
    <ApprovalsManager
      quotes={pendingQuotes.map((q) => ({
        id: q.id,
        code: q.code,
        customer_name: q.customer_name,
        currency: q.currency,
        valid_to: q.valid_to,
        created_at: q.created_at,
      }))}
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
