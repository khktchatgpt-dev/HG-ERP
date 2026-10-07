import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { quotesRepo } from '@/modules/dept/sales/quotes.repo'
import { quotesService } from '@/modules/dept/sales/quotes.service'
import { customersRepo } from '@/modules/dept/sales/sales.repo'
import { quoteNetPrice } from '@/lib/quote-price'
import { SoBaoGiaScreen } from './SoBaoGiaScreen'
import type { BaoGiaRow } from './so-bao-gia.shared'

/**
 * Sổ BÁO GIÁ (khuôn C, kiểu ERP — 07/10/2026). Gác quyền qua RBAC; tải song
 * song: báo giá · dòng (trị giá tham chiếu) · đơn đã ra · số bản sửa đổi · người lập.
 */
export default async function SalesQuotesPage() {
  const user = await authService.requirePageUser()
  const [canEdit, canApprove, { rows: quotes }, { rows: customers }] = await Promise.all([
    canAction(user, 'sales.quote.manage'),
    canAction(user, 'sales.quote.approve'),
    quotesService.list(user, { page: 1, page_size: 500 }),
    customersRepo.list({ status: 'all', page: 1, page_size: 1000 }),
  ])
  const ids = quotes.map((q) => q.id)
  const [lines, orders, revisions, ownerNames] = await Promise.all([
    quotesRepo.linesByQuoteIds(ids),
    quotesRepo.ordersByQuoteIds(ids),
    quotesRepo.revisionCountByIds(ids),
    quotesRepo.ownerNamesByIds(
      quotes.map((q) => q.created_by).filter(Boolean) as string[],
    ),
  ])
  const linesBy = new Map<string, typeof lines>()
  for (const l of lines) {
    const arr = linesBy.get(l.quote_id) ?? []
    arr.push(l)
    linesBy.set(l.quote_id, arr)
  }

  const rows: BaoGiaRow[] = quotes.map((q) => {
    const ls = linesBy.get(q.id) ?? []
    return {
      id: q.id,
      code: q.code,
      customer_id: q.customer_id,
      customer_name: q.customer_name,
      status: q.status,
      currency: q.currency,
      revision_no: q.revision_no,
      revision_of: q.revision_of,
      valid_from: q.valid_from,
      valid_to: q.valid_to,
      price_term: q.price_term,
      created_at: q.created_at,
      created_by: q.created_by,
      owner_name: q.created_by ? (ownerNames.get(q.created_by) ?? null) : null,
      line_count: ls.length,
      ref_value: ls.reduce(
        (s, l) => s + (l.qty ?? 0) * quoteNetPrice(l.unit_price, l.discount_pct),
        0,
      ),
      lines_no_qty: ls.filter((l) => !l.qty).length,
      orders: (orders.get(q.id) ?? []).map((o) => ({ id: o.id, code: o.code })),
      revisions: revisions.get(q.id) ?? 0,
      updated_at: q.updated_at,
    }
  })

  return (
    <SoBaoGiaScreen
      rows={rows}
      me={{ id: user.id, ownsCustomers: customers.some((c) => c.owner_id === user.id) }}
      canEdit={canEdit}
      canApprove={canApprove}
    />
  )
}
