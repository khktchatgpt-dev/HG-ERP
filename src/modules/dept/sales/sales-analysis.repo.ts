import { db } from '@/server/db'

/**
 * Dòng đơn bán thô cho PHÂN TÍCH DOANH SỐ — xem `lib/phan-tich-doanh-so.ts`.
 * Quy mô đo 06/10/2026: 53 đơn · 275 dòng; `limit` đặt rõ để chạm trần thì thấy.
 */
const TRAN = 5000

type One<T> = T | T[] | null
const one = <T>(v: One<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v)

export type RawDongBan = {
  order_id: string
  order_code: string
  customer: string
  created_at: string
  product_id: string | null
  product_code: string | null
  product_name: string | null
  product_type: string | null
  qty: number
  unit_price: number | null
  /** Giá thành kế hoạch — CHỈ đọc khi người xem có quyền (xem service). */
  plan_direct_cost: number | null
  plan_profit: number | null
}

export const salesAnalysisRepo = {
  async lines(withCost: boolean): Promise<RawDongBan[]> {
    const { data: orders, error } = await db()
      .from('sales_orders')
      .select('id, code, created_at, customer:sales_customers(name)')
      .neq('status', 'cancelled')
      .limit(TRAN)
    if (error) throw error
    const byId = new Map((orders ?? []).map((o) => [o.id, o]))
    if (byId.size === 0) return []
    const cost = withCost ? ', plan_direct_cost, plan_profit' : ''
    const { data, error: e2 } = await db()
      .from('sales_order_lines')
      .select(
        `order_id, product_id, qty, unit_price, product:technical_products(code, name, product_type${cost})`,
      ) // prettier-ignore
      .in('order_id', [...byId.keys()])
      .limit(TRAN)
    if (e2) throw e2
    type P = {
      code: string
      name: string
      product_type: string | null
      plan_direct_cost?: number | null
      plan_profit?: number | null
    }
    type L = {
      order_id: string
      product_id: string | null
      qty: number
      unit_price: number | null
      product: One<P>
    }
    return ((data ?? []) as unknown as L[]).map((l) => {
      const o = byId.get(l.order_id)!
      const p = one(l.product)
      return {
        order_id: l.order_id,
        order_code: o.code,
        customer: one(o.customer as One<{ name: string }>)?.name ?? '—',
        created_at: o.created_at,
        product_id: l.product_id,
        product_code: p?.code ?? null,
        product_name: p?.name ?? null,
        product_type: p?.product_type ?? null,
        qty: Number(l.qty),
        unit_price: l.unit_price == null ? null : Number(l.unit_price),
        plan_direct_cost: p?.plan_direct_cost == null ? null : Number(p.plan_direct_cost),
        plan_profit: p?.plan_profit == null ? null : Number(p.plan_profit),
      }
    })
  },
}
