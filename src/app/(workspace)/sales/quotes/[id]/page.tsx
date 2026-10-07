import { notFound } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { usersRepo } from '@/modules/core/users/users.repo'
import { quotesService } from '@/modules/dept/sales/quotes.service'
import { customersRepo } from '@/modules/dept/sales/sales.repo'
import { HttpError } from '@/server/http'
import { BaoGiaScreen } from './BaoGiaScreen'

/**
 * Chi tiết BÁO GIÁ (khuôn D, kiểu ERP — 07/10/2026). Giá thành KH chỉ xuống
 * màn khi người xem có quyền (service đã gác, trang không tự thêm).
 */
export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await authService.requirePageUser()
  const { id } = await params

  let data
  try {
    data = await quotesService.detail(user, id)
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound()
    throw e
  }
  const { quote, lines, canSeeCost, planPrices, orders, revisions } = data

  const [canEdit, canApprove, { rows: customers }, names] = await Promise.all([
    canAction(user, 'sales.quote.manage'),
    canAction(user, 'sales.quote.approve'),
    customersRepo.list({ status: 'active', page: 1, page_size: 1000 }),
    usersRepo.displayNamesByIds(
      [quote.created_by, quote.submitted_by, quote.approved_by].filter(
        (v): v is string => !!v,
      ),
    ),
  ])

  const packingText = (p: (typeof lines)[number]['packing']) => {
    const k = p ?? {}
    const parts: string[] = []
    if (k.l_cm && k.w_cm && k.h_cm) parts.push(`${k.l_cm}×${k.w_cm}×${k.h_cm} cm`)
    if (k.qty_per_carton != null) parts.push(`${k.qty_per_carton}/ctn`)
    if (k.loading_40hc != null) parts.push(`${k.loading_40hc}/40HC`)
    return parts.join(' · ') || null
  }

  return (
    <BaoGiaScreen
      quote={{
        id: quote.id,
        code: quote.code,
        status: quote.status,
        currency: quote.currency,
        customer_id: quote.customer_id,
        customer_name: quote.customer_name,
        valid_from: quote.valid_from,
        valid_to: quote.valid_to,
        price_term: quote.price_term,
        payment_terms: quote.payment_terms,
        note: quote.note,
        owner_name: quote.created_by ? (names.get(quote.created_by) ?? null) : null,
        created_at: quote.created_at,
        updated_at: quote.updated_at,
        submitted_at: quote.submitted_at,
        submitted_by_name: quote.submitted_by
          ? (names.get(quote.submitted_by) ?? null)
          : null,
        approved_at: quote.approved_at,
        approved_by_name: quote.approved_by
          ? (names.get(quote.approved_by) ?? null)
          : null,
        rejected_reason: quote.rejected_reason,
        lost_reason: quote.lost_reason,
        revision_no: quote.revision_no,
        revision_of: quote.revision_of,
      }}
      lines={lines.map((l) => ({
        id: l.id,
        product_id: l.product_id,
        product_code: l.product_code,
        product_name: l.product_name,
        product_unit: l.product_unit,
        customer_item_code: l.customer_item_code,
        description_en: l.description_en,
        qty: l.qty,
        unit_price: l.unit_price,
        discount_pct: l.discount_pct,
        plan_price: canSeeCost ? (planPrices[l.product_id]?.price ?? null) : null,
        plan_snapshot: canSeeCost ? l.plan_price_snapshot : null,
        note: l.note,
        packing_text: packingText(l.packing),
      }))}
      orders={orders}
      revisions={revisions.map((r) => ({
        id: r.id,
        code: r.code,
        revision_no: r.revision_no,
        status: r.status,
        created_at: r.created_at,
      }))}
      customers={customers.map((c) => ({ id: c.id, name: c.name }))}
      canSeeCost={canSeeCost}
      canEdit={canEdit}
      canApprove={canApprove}
    />
  )
}
