import { db } from '@/server/db'
import { BadRequest } from '@/server/http'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import type { User } from '@/modules/core/users/users.repo'
import { ordersRepo } from '@/modules/dept/sales/orders.repo'
import { todayVn } from '@/lib/date-vn'
import { planCheck, planPct, type BreakdownItem } from '@/lib/plan-cost'
import { hasFullPlan, type PlanCostBulkInput } from './plan-cost.schema'

/**
 * GIÁ THÀNH KẾ HOẠCH THEO SẢN PHẨM (0220).
 *
 * Màn trả lời: *"SP đang chạy nào chưa có giá thành kế hoạch, và số đó lấy từ
 * bản báo giá nào?"* Tập SP = SP nằm trong LỆNH đang chạy hoặc ĐƠN BÁN còn
 * sống — đúng tập mà Tiền theo lệnh (bước 4) sẽ cần, không phải cả 779 hồ sơ.
 *
 * Số là KẾ HOẠCH lúc báo giá: bốn số tuyệt đối theo tiền tệ của bản báo giá,
 * a%/b% suy ra lúc đọc. Ghi đè bản cũ, không lịch sử (chốt 02/10/2026).
 */

export type PlanCostRow = {
  product_id: string
  code: string
  name: string
  customer_name: string | null
  customer_item_code: string | null
  direct: number | null
  overhead: number | null
  profit: number | null
  price: number | null
  currency: string | null
  fx_rate: number | null
  breakdown: BreakdownItem[] | null
  source: string | null
  at: string | null
  by_name: string | null
  /** a% chi phí chung / b% lợi nhuận — số suy ra, null khi chưa có số. */
  a_pct: number | null
  b_pct: number | null
  /** Bốn số khớp tổng (trực tiếp + chung + lợi nhuận = FOB) — đủ để bước 4 dùng. */
  complete: boolean
  /** Số lệnh đang chạy / đơn bán còn sống có SP này — vì sao nó ở trên bảng. */
  lsx_count: number
  order_count: number
}

export type PlanCostBoard = {
  rows: PlanCostRow[]
  stats: {
    total: number
    with_plan: number
    complete: number
    /** Theo khách: còn thiếu bao nhiêu SP. */
    missing_by_customer: { customer: string; missing: number; total: number }[]
  }
}

type ProductRaw = {
  id: string
  code: string
  name: string
  customer_name: string | null
  customer_item_code: string | null
  plan_direct_cost: unknown
  plan_overhead: unknown
  plan_profit: unknown
  plan_price: unknown
  plan_currency: string | null
  plan_fx_rate: unknown
  plan_breakdown: unknown
  plan_source: string | null
  plan_at: string | null
  plan_by: string | null
}

const num = (v: unknown) => (v == null ? null : Number(v))

export const planCostService = {
  /**
   * Giá FOB kế hoạch của một lô SP — cho Bảng giá đơn hàng mồi đơn giá (bước 3).
   * KHÔNG gác quyền ở đây: chỗ gọi (orders.service) đã kiểm
   * `technical.plan_cost.view` trước khi hỏi, vì đây là số riêng của Bán hàng.
   */
  async pricesFor(
    productIds: string[],
  ): Promise<Map<string, { price: number; currency: string }>> {
    const ids = [...new Set(productIds)]
    if (ids.length === 0) return new Map()
    const { data, error } = await db()
      .from('technical_products')
      .select('id, plan_price, plan_currency')
      .in('id', ids)
      .not('plan_price', 'is', null)
    if (error) throw new Error(error.message)
    type R = { id: string; plan_price: unknown; plan_currency: string | null }
    return new Map(
      ((data ?? []) as R[]).map((r) => [
        r.id,
        { price: Number(r.plan_price), currency: r.plan_currency ?? 'USD' },
      ]),
    )
  },

  async board(user: User): Promise<PlanCostBoard> {
    // Số riêng của Bán hàng — KHÔNG phải quyền xem SP (02/10/2026).
    await assertAction(user, 'technical.plan_cost.view')

    // 1. SP trong lệnh đang chạy + khách của lệnh.
    const lsxRes = await db()
      .from('production_orders')
      .select('id, customer_id')
      .in('status', ['approved', 'in_progress'])
    if (lsxRes.error) throw new Error(lsxRes.error.message)
    const lsx = (lsxRes.data ?? []) as { id: string; customer_id: string | null }[]
    const lsxIds = lsx.map((l) => l.id)
    const [lineRes, custRes, orders] = await Promise.all([
      lsxIds.length
        ? db()
            .from('production_order_lines')
            .select('production_order_id, product_id')
            .in('production_order_id', lsxIds)
            .not('product_id', 'is', null)
        : Promise.resolve({ data: [], error: null }),
      db().from('sales_customers').select('id, name').limit(1000),
      ordersRepo.list({ page: 1, page_size: 1000 }),
    ])
    if (lineRes.error) throw new Error(lineRes.error.message)
    const custName = new Map(((custRes.data ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name])) // prettier-ignore
    const lsxCustomer = new Map(lsx.map((l) => [l.id, l.customer_id ? (custName.get(l.customer_id) ?? null) : null])) // prettier-ignore

    // Đếm LỆNH riêng biệt, không đếm dòng: một SP nằm ở 3 dòng cùng lệnh vẫn là 1 lệnh.
    const lsxOf = new Map<string, Set<string>>()
    const customerOf = new Map<string, string>()
    for (const l of (lineRes.data ?? []) as {
      production_order_id: string
      product_id: string
    }[]) {
      lsxOf.set(
        l.product_id,
        (lsxOf.get(l.product_id) ?? new Set()).add(l.production_order_id),
      )
      const c = lsxCustomer.get(l.production_order_id)
      if (c && !customerOf.has(l.product_id)) customerOf.set(l.product_id, c)
    }
    const lsxCount = new Map([...lsxOf].map(([id, s]) => [id, s.size]))

    // 2. SP trong đơn bán còn sống (cùng điều kiện với Bảng giá đơn hàng).
    const live = orders.rows.filter(
      (o) => o.status !== 'delivered' && o.status !== 'cancelled',
    )
    const lines = await ordersRepo.listLinesByOrders(live.map((o) => o.id))
    const orderOf = new Map<string, Set<string>>()
    const orderCustomer = new Map(live.map((o) => [o.id, o.customer_name]))
    for (const l of lines) {
      orderOf.set(l.product_id, (orderOf.get(l.product_id) ?? new Set()).add(l.order_id))
      const c = orderCustomer.get(l.order_id)
      if (c && !customerOf.has(l.product_id)) customerOf.set(l.product_id, c)
    }

    const orderCount = new Map([...orderOf].map(([id, s]) => [id, s.size]))
    const ids = [...new Set([...lsxCount.keys(), ...orderCount.keys()])]
    if (ids.length === 0) {
      return {
        rows: [],
        stats: { total: 0, with_plan: 0, complete: 0, missing_by_customer: [] },
      }
    }

    // 3. Hồ sơ SP + người nạp.
    const prodRes = await db()
      .from('technical_products')
      .select(
        'id, code, name, customer_name, customer_item_code, plan_direct_cost, plan_overhead, plan_profit, plan_price, plan_currency, plan_fx_rate, plan_breakdown, plan_source, plan_at, plan_by',
      )
      .in('id', ids)
    if (prodRes.error) throw new Error(prodRes.error.message)
    const products = (prodRes.data ?? []) as ProductRaw[]
    const byIds = [
      ...new Set(products.map((p) => p.plan_by).filter((x): x is string => !!x)),
    ]
    const users = byIds.length
      ? ((await db().from('users').select('id, name, email').in('id', byIds)).data ?? [])
      : []
    const userName = new Map((users as { id: string; name: string | null; email: string }[]).map((u) => [u.id, u.name || u.email])) // prettier-ignore

    const rows: PlanCostRow[] = products.map((p) => {
      const direct = num(p.plan_direct_cost)
      const overhead = num(p.plan_overhead)
      const profit = num(p.plan_profit)
      const price = num(p.plan_price)
      const has = direct != null && overhead != null && profit != null && price != null
      const pct = has ? planPct({ direct, overhead, profit }) : { a: null, b: null }
      return {
        product_id: p.id,
        code: p.code,
        name: p.name,
        customer_name: customerOf.get(p.id) ?? p.customer_name ?? null,
        customer_item_code: p.customer_item_code,
        direct,
        overhead,
        profit,
        price,
        currency: p.plan_currency,
        fx_rate: num(p.plan_fx_rate),
        breakdown: Array.isArray(p.plan_breakdown)
          ? (p.plan_breakdown as BreakdownItem[])
          : null,
        source: p.plan_source,
        at: p.plan_at,
        by_name: p.plan_by ? (userName.get(p.plan_by) ?? null) : null,
        a_pct: pct.a,
        b_pct: pct.b,
        complete: has && planCheck({ direct, overhead, profit, price }, p.plan_currency ?? 'USD').ok, // prettier-ignore
        lsx_count: lsxCount.get(p.id) ?? 0,
        order_count: orderCount.get(p.id) ?? 0,
      }
    })
    rows.sort(
      (a, b) =>
        (a.customer_name ?? '').localeCompare(b.customer_name ?? '') ||
        a.code.localeCompare(b.code),
    )

    const byCust = new Map<string, { missing: number; total: number }>()
    for (const r of rows) {
      const k = r.customer_name ?? '— chưa rõ khách —'
      const cur = byCust.get(k) ?? { missing: 0, total: 0 }
      cur.total++
      if (r.price == null) cur.missing++
      byCust.set(k, cur)
    }

    return {
      rows,
      stats: {
        total: rows.length,
        with_plan: rows.filter((r) => r.price != null).length,
        complete: rows.filter((r) => r.complete).length,
        missing_by_customer: [...byCust]
          .map(([customer, v]) => ({ customer, ...v }))
          .sort((a, b) => b.missing - a.missing),
      },
    }
  },

  /**
   * Nạp hàng loạt. Kiểm TẤT CẢ trước khi ghi dòng nào: một dòng lệch tổng là
   * từ chối cả lô — nửa vời là người dùng không biết đã lưu tới đâu.
   */
  async save(user: User, input: PlanCostBulkInput): Promise<{ updated: number }> {
    await assertAction(user, 'technical.plan_cost.manage')
    // Dòng CHỈ FOB không có gì để kiểm tổng — chỉ dòng đủ ba số mới qua planCheck.
    const bad = input.items
      .filter(hasFullPlan)
      .map((it) => ({
        it,
        chk: planCheck(
          {
            direct: it.direct,
            overhead: it.overhead,
            profit: it.profit,
            price: it.price,
          },
          input.currency,
        ),
      }))
      .filter((x) => !x.chk.ok)
    if (bad.length > 0) {
      const ids = bad.map((b) => b.it.product_id)
      const { data } = await db()
        .from('technical_products')
        .select('id, code')
        .in('id', ids)
      const code = new Map(((data ?? []) as { id: string; code: string }[]).map((p) => [p.id, p.code])) // prettier-ignore
      throw BadRequest(
        `${bad.length} dòng có trực tiếp + chi phí chung + lợi nhuận ≠ giá FOB: ${bad
          .slice(0, 5)
          .map(
            (b) => `${code.get(b.it.product_id) ?? b.it.product_id} (lệch ${b.chk.diff})`,
          )
          .join(', ')}${bad.length > 5 ? '…' : ''}`,
        'PLAN_SUM_MISMATCH',
      )
    }
    const today = todayVn()
    await Promise.all(
      input.items.map((it) =>
        db()
          .from('technical_products')
          .update({
            plan_direct_cost: it.direct ?? null,
            plan_overhead: it.overhead ?? null,
            plan_profit: it.profit ?? null,
            plan_price: it.price,
            plan_currency: input.currency,
            plan_fx_rate: input.fx_rate ?? null,
            // Không gửi chi tiết thì GIỮ chi tiết cũ (dán 5 cột không xoá khối đã soi).
            ...(it.breakdown !== undefined ? { plan_breakdown: it.breakdown } : {}),
            plan_source: input.source,
            plan_at: today,
            plan_by: user.id,
          })
          .eq('id', it.product_id)
          .then(({ error }) => {
            if (error) throw new Error(error.message)
          }),
      ),
    )
    return { updated: input.items.length }
  },
}
