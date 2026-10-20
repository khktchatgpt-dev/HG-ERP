/**
 * HỒ SƠ SẢN PHẨM (màn `/thu-vien/[id]`, 08/10/2026) — các phép đọc "SP này
 * đang được dùng ở đâu" mà `technical.repo` không có: lệnh SX, đơn bán, giá
 * kế hoạch. Chỉ đọc, gom theo chứng từ.
 */

import { db } from '@/server/db'

export type LsxOfProduct = {
  id: string
  code: string
  status: string
  ship_date: string | null
  /** Tổng SL của SP này trên lệnh (lệnh chia nhiều đợt xuất là nhiều dòng). */
  qty: number
}

export type SaleOfProduct = {
  order_id: string
  code: string
  status: string
  created_at: string
  currency: string | null
  qty: number
  unit_price: number
}

export const profileRepo = {
  async lsxOfProduct(productId: string): Promise<LsxOfProduct[]> {
    type R = {
      production_order_id: string
      qty: number | null
      production_orders: {
        code: string
        status: string
        ship_date: string | null
        created_at: string
      } | null
    }
    const { data, error } = await db()
      .from('production_order_lines')
      .select(
        'production_order_id, qty, production_orders!inner(code, status, ship_date, created_at)',
      )
      .eq('product_id', productId)
    if (error) throw new Error(error.message)
    const by = new Map<string, LsxOfProduct & { created_at: string }>()
    for (const r of (data ?? []) as unknown as R[]) {
      if (!r.production_orders) continue
      const cur = by.get(r.production_order_id)
      if (cur) cur.qty += Number(r.qty ?? 0)
      else
        by.set(r.production_order_id, {
          id: r.production_order_id,
          code: r.production_orders.code,
          status: r.production_orders.status,
          ship_date: r.production_orders.ship_date,
          created_at: r.production_orders.created_at,
          qty: Number(r.qty ?? 0),
        })
    }
    return [...by.values()]
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .map(({ created_at: _c, ...rest }) => rest)
  },

  async salesOfProduct(productId: string): Promise<SaleOfProduct[]> {
    type R = {
      order_id: string
      qty: number | null
      unit_price: number | null
      sales_orders: {
        code: string
        status: string
        created_at: string
        currency: string | null
      } | null
    }
    const { data, error } = await db()
      .from('sales_order_lines')
      .select(
        'order_id, qty, unit_price, sales_orders!inner(code, status, created_at, currency)',
      )
      .eq('product_id', productId)
    if (error) throw new Error(error.message)
    return ((data ?? []) as unknown as R[])
      .filter((r) => r.sales_orders)
      .map((r) => ({
        order_id: r.order_id,
        code: r.sales_orders!.code,
        status: r.sales_orders!.status,
        created_at: r.sales_orders!.created_at,
        currency: r.sales_orders!.currency,
        qty: Number(r.qty ?? 0),
        unit_price: Number(r.unit_price ?? 0),
      }))
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  },

  /** Giá kế hoạch (0220) — đọc riêng vì `Product` cố ý không mang plan_*. */
  async planOf(productId: string): Promise<{
    price: number | null
    currency: string | null
    at: string | null
    source: string | null
  } | null> {
    const { data, error } = await db()
      .from('technical_products')
      .select('plan_price, plan_currency, plan_at, plan_source')
      .eq('id', productId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return null
    return {
      price: data.plan_price,
      currency: data.plan_currency,
      at: data.plan_at,
      source: data.plan_source,
    }
  },
}
