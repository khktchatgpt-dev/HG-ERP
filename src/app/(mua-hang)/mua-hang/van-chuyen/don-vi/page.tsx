import { canAction } from '@/modules/core/rbac/rbac.service'
import { authService } from '@/modules/core/auth/auth.service'
import { poCostsService } from '@/modules/dept/supply/po-costs.service'
import { todayVn } from '@/lib/date-vn'
import { DonViScreen } from './DonViScreen'
import { costMoneyState, daysSince, toCostRow } from '../van-chuyen.shared'

export const metadata = { title: 'Mua hàng · Đơn vị vận chuyển' }
export const dynamic = 'force-dynamic'

/**
 * DANH MỤC ĐƠN VỊ VẬN CHUYỂN — Khuôn C (artboard 13e). Tách hẳn khỏi sổ NCC:
 * nhà xe / chành / tài xế lẻ đã lưu. Ship lẻ (Grab, Ahamove…) KHÔNG nằm ở đây —
 * gõ thẳng trên phiếu; chỉ đơn vị dùng lặp mới lưu.
 *
 * Số trên từng dòng (chuyến 30 ngày, nợ còn) tính từ CÙNG sổ chuyến bằng cùng
 * `costMoneyState` — một nguồn số với `/mua-hang/van-chuyen`.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ them?: string }>
}) {
  const [sp, user] = await Promise.all([searchParams, authService.requirePageUser()])
  const [carriers, costs, canRecord] = await Promise.all([
    poCostsService.carriers(user, { all: true }),
    poCostsService.listAll(user),
    canAction(user, 'supply.po_cost.manage'),
  ])
  const today = todayVn()
  const rows = carriers.map((c) => {
    const mine = costs
      .map(toCostRow)
      .filter((x) => x.payee_supplier_id === c.id && !x.voided_at)
    const owed: Record<string, number> = {}
    for (const x of mine) {
      if (costMoneyState(x) === 'cho_tra')
        owed[x.currency] = (owed[x.currency] ?? 0) + x.total
    }
    const last = mine[0] ?? null
    return {
      ...c,
      trips_30d: mine.filter((x) => daysSince(x.cost_date, today) <= 30).length,
      trips_total: mine.length,
      owed,
      last_trip: last ? { date: last.cost_date, doc_no: last.doc_no } : null,
    }
  })
  return (
    <DonViScreen
      rows={rows}
      canRecord={user.role === 'admin' || canRecord}
      openAdd={sp.them === '1'}
    />
  )
}
