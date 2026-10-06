import { db } from '@/server/db'
import type {
  RawDon,
  RawDongDon,
  RawDongLenh,
  RawDonMua,
  RawLot,
  RawLsx,
  RawNhom,
  LotInput,
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
    lots: RawLot[]
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
      return { lsx, nhom: [], dongLenh: [], don: [], dongDon: [], donMua: [], lots: [] }

    const [g, pl, so, pos, lotsRes] = await Promise.all([
      db()
        .from('production_order_groups')
        .select(
          'id, production_order_id, sales_order_id, po_no, title, ship_date, ship_label, sort_order',
        ) // prettier-ignore
        .in('production_order_id', ids)
        .limit(TRAN),
      db()
        .from('production_order_lines')
        .select(
          'production_order_id, group_id, qty, product_id, sales_order_line_id, product_code, name_vi, customer_item_code',
        )
        .in('production_order_id', ids)
        .limit(TRAN),
      db().from('sales_orders').select('id, code, production_order_id').in('production_order_id', ids).limit(TRAN), // prettier-ignore
      db().from('supply_purchase_orders').select('production_order_id, status').in('production_order_id', ids).limit(TRAN), // prettier-ignore
      this.lotsOf(ids),
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
      lots: lotsRes,
    }
  },

  /** Đợt Sale chia (0222) của các lệnh, kèm SL từng SP. */
  async lotsOf(lsxIds: string[]): Promise<RawLot[]> {
    if (!lsxIds.length) return []
    const { data, error } = await db()
      .from('sales_ship_lots')
      .select(
        'id, production_order_id, seq, po_no, po_ref, order_no, ship_date, note, lines:sales_ship_lot_lines(product_key, qty)',
      )
      .in('production_order_id', lsxIds)
      .order('seq')
      .limit(TRAN)
    if (error) throw error
    return ((data ?? []) as unknown as RawLot[]).map((x) => ({
      ...x,
      lines: (x.lines ?? []).map((l) => ({
        product_key: l.product_key,
        qty: Number(l.qty),
      })),
    }))
  },

  /** Lệnh + khoá SP của nó (để kiểm kế hoạch trước khi lưu). */
  async lsxForPlan(id: string) {
    const [{ data: x, error }, { data: lines, error: e2 }] = await Promise.all([
      db()
        .from('production_orders')
        .select('id, code, status')
        .eq('id', id)
        .maybeSingle(),
      db()
        .from('production_order_lines')
        .select('qty, product_id, product_code')
        .eq('production_order_id', id)
        .limit(TRAN),
    ])
    if (error) throw error
    if (e2) throw e2
    return x
      ? { lsx: x, lines: (lines ?? []).map((l) => ({ ...l, qty: Number(l.qty) })) }
      : null
  },

  /**
   * THAY CẢ BỘ kế hoạch của một lệnh. Chèn bộ MỚI trước rồi mới xoá bộ CŨ —
   * hỏng giữa chừng thì gỡ phần mới chèn, bộ cũ còn nguyên (không bao giờ để
   * lệnh mất sạch kế hoạch vì một lỗi mạng).
   */
  async replaceLots(
    lsxId: string,
    lots: (LotInput & { product_ids: Record<string, string | null> })[],
    userId: string,
  ): Promise<void> {
    const { data: cu, error: e0 } = await db()
      .from('sales_ship_lots')
      .select('id')
      .eq('production_order_id', lsxId)
    if (e0) throw e0
    const moi: string[] = []
    try {
      for (const [i, lot] of lots.entries()) {
        const { data: ins, error } = await db()
          .from('sales_ship_lots')
          .insert({
            production_order_id: lsxId,
            seq: i + 1,
            po_no: lot.po_no,
            po_ref: lot.po_ref,
            order_no: lot.order_no,
            ship_date: lot.ship_date,
            note: lot.note,
            created_by: userId,
            updated_by: userId,
          })
          .select('id')
          .single()
        if (error) throw error
        moi.push(ins.id)
        const rows = lot.lines
          .filter((l) => Number(l.qty) > 0)
          .map((l) => ({
            lot_id: ins.id,
            product_key: l.product_key,
            product_id: lot.product_ids[l.product_key] ?? null,
            qty: Number(l.qty),
          }))
        if (rows.length) {
          const { error: e1 } = await db().from('sales_ship_lot_lines').insert(rows)
          if (e1) throw e1
        }
      }
    } catch (e) {
      if (moi.length) await db().from('sales_ship_lots').delete().in('id', moi)
      throw e
    }
    const cuIds = (cu ?? []).map((r) => r.id)
    if (cuIds.length) {
      const { error } = await db().from('sales_ship_lots').delete().in('id', cuIds)
      if (error) throw error
    }
  },
}
