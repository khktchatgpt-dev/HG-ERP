import { db } from '@/server/db'
import type { TripMode } from '@/lib/chuyen-hang'

/**
 * CHUYẾN HÀNG (0216). Không xoá — chỉ huỷ kèm lý do. Trạng thái "đã về kho" suy
 * ở service từ phiếu nhập (`lastReceiptByPoIds`), không lưu cột.
 */
export type TripRow = {
  id: string
  code: string
  mode: TripMode
  carrier_name: string
  carrier_id: string | null
  receipt_no: string | null
  sent_on: string
  eta: string | null
  packages: number | null
  package_unit: string | null
  weight_kg: number | null
  note: string | null
  arrived_at: string | null
  cancelled_at: string | null
  cancel_reason: string | null
  created_by: string | null
  created_at: string
}

export type TripFields = Omit<
  TripRow,
  | 'id'
  | 'code'
  | 'arrived_at'
  | 'cancelled_at'
  | 'cancel_reason'
  | 'created_by'
  | 'created_at'
>

const COLS =
  'id, code, mode, carrier_name, carrier_id, receipt_no, sent_on, eta, packages, package_unit, weight_kg, note, arrived_at, cancelled_at, cancel_reason, created_by, created_at'

export const tripsRepo = {
  async nextCode(): Promise<string> {
    const { data, error } = await db().rpc('next_doc_code', { p_kind: 'CH' })
    if (error || !data) throw new Error(error?.message ?? 'next_doc_code failed')
    return data as string
  },

  async findById(id: string): Promise<TripRow | null> {
    const { data } = await db()
      .from('supply_trips')
      .select(COLS)
      .eq('id', id)
      .maybeSingle()
    return (data as TripRow | null) ?? null
  },

  /** Chuyến gửi từ `sinceIso` trở đi (kể cả đã huỷ — service lọc). */
  async listSince(sinceIso: string): Promise<TripRow[]> {
    const { data, error } = await db()
      .from('supply_trips')
      .select(COLS)
      .gte('sent_on', sinceIso)
      .order('sent_on', { ascending: false })
      .limit(500)
    if (error) throw new Error(error.message)
    return (data ?? []) as TripRow[]
  },

  async posOf(tripIds: string[]): Promise<{ trip_id: string; po_id: string }[]> {
    if (tripIds.length === 0) return []
    const { data, error } = await db()
      .from('supply_trip_pos')
      .select('trip_id, po_id')
      .in('trip_id', tripIds)
    if (error) throw new Error(error.message)
    return (data ?? []) as { trip_id: string; po_id: string }[]
  },

  async insert(
    fields: TripFields & { code: string; created_by: string },
    poIds: string[],
  ): Promise<TripRow> {
    const { data, error } = await db()
      .from('supply_trips')
      .insert(fields)
      .select(COLS)
      .single()
    if (error || !data) throw new Error(error?.message ?? 'insert trip failed')
    const trip = data as TripRow
    await this.setPos(trip.id, poIds)
    return trip
  },

  async update(
    id: string,
    fields: Partial<TripFields>,
    poIds?: string[],
  ): Promise<TripRow> {
    const { data, error } = await db()
      .from('supply_trips')
      .update(fields)
      .eq('id', id)
      .select(COLS)
      .single()
    if (error || !data) throw new Error(error?.message ?? 'update trip failed')
    if (poIds) await this.setPos(id, poIds)
    return data as TripRow
  },

  /** Thay bộ đơn của chuyến: bỏ đơn vắng mặt, thêm đơn mới, giữ đơn cũ. */
  async setPos(tripId: string, poIds: string[]): Promise<void> {
    const cur = (await this.posOf([tripId])).map((r) => r.po_id)
    const want = [...new Set(poIds)]
    const drop = cur.filter((id) => !want.includes(id))
    const add = want.filter((id) => !cur.includes(id))
    if (drop.length) {
      const { error } = await db()
        .from('supply_trip_pos')
        .delete()
        .eq('trip_id', tripId)
        .in('po_id', drop)
      if (error) throw new Error(error.message)
    }
    if (add.length) {
      const { error } = await db()
        .from('supply_trip_pos')
        .insert(add.map((po_id) => ({ trip_id: tripId, po_id })))
      if (error) throw new Error(error.message)
    }
  },

  async cancel(id: string, userId: string, reason: string): Promise<void> {
    const { error } = await db()
      .from('supply_trips')
      .update({
        cancelled_at: new Date().toISOString(),
        cancelled_by: userId,
        cancel_reason: reason,
      })
      .eq('id', id)
    if (error) throw new Error(error.message)
  },

  /** Mã, NCC, trạng thái của các đơn — để bày trong chuyến. */
  async posBrief(
    ids: string[],
  ): Promise<Map<string, { id: string; code: string; status: string; supplier_name: string }>> {
    const out = new Map<string, { id: string; code: string; status: string; supplier_name: string }>()
    if (ids.length === 0) return out
    const { data, error } = await db()
      .from('supply_purchase_orders')
      .select('id, code, status, supplier:supply_suppliers(name)')
      .in('id', ids.slice(0, 400))
    if (error) throw new Error(error.message)
    type S = { name: string }
    for (const r of (data ?? []) as unknown as { id: string; code: string; status: string; supplier: S | S[] | null }[]) {
      const sp = Array.isArray(r.supplier) ? r.supplier[0] : r.supplier
      out.set(r.id, { id: r.id, code: r.code, status: r.status, supplier_name: sp?.name ?? '?' })
    }
    return out
  },

  /**
   * Ngày phiếu nhập Kho MỚI NHẤT của từng đơn (chỉ phiếu nhập, không tính phiếu
   * trả). Dùng để suy chuyến "đã về kho".
   */
  async lastReceiptByPoIds(poIds: string[]): Promise<Map<string, string>> {
    const out = new Map<string, string>()
    if (poIds.length === 0) return out
    const { data: lines, error: e1 } = await db()
      .from('supply_purchase_order_lines')
      .select('id, po_id')
      .in('po_id', poIds.slice(0, 400))
      .limit(10000)
    if (e1) throw new Error(e1.message)
    const poOf = new Map(
      ((lines ?? []) as { id: string; po_id: string }[]).map((l) => [l.id, l.po_id]),
    )
    if (poOf.size === 0) return out
    const { data, error } = await db()
      .from('warehouse_movements')
      .select('po_line_id, direction, created_at, doc:warehouse_docs(kind, doc_date)')
      .in('po_line_id', [...poOf.keys()])
      .eq('direction', 'in')
      .not('doc_id', 'is', null)
      .limit(10000)
    if (error) throw new Error(error.message)
    type Doc = { kind: string; doc_date: string | null }
    for (const r of (data ?? []) as unknown as {
      po_line_id: string
      created_at: string
      doc: Doc | Doc[] | null
    }[]) {
      const d = Array.isArray(r.doc) ? r.doc[0] : r.doc
      if (d && d.kind !== 'receipt') continue
      const on = (d?.doc_date ?? r.created_at).slice(0, 10)
      const po = poOf.get(r.po_line_id)
      if (!po) continue
      const cur = out.get(po)
      if (!cur || on > cur) out.set(po, on)
    }
    return out
  },
}
