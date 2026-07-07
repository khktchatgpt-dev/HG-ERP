import { authService } from '@/modules/core/auth/auth.service'
import { quotesService } from '@/modules/dept/sales/quotes.service'
import { db } from '@/server/db'
import { ApprovalsManager } from './ApprovalsManager'

/**
 * Màn phê duyệt tập trung (FR-ADM-03): báo giá chờ duyệt + đơn đặt vật tư chờ
 * duyệt (PO — sẽ đổ dữ liệu khi sprint Cung ứng xong; bảng đã có sẵn).
 */
export default async function ExecApprovalsPage() {
  const user = (await authService.currentUser())!

  const [{ rows: pendingQuotes }, { count: pendingPoCount }] = await Promise.all([
    quotesService.list(user, { status: 'pending', page: 1, page_size: 200 }),
    db()
      .from('supply_purchase_orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending_approval'),
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
      pendingPoCount={pendingPoCount ?? 0}
    />
  )
}
