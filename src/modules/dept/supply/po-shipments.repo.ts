import { db } from '@/server/db'

/**
 * ĐỢT GIAO của đơn đặt vật tư (0152 — plan-po-giao-nhan GĐ1).
 *
 * Đợt là KẾ HOẠCH do NV cung ứng ghi lại từ cam kết của NCC — không phải nguồn
 * sự thật về tồn (BR-08 vẫn do sổ kho quyết). Lines chỉ mang po_line_id + qty;
 * tên/ĐVT vật tư caller tự map từ dòng đơn đã nạp sẵn — khỏi join lặp.
 */

export type PoShipmentStatus = 'planned' | 'arrived' | 'received' | 'cancelled'

export type PoShipment = {
  id: string
  po_id: string
  seq: number
  expected_date: string
  method: string | null
  place: string | null
  note: string | null
  status: PoShipmentStatus
  created_at: string
  lines: { po_line_id: string; qty: number }[]
}

export type PoShipmentInsert = {
  seq: number
  expected_date: string
  method?: string | null
  place?: string | null
  note?: string | null
  lines: { po_line_id: string; qty: number }[]
}

const COLS = 'id, po_id, seq, expected_date, method, place, note, status, created_at'

export const poShipmentsRepo = {
  async listByPo(poId: string): Promise<PoShipment[]> {
    const { data } = await db()
      .from('supply_po_shipments')
      .select(COLS)
      .eq('po_id', poId)
      .order('seq')
    const heads = ((data ?? []) as Omit<PoShipment, 'lines'>[]).map((h) => ({
      ...h,
      lines: [] as PoShipment['lines'],
    }))
    if (heads.length === 0) return []
    const { data: lines } = await db()
      .from('supply_po_shipment_lines')
      .select('shipment_id, po_line_id, qty')
      .in(
        'shipment_id',
        heads.map((h) => h.id),
      )
    const byShipment = new Map(heads.map((h) => [h.id, h]))
    type L = { shipment_id: string; po_line_id: string; qty: unknown }
    for (const l of (lines ?? []) as L[]) {
      byShipment
        .get(l.shipment_id)
        ?.lines.push({ po_line_id: l.po_line_id, qty: Number(l.qty ?? 0) })
    }
    return heads
  },

  async findById(id: string): Promise<PoShipment | null> {
    const { data } = await db()
      .from('supply_po_shipments')
      .select(COLS)
      .eq('id', id)
      .maybeSingle()
    if (!data) return null
    const head = data as Omit<PoShipment, 'lines'>
    const { data: lines } = await db()
      .from('supply_po_shipment_lines')
      .select('po_line_id, qty')
      .eq('shipment_id', id)
    return {
      ...head,
      lines: ((lines ?? []) as { po_line_id: string; qty: unknown }[]).map((l) => ({
        po_line_id: l.po_line_id,
        qty: Number(l.qty ?? 0),
      })),
    }
  },

  /** Ghi một bộ đợt (xác nhận lần đầu / thêm đợt bổ sung). */
  async insertMany(
    poId: string,
    shipments: PoShipmentInsert[],
    createdBy: string,
  ): Promise<void> {
    if (shipments.length === 0) return
    const { data, error } = await db()
      .from('supply_po_shipments')
      .insert(
        shipments.map((s) => ({
          po_id: poId,
          seq: s.seq,
          expected_date: s.expected_date,
          method: s.method ?? null,
          place: s.place ?? null,
          note: s.note ?? null,
          created_by: createdBy,
        })),
      )
      .select('id, seq')
    if (error || !data) throw new Error(error?.message ?? 'Insert shipments failed')
    const idBySeq = new Map(
      (data as { id: string; seq: number }[]).map((r) => [r.seq, r.id]),
    )
    const lineRows = shipments.flatMap((s) =>
      s.lines.map((l) => ({
        shipment_id: idBySeq.get(s.seq)!,
        po_line_id: l.po_line_id,
        qty: l.qty,
      })),
    )
    if (lineRows.length === 0) return
    const { error: e2 } = await db().from('supply_po_shipment_lines').insert(lineRows)
    if (e2) throw new Error(e2.message)
  },

  /**
   * Xoá sạch đợt của một đơn — dùng khi SỬA ĐƠN NHÁP: replaceLines xoá rồi
   * chèn lại dòng nên po_line_id đổi hết, đợt cũ trỏ vào dòng đã biến mất.
   * Ghi lại cả bộ là cách duy nhất giữ hai bảng khớp nhau.
   */
  async deleteByPo(poId: string): Promise<void> {
    const { error } = await db().from('supply_po_shipments').delete().eq('po_id', poId)
    if (error) throw new Error(error.message)
  },

  async patch(
    id: string,
    patch: Partial<Pick<PoShipment, 'expected_date' | 'status' | 'note'>>,
  ): Promise<void> {
    const { error } = await db().from('supply_po_shipments').update(patch).eq('id', id)
    if (error) throw new Error(error.message)
  },

  /**
   * ĐỢT CÒN CHỜ NHẬN (planned/arrived) của các đơn còn sống — nuôi màn
   * "Nhập kho · Chờ nhập" và dashboard Kho. Kèm mã đơn + tên NCC để mỗi dòng
   * tự đứng được; loại đơn đã huỷ (đợt của đơn huỷ không ai chờ nữa).
   */
  async listOpen(): Promise<
    (Omit<PoShipment, 'lines'> & {
      po_code: string
      po_status: string
      supplier_name: string
      line_count: number
      total_qty: number
    })[]
  > {
    const { data } = await db()
      .from('supply_po_shipments')
      .select(
        `${COLS}, po:supply_purchase_orders!inner(code, status, supplier:supply_suppliers(name))`,
      )
      .in('status', ['planned', 'arrived'])
      .order('expected_date')
      .limit(300)
    type Raw = Omit<PoShipment, 'lines'> & {
      po: {
        code: string
        status: string
        supplier: { name: string } | { name: string }[] | null
      } | null
    }
    const heads = ((data ?? []) as unknown as Raw[]).filter(
      (r) => r.po && r.po.status !== 'cancelled',
    )
    const counts = new Map<string, { line_count: number; total_qty: number }>()
    if (heads.length > 0) {
      const { data: lines } = await db()
        .from('supply_po_shipment_lines')
        .select('shipment_id, qty')
        .in(
          'shipment_id',
          heads.map((h) => h.id),
        )
      for (const l of (lines ?? []) as { shipment_id: string; qty: unknown }[]) {
        const c = counts.get(l.shipment_id) ?? { line_count: 0, total_qty: 0 }
        c.line_count++
        c.total_qty += Number(l.qty ?? 0)
        counts.set(l.shipment_id, c)
      }
    }
    return heads.map((r) => {
      const sp = Array.isArray(r.po!.supplier) ? r.po!.supplier[0] : r.po!.supplier
      const c = counts.get(r.id) ?? { line_count: 0, total_qty: 0 }
      return {
        id: r.id,
        po_id: r.po_id,
        seq: r.seq,
        expected_date: r.expected_date,
        method: r.method,
        place: r.place,
        note: r.note,
        status: r.status,
        created_at: r.created_at,
        po_code: r.po!.code,
        po_status: r.po!.status,
        supplier_name: sp?.name ?? '?',
        ...c,
      }
    })
  },

  /**
   * Σ SL theo dòng đơn trên các đợt CÒN SỐNG (loại cancelled) — nuôi validate
   * "các đợt cộng lại không vượt SL đặt" khi thêm đợt bổ sung.
   */
  async qtyByLine(
    poId: string,
    excludeShipmentId?: string,
  ): Promise<Map<string, number>> {
    const shipments = await this.listByPo(poId)
    const out = new Map<string, number>()
    for (const s of shipments) {
      if (s.status === 'cancelled') continue
      if (excludeShipmentId && s.id === excludeShipmentId) continue
      for (const l of s.lines) {
        out.set(l.po_line_id, (out.get(l.po_line_id) ?? 0) + l.qty)
      }
    }
    return out
  },
}
