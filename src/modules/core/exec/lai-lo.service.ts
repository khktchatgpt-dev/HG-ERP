import { db } from '@/server/db'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import type { User } from '@/modules/core/users/users.repo'
import { poLineAmount } from '@/lib/po-line'
import {
  laiLoBoard,
  type LaiLoBoard,
  type LaiLoLsx,
  type LaiLoLsxLine,
  type LaiLoOrder,
  type LaiLoOrderLine,
  type LaiLoPlan,
  type LaiLoPo,
} from '@/lib/lai-lo'

/**
 * LÃI / LỖ THEO LỆNH — tầng dữ liệu (bước 4, 02/10/2026). Trang `/exec/lai-lo`
 * gỡ 03/10/2026; nay nuôi khối phân tích trong ngăn soi của `/exec/gia-tri-don`.
 *
 * Đọc MỘT LƯỢT sáu nguồn rồi giao hết cho `laiLoBoard` (thuần, có test). Service
 * không cộng trừ gì: cộng ở hai nơi là hai nguồn số.
 *
 * QUYỀN: màn nằm trong khu Ban Giám đốc (layout đã gác `exec.tower.view`), và
 * vì bày GIÁ THÀNH + LỢI NHUẬN KẾ HOẠCH — số riêng của Bán hàng — nên kiểm thêm
 * `technical.plan_cost.view` (BGĐ có quyền này qua exec.tower.view).
 *
 * Đơn mua GỘP NHIỀU LỆNH (0185): tính TRỌN cho lệnh chính (`production_order_id`),
 * chưa chia theo lệnh phụ — chia cần một tỷ lệ mà hệ thống chưa có chỗ khai.
 * Nói rõ ở `extra_lsx_pos` để màn bày ra, không giấu.
 */

const RUNNING = ['approved', 'in_progress']

export type LaiLoScreen = LaiLoBoard & {
  /** Số đơn mua đang gộp thêm lệnh khác, tính trọn cho lệnh chính. */
  extra_lsx_pos: number
  /** Có đang xem cả lệnh đã đóng không. */
  all: boolean
}

export const laiLoService = {
  /** `lsxId`: chỉ MỘT lệnh, mọi trạng thái — cho trang chi tiết `/exec/gia-tri-don/[id]`. */
  async board(
    user: User,
    opts: { all?: boolean; lsxId?: string } = {},
  ): Promise<LaiLoScreen> {
    await assertAction(user, 'exec.tower.view')
    await assertAction(user, 'technical.plan_cost.view')

    let q = db()
      .from('production_orders')
      .select('id, code, status, customer:sales_customers(name)')
      .order('code')
    if (opts.lsxId) q = q.eq('id', opts.lsxId)
    else if (!opts.all) q = q.in('status', RUNNING)
    const lsxRes = await q
    if (lsxRes.error) throw new Error(lsxRes.error.message)
    type LsxRaw = { id: string; code: string; status: string; customer: { name: string } | { name: string }[] | null } // prettier-ignore
    const one = <T>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v) // prettier-ignore
    const lsx: LaiLoLsx[] = ((lsxRes.data ?? []) as unknown as LsxRaw[]).map((l) => ({
      id: l.id,
      code: l.code,
      status: l.status,
      customer_name: one(l.customer)?.name ?? null,
    }))
    const ids = lsx.map((l) => l.id)
    if (ids.length === 0) {
      return { ...laiLoBoard({ lsx: [], lsxLines: [], plans: [], orders: [], orderLines: [], pos: [] }), extra_lsx_pos: 0, all: !!opts.all } // prettier-ignore
    }

    const [lineRes, orderRes, poRes] = await Promise.all([
      db()
        .from('production_order_lines')
        .select('production_order_id, product_id, product_code, qty')
        .in('production_order_id', ids),
      db()
        .from('sales_orders')
        .select('id, code, production_order_id, currency, fx_rate, status')
        .in('production_order_id', ids)
        .neq('status', 'cancelled'),
      // Đơn ĐÃ HUỶ không còn là cam kết. Nháp VẪN TÍNH — là ý định chi.
      db()
        .from('supply_purchase_orders')
        .select('id, code, production_order_id, supplier_id, currency, fx_rate, status')
        .in('production_order_id', ids)
        .neq('status', 'cancelled'),
    ])
    for (const r of [lineRes, orderRes, poRes])
      if (r.error) throw new Error(r.error.message)

    type LineRaw = { production_order_id: string; product_id: string | null; product_code: string; qty: unknown } // prettier-ignore
    const lsxLines: LaiLoLsxLine[] = ((lineRes.data ?? []) as LineRaw[]).map((l) => ({
      lsx_id: l.production_order_id,
      product_id: l.product_id,
      product_code: l.product_code,
      qty: Number(l.qty ?? 0),
    }))

    type OrderRaw = { id: string; code: string; production_order_id: string; currency: string; fx_rate: unknown } // prettier-ignore
    const orders: LaiLoOrder[] = ((orderRes.data ?? []) as OrderRaw[]).map((o) => ({
      id: o.id,
      code: o.code,
      lsx_id: o.production_order_id,
      currency: o.currency || 'VND',
      fx_rate: o.fx_rate == null ? null : Number(o.fx_rate),
    }))

    type PoRaw = { id: string; code: string; production_order_id: string; supplier_id: string; currency: string; fx_rate: unknown; status: string } // prettier-ignore
    const poRaw = (poRes.data ?? []) as PoRaw[]

    const productIds = [...new Set(lsxLines.map((l) => l.product_id).filter((x): x is string => !!x))] // prettier-ignore
    const [planRes, oLineRes, poLineRes, supRes, extraRes] = await Promise.all([
      productIds.length
        ? db()
            .from('technical_products')
            .select(
              'id, plan_direct_cost, plan_overhead, plan_profit, plan_price, plan_currency',
            )
            .in('id', productIds)
        : Promise.resolve({ data: [], error: null }),
      orders.length
        ? db()
            .from('sales_order_lines')
            .select('order_id, product_id, qty, unit_price')
            .in(
              'order_id',
              orders.map((o) => o.id),
            )
        : Promise.resolve({ data: [], error: null }),
      poRaw.length
        ? db()
            .from('supply_purchase_order_lines')
            .select('po_id, qty_ordered, unit_price, price_basis, qty2')
            .in(
              'po_id',
              poRaw.map((p) => p.id),
            )
        : Promise.resolve({ data: [], error: null }),
      poRaw.length
        ? db()
            .from('supply_suppliers')
            .select('id, name, short_name')
            .in('id', [...new Set(poRaw.map((p) => p.supplier_id))])
        : Promise.resolve({ data: [], error: null }),
      poRaw.length
        ? db()
            .from('supply_po_extra_lsx')
            .select('po_id')
            .in(
              'po_id',
              poRaw.map((p) => p.id),
            )
        : Promise.resolve({ data: [], error: null }),
    ])
    for (const r of [planRes, oLineRes, poLineRes, supRes, extraRes]) {
      if (r.error) throw new Error(r.error.message)
    }

    const num = (v: unknown) => (v == null ? null : Number(v))
    type PlanRaw = { id: string; plan_direct_cost: unknown; plan_overhead: unknown; plan_profit: unknown; plan_price: unknown; plan_currency: string | null } // prettier-ignore
    const plans: LaiLoPlan[] = ((planRes.data ?? []) as PlanRaw[]).map((p) => ({
      product_id: p.id,
      direct: num(p.plan_direct_cost),
      overhead: num(p.plan_overhead),
      profit: num(p.plan_profit),
      price: num(p.plan_price),
      currency: p.plan_currency,
    }))

    type OLineRaw = {
      order_id: string
      product_id: string
      qty: unknown
      unit_price: unknown
    }
    const orderLines: LaiLoOrderLine[] = ((oLineRes.data ?? []) as OLineRaw[]).map(
      (l) => ({
        order_id: l.order_id,
        product_id: l.product_id,
        qty: Number(l.qty ?? 0),
        unit_price: Number(l.unit_price ?? 0),
      }),
    )

    // Tiền đơn mua = Σ dòng theo ĐÚNG `poLineAmount` mà phiếu in và sổ đơn dùng.
    type PLineRaw = { po_id: string; qty_ordered: unknown; unit_price: unknown; price_basis: 'unit' | 'unit2' | null; qty2: unknown } // prettier-ignore
    const amountOf = new Map<string, number>()
    for (const l of (poLineRes.data ?? []) as PLineRaw[]) {
      const a = poLineAmount({
        qty_ordered: Number(l.qty_ordered ?? 0),
        unit_price: num(l.unit_price),
        price_basis: l.price_basis,
        qty2: num(l.qty2),
      })
      amountOf.set(l.po_id, (amountOf.get(l.po_id) ?? 0) + a)
    }
    type SupRaw = { id: string; name: string; short_name: string | null }
    const supName = new Map(((supRes.data ?? []) as SupRaw[]).map((s) => [s.id, s.short_name || s.name])) // prettier-ignore
    const pos: LaiLoPo[] = poRaw.map((p) => ({
      id: p.id,
      code: p.code,
      lsx_id: p.production_order_id,
      supplier_id: p.supplier_id,
      supplier_name: supName.get(p.supplier_id) ?? '—',
      currency: p.currency || 'VND',
      fx_rate: num(p.fx_rate),
      status: p.status,
      amount: Math.round((amountOf.get(p.id) ?? 0) * 100) / 100,
    }))
    const extra_lsx_pos = new Set(((extraRes.data ?? []) as { po_id: string }[]).map((e) => e.po_id)).size // prettier-ignore

    return {
      ...laiLoBoard({ lsx, lsxLines, plans, orders, orderLines, pos }),
      extra_lsx_pos,
      all: !!opts.all,
    }
  },
}
