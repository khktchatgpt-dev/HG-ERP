import { db } from '@/server/db'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import type { User } from '@/modules/core/users/users.repo'
import { poLineAmount } from '@/lib/po-line'
import {
  giaTriDonBoard,
  type GtdBoard,
  type GtdLsx,
  type GtdOrder,
  type GtdOrderLine,
  type GtdPo,
} from '@/lib/gia-tri-don'

/**
 * GIÁ TRỊ ĐƠN THEO LỆNH — tầng dữ liệu cho `/exec/gia-tri-don` (02/10/2026).
 *
 * Đọc MỘT LƯỢT rồi giao hết cho `giaTriDonBoard` (thuần, có test). Service
 * không cộng trừ: cộng ở hai nơi là hai nguồn số.
 *
 * QUYỀN: khu Ban Giám đốc (layout gác `exec.tower.view`). Màn bày GIÁ BÁN trên
 * đơn và TIỀN MUA — không bày giá thành / lợi nhuận kế hoạch, nên không cần
 * `technical.plan_cost.view`. (Bảng lãi/lỗ cần số kế hoạch nằm ở `lai-lo.*`,
 * giữ lại cho bước sau.)
 *
 * Đơn mua GỘP NHIỀU LỆNH (0185): tính TRỌN cho lệnh chính, đánh dấu từng đơn
 * (`extra_lsx`) để màn nói ra.
 */

const RUNNING = ['approved', 'in_progress']

export type GiaTriDonScreen = GtdBoard & { all: boolean }

export const giaTriDonService = {
  /** `lsxId`: chỉ MỘT lệnh, mọi trạng thái — cho trang chi tiết `/exec/gia-tri-don/[id]`. */
  async board(
    user: User,
    opts: { all?: boolean; lsxId?: string } = {},
  ): Promise<GiaTriDonScreen> {
    await assertAction(user, 'exec.tower.view')

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
    const lsx: GtdLsx[] = ((lsxRes.data ?? []) as unknown as LsxRaw[]).map((l) => ({
      id: l.id,
      code: l.code,
      status: l.status,
      customer_name: one(l.customer)?.name ?? null,
    }))
    const ids = lsx.map((l) => l.id)
    if (ids.length === 0) {
      return { ...giaTriDonBoard({ lsx: [], orders: [], orderLines: [], pos: [] }), all: !!opts.all } // prettier-ignore
    }

    const [orderRes, poRes] = await Promise.all([
      db()
        .from('sales_orders')
        .select('id, code, production_order_id, status, currency, fx_rate, due_date')
        .in('production_order_id', ids)
        .neq('status', 'cancelled'),
      // Đơn ĐÃ HUỶ không còn là cam kết. Nháp VẪN TÍNH — là ý định chi, tách riêng.
      db()
        .from('supply_purchase_orders')
        .select('id, code, production_order_id, supplier_id, currency, fx_rate, status')
        .in('production_order_id', ids)
        .neq('status', 'cancelled'),
    ])
    for (const r of [orderRes, poRes]) if (r.error) throw new Error(r.error.message)

    const num = (v: unknown) => (v == null ? null : Number(v))
    type OrderRaw = { id: string; code: string; production_order_id: string; status: string; currency: string; fx_rate: unknown; due_date: string | null } // prettier-ignore
    const orders: GtdOrder[] = ((orderRes.data ?? []) as OrderRaw[]).map((o) => ({
      id: o.id,
      code: o.code,
      lsx_id: o.production_order_id,
      status: o.status,
      currency: o.currency || 'VND',
      fx_rate: num(o.fx_rate),
      due_date: o.due_date,
    }))
    type PoRaw = { id: string; code: string; production_order_id: string; supplier_id: string; currency: string; fx_rate: unknown; status: string } // prettier-ignore
    const poRaw = (poRes.data ?? []) as PoRaw[]

    const [oLineRes, poLineRes, supRes, extraRes] = await Promise.all([
      orders.length
        ? db()
            .from('sales_order_lines')
            .select('order_id, qty, unit_price')
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
    for (const r of [oLineRes, poLineRes, supRes, extraRes]) {
      if (r.error) throw new Error(r.error.message)
    }

    type OLineRaw = { order_id: string; qty: unknown; unit_price: unknown }
    const orderLines: GtdOrderLine[] = ((oLineRes.data ?? []) as OLineRaw[]).map((l) => ({
      order_id: l.order_id,
      qty: Number(l.qty ?? 0),
      unit_price: Number(l.unit_price ?? 0),
    }))

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
    const extra = new Set(((extraRes.data ?? []) as { po_id: string }[]).map((e) => e.po_id)) // prettier-ignore
    const pos: GtdPo[] = poRaw.map((p) => ({
      id: p.id,
      code: p.code,
      lsx_id: p.production_order_id,
      supplier_name: supName.get(p.supplier_id) ?? '—',
      status: p.status,
      currency: p.currency || 'VND',
      fx_rate: num(p.fx_rate),
      amount: Math.round((amountOf.get(p.id) ?? 0) * 100) / 100,
      extra_lsx: extra.has(p.id),
    }))

    return { ...giaTriDonBoard({ lsx, orders, orderLines, pos }), all: !!opts.all }
  },
}
