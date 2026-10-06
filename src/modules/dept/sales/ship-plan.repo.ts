import { db } from '@/server/db'
import type {
  RawDon,
  RawDongDon,
  RawDongLenh,
  RawDonMua,
  RawLsx,
  RawNhom,
} from '@/lib/ke-hoach-xuat'

/**
 * Dữ liệu thô cho KẾ HOẠCH XUẤT HÀNG — xem `lib/ke-hoach-xuat.ts`. Đọc theo tập
 * lệnh đang sống; mọi truy vấn lọc `in(production_order_id)` nên không chạm
 * trần 1000 dòng PostgREST ở quy mô hiện tại (19 lệnh · 291 dòng lệnh, đo
 * 06/10/2026) — `limit` đặt rõ để nếu chạm thì thấy, không cắt im lặng.
 */

/** Lệnh còn kế hoạch xuất: bỏ nháp / bị trả / đã huỷ. */
const SONG = ['pending_approval', 'approved', 'in_progress', 'completed']
const TRAN = 5000

type One<T> = T | T[] | null
const one = <T>(v: One<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v)

export const shipPlanRepo = {
  async load(): Promise<{
    lsx: RawLsx[]
    nhom: RawNhom[]
    dongLenh: RawDongLenh[]
    don: RawDon[]
    dongDon: RawDongDon[]
    donMua: RawDonMua[]
  }> {
    const { data: l, error } = await db()
      .from('production_orders')
      .select(
        'id, code, status, ship_date, container_summary, materials_due_at, materials_received_at, customer:sales_customers(name)',
      )
      .in('status', SONG)
      .limit(TRAN)
    if (error) throw error
    const lsx: RawLsx[] = (l ?? []).map((x) => ({
      id: x.id,
      code: x.code,
      status: x.status,
      customer: one(x.customer as One<{ name: string }>)?.name ?? '—',
      ship_date: x.ship_date,
      container_summary: x.container_summary,
      materials_due_at: x.materials_due_at,
      materials_received_at: x.materials_received_at,
    }))
    const ids = lsx.map((x) => x.id)
    if (ids.length === 0)
      return { lsx, nhom: [], dongLenh: [], don: [], dongDon: [], donMua: [] }

    const [g, pl, so, pos] = await Promise.all([
      db()
        .from('production_order_groups')
        .select(
          'id, production_order_id, sales_order_id, po_no, title, ship_date, ship_label, sort_order',
        ) // prettier-ignore
        .in('production_order_id', ids)
        .limit(TRAN),
      db()
        .from('production_order_lines')
        .select('production_order_id, group_id, qty, product_id, sales_order_line_id')
        .in('production_order_id', ids)
        .limit(TRAN),
      db().from('sales_orders').select('id, code, production_order_id').in('production_order_id', ids).limit(TRAN), // prettier-ignore
      db().from('supply_purchase_orders').select('production_order_id, status').in('production_order_id', ids).limit(TRAN), // prettier-ignore
    ])
    for (const r of [g, pl, so, pos]) if (r.error) throw r.error
    const don = (so.data ?? []) as RawDon[]
    const { data: sol, error: e2 } = don.length
      ? await db()
          .from('sales_order_lines')
          .select('id, order_id, product_id, qty, unit_price')
          .in(
            'order_id',
            don.map((o) => o.id),
          )
          .limit(TRAN)
      : { data: [], error: null }
    if (e2) throw e2
    return {
      lsx,
      nhom: (g.data ?? []) as RawNhom[],
      dongLenh: ((pl.data ?? []) as RawDongLenh[]).map((x) => ({
        ...x,
        qty: Number(x.qty),
      })),
      don,
      dongDon: ((sol ?? []) as RawDongDon[]).map((x) => ({
        ...x,
        qty: Number(x.qty),
        unit_price: x.unit_price == null ? null : Number(x.unit_price),
      })),
      donMua: (pos.data ?? []) as RawDonMua[],
    }
  },
}
