import { db } from '@/server/db'

/**
 * NPL THEO LỆNH — data access. Thuần truy vấn; xếp tab / chia hàng về / gộp dòng
 * ở `lib/npl-theo-lenh`, ghép ở `npl-theo-lenh.service`.
 *
 * Hai trần phải tránh: PostgREST trả tối đa 1.000 dòng/lượt (→ `.range()` theo
 * trang), và `.in()` hàng trăm uuid làm URL dài quá cổng (→ chia lô `LO` id).
 */

const TRANG = 1000
const LO = 100

export type Row = Record<string, unknown>
type One<T> = T | T[] | null
const first = <T>(v: One<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v)

export function lo<T>(ids: T[]): T[][] {
  const out: T[][] = []
  for (let i = 0; i < ids.length; i += LO) out.push(ids.slice(i, i + LO))
  return out
}

/** Đọc hết theo trang một truy vấn dựng lại được (mỗi trang một truy vấn mới). */
export async function hetTrang(
  make: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<Row[]> {
  const out: Row[] = []
  for (let from = 0; ; from += TRANG) {
    const { data, error } = await make(from, from + TRANG - 1)
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as Row[]
    out.push(...rows)
    if (rows.length < TRANG) break
  }
  return out
}

export type NplDonRaw = {
  id: string
  code: string
  status: string
  expected_at: string | null
  production_order_id: string | null
  supplier_id: string | null
  assigned_to: string | null
  created_by: string | null
}

export type NplDongRaw = {
  id: string
  po_id: string
  material_id: string | null
  qty: number
  line_unit: string | null
  line_name: string | null
  line_kind: string | null
  mat_code: string | null
  mat_name: string | null
  mat_unit: string | null
  nhom: string | null
}

export const nplTheoLenhRepo = {
  /** Mọi phần chia dòng đơn theo lệnh (0125) — bảng nhỏ, đọc hết. */
  async phanChia(): Promise<
    { line_id: string; production_order_id: string; qty: number }[]
  > {
    const rows = await hetTrang((from, to) =>
      db()
        .from('supply_po_line_lsx')
        .select('line_id, production_order_id, qty')
        .order('line_id')
        .range(from, to),
    )
    return rows.map((r) => ({
      line_id: String(r.line_id),
      production_order_id: String(r.production_order_id),
      qty: Number(r.qty) || 0,
    }))
  },

  /** Mọi cặp đơn gộp ↔ lệnh đi kèm (`supply_po_extra_lsx`) — bảng nhỏ, đọc hết. */
  async lenhDiKem(): Promise<{ po_id: string; production_order_id: string }[]> {
    const rows = await hetTrang((from, to) =>
      db()
        .from('supply_po_extra_lsx')
        .select('po_id, production_order_id')
        .order('po_id')
        .range(from, to),
    )
    return rows.map((r) => ({
      po_id: String(r.po_id),
      production_order_id: String(r.production_order_id),
    }))
  },

  /** Đơn (của mọi trạng thái trừ huỷ) có lệnh chính thuộc `lsxIds`. */
  async donCuaLenh(lsxIds: string[]): Promise<NplDonRaw[]> {
    const out: NplDonRaw[] = []
    for (const ids of lo(lsxIds)) {
      const rows = await hetTrang((from, to) =>
        db()
          .from('supply_purchase_orders')
          .select(
            'id, code, status, expected_at, production_order_id, supplier_id, assigned_to, created_by',
          )
          .in('production_order_id', ids)
          .neq('status', 'cancelled')
          .order('id')
          .range(from, to),
      )
      out.push(...(rows as NplDonRaw[]))
    }
    return out
  },

  /** Đơn theo id (đơn gộp / đơn có dòng chia mà lệnh chính không thuộc tập đang xem). */
  async donTheoId(poIds: string[]): Promise<NplDonRaw[]> {
    const out: NplDonRaw[] = []
    for (const ids of lo(poIds)) {
      const { data, error } = await db()
        .from('supply_purchase_orders')
        .select(
          'id, code, status, expected_at, production_order_id, supplier_id, assigned_to, created_by',
        )
        .in('id', ids)
        .neq('status', 'cancelled')
      if (error) throw new Error(error.message)
      out.push(...((data ?? []) as NplDonRaw[]))
    }
    return out
  },

  /** Id đơn của các dòng (để lấy đơn có dòng chia sang lệnh đang xem). */
  async donCuaDong(lineIds: string[]): Promise<string[]> {
    const out = new Set<string>()
    for (const ids of lo(lineIds)) {
      const { data, error } = await db()
        .from('supply_purchase_order_lines')
        .select('po_id')
        .in('id', ids)
      if (error) throw new Error(error.message)
      for (const r of (data ?? []) as Row[]) out.add(String(r.po_id))
    }
    return [...out]
  },

  /** Dòng của các đơn, kèm mã / tên / ĐVT / nhóm vật tư. */
  async dongCuaDon(poIds: string[]): Promise<NplDongRaw[]> {
    const out: NplDongRaw[] = []
    for (const ids of lo(poIds)) {
      const rows = await hetTrang((from, to) =>
        db()
          .from('supply_purchase_order_lines')
          .select(
            'id, po_id, material_id, qty_ordered, line_unit, line_name, line_kind, mat:warehouse_materials(code, name, unit, group_name, sub_group)',
          )
          .in('po_id', ids)
          .order('id')
          .range(from, to),
      )
      for (const r of rows) {
        const mat = first(r.mat as One<Row>)
        out.push({
          id: String(r.id),
          po_id: String(r.po_id),
          material_id: (r.material_id as string) ?? null,
          qty: Number(r.qty_ordered) || 0,
          line_unit: (r.line_unit as string) ?? null,
          line_name: (r.line_name as string) ?? null,
          line_kind: (r.line_kind as string) ?? null,
          mat_code: (mat?.code as string) ?? null,
          mat_name: (mat?.name as string) ?? null,
          mat_unit: (mat?.unit as string) ?? null,
          nhom: ((mat?.sub_group as string) || (mat?.group_name as string)) ?? null,
        })
      }
    }
    return out
  },

  /** Đã về + đóng thiếu của từng dòng (view `supply_po_line_status`). */
  async daVe(
    poIds: string[],
  ): Promise<Map<string, { received: number; closed: boolean }>> {
    const out = new Map<string, { received: number; closed: boolean }>()
    for (const ids of lo(poIds)) {
      const rows = await hetTrang((from, to) =>
        db()
          .from('supply_po_line_status')
          .select('id, qty_received, closed_short_at')
          .in('po_id', ids)
          .order('id')
          .range(from, to),
      )
      for (const r of rows) {
        out.set(String(r.id), {
          received: Number(r.qty_received) || 0,
          closed: r.closed_short_at != null,
        })
      }
    }
    return out
  },

  async tenNcc(ids: string[]): Promise<Map<string, string>> {
    const out = new Map<string, string>()
    for (const part of lo(ids)) {
      const { data, error } = await db()
        .from('supply_suppliers')
        .select('id, name')
        .in('id', part)
      if (error) throw new Error(error.message)
      for (const r of (data ?? []) as Row[]) out.set(String(r.id), String(r.name ?? ''))
    }
    return out
  },

  async tenNguoi(ids: string[]): Promise<Map<string, string>> {
    const out = new Map<string, string>()
    for (const part of lo(ids)) {
      const { data, error } = await db()
        .from('users')
        .select('id, name, email')
        .in('id', part)
      if (error) throw new Error(error.message)
      for (const r of (data ?? []) as Row[])
        out.set(String(r.id), String(r.name || r.email || ''))
    }
    return out
  },

  /** Mã + ngày xuất của các lệnh (cả lệnh đã xong — khi một dòng chia sang chúng). */
  async lenhTheoId(
    ids: string[],
  ): Promise<{ id: string; code: string; ship_date: string | null }[]> {
    const out: { id: string; code: string; ship_date: string | null }[] = []
    for (const part of lo(ids)) {
      const { data, error } = await db()
        .from('production_orders')
        .select('id, code, ship_date')
        .in('id', part)
      if (error) throw new Error(error.message)
      for (const r of (data ?? []) as Row[]) {
        out.push({
          id: String(r.id),
          code: String(r.code),
          ship_date: (r.ship_date as string) ?? null,
        })
      }
    }
    return out
  },
}
