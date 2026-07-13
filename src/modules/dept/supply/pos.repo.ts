import { db } from '@/server/db'
import type { PoStatus } from './pos.schema'

export type Po = {
  id: string
  code: string
  production_order_id: string
  supplier_id: string
  status: PoStatus
  currency: string
  vat_rate: number | null
  price_includes_vat: boolean
  expected_at: string | null
  terms: string | null
  approved_by: string | null
  approved_at: string | null
  ordered_at: string | null
  note: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type PoWithRefs = Po & {
  supplier_name: string
  lsx_code: string
  order_code: string | null
}

export type PoLine = {
  id: string
  po_id: string
  material_id: string
  qty_ordered: number
  unit_price: number | null
  spec: string | null
  qty2: number | null
  unit2: string | null
  note: string | null
  sort_order: number
  material_code: string
  material_name: string
  material_unit: string
}

export type PoLineInput = {
  material_id: string
  qty_ordered: number
  unit_price?: number | null
  spec?: string | null
  qty2?: number | null
  unit2?: string | null
  note?: string | null
}

const COLS =
  'id, code, production_order_id, supplier_id, status, currency, vat_rate, price_includes_vat, expected_at, terms, approved_by, approved_at, ordered_at, note, created_by, created_at, updated_at'

type Raw = Po & {
  supplier: { name: string } | { name: string }[] | null
  lsx:
    | { code: string; order: { code: string } | { code: string }[] | null }
    | { code: string; order: { code: string } | { code: string }[] | null }[]
    | null
}

function unwrap(rows: Raw[] | null): PoWithRefs[] {
  return (rows ?? []).map((r) => {
    const sp = Array.isArray(r.supplier) ? r.supplier[0] : r.supplier
    const lx = Array.isArray(r.lsx) ? r.lsx[0] : r.lsx
    const ord = lx ? (Array.isArray(lx.order) ? lx.order[0] : lx.order) : null
    return {
      ...r,
      supplier_name: sp?.name ?? '?',
      lsx_code: lx?.code ?? '?',
      order_code: ord?.code ?? null,
    }
  })
}

const SELECT = `${COLS}, supplier:supply_suppliers(name), lsx:production_orders(code, order:sales_orders(code))`

/** Vật tư đã mua từ 1 NCC (gộp) — cho tab phân tích mua ở chi tiết NCC. */
export type PurchasedMaterial = {
  material_id: string
  material_code: string
  material_name: string
  material_unit: string
  total_qty: number
  order_lines: number
  last_price: number | null
  last_currency: string
  last_at: string
}

export const posRepo = {
  async nextCode(): Promise<string> {
    const { data, error } = await db().rpc('next_doc_code', { p_kind: 'PO' })
    if (error || !data) throw new Error(error?.message ?? 'next_doc_code failed')
    return data as string
  },

  async list(filter: {
    q?: string
    status?: PoStatus
    supplier_id?: string
    production_order_id?: string
    page: number
    page_size: number
  }): Promise<{ rows: PoWithRefs[]; total: number }> {
    let q = db()
      .from('supply_purchase_orders')
      .select(SELECT, { count: 'exact' })
      .order('created_at', { ascending: false })
    if (filter.status) q = q.eq('status', filter.status)
    if (filter.supplier_id) q = q.eq('supplier_id', filter.supplier_id)
    if (filter.production_order_id)
      q = q.eq('production_order_id', filter.production_order_id)
    if (filter.q) q = q.ilike('code', `%${filter.q}%`)
    const from = (filter.page - 1) * filter.page_size
    q = q.range(from, from + filter.page_size - 1)
    const { data, count } = await q
    return { rows: unwrap(data as Raw[] | null), total: count ?? 0 }
  },

  /**
   * Tổng tiền (Σ qty_ordered × unit_price) theo từng PO cho danh sách — 1 truy vấn
   * gộp cho cả trang thay vì N+1. Trả map po_id → tổng.
   */
  async totalsByPoIds(ids: string[]): Promise<Record<string, number>> {
    if (ids.length === 0) return {}
    const { data } = await db()
      .from('supply_purchase_order_lines')
      .select('po_id, qty_ordered, unit_price')
      .in('po_id', ids)
    const totals: Record<string, number> = {}
    for (const r of (data ?? []) as {
      po_id: string
      qty_ordered: number
      unit_price: number | null
    }[]) {
      totals[r.po_id] = (totals[r.po_id] ?? 0) + r.qty_ordered * (r.unit_price ?? 0)
    }
    return totals
  },

  /**
   * Vật tư đã mua từ 1 NCC — gộp theo vật tư: tổng SL đã đặt + GIÁ MUA GẦN NHẤT.
   * Loại đơn đã huỷ. Dùng cho tab "Vật tư đã mua" ở chi tiết NCC (phân tích mua).
   */
  async materialsPurchasedBySupplier(supplierId: string): Promise<PurchasedMaterial[]> {
    const { data } = await db()
      .from('supply_purchase_order_lines')
      .select(
        'material_id, qty_ordered, unit_price, po:supply_purchase_orders!inner(supplier_id, currency, created_at, status), material:warehouse_materials(code, name, unit)',
      )
      .eq('po.supplier_id', supplierId)
      .order('created_at', { referencedTable: 'po', ascending: false })
      .limit(2000)
    type P = { supplier_id: string; currency: string; created_at: string; status: string }
    type M = { code: string; name: string; unit: string }
    type Raw = {
      material_id: string
      qty_ordered: number
      unit_price: number | null
      po: P | P[] | null
      material: M | M[] | null
    }
    const agg = new Map<string, PurchasedMaterial>()
    for (const r of (data ?? []) as Raw[]) {
      const po = Array.isArray(r.po) ? r.po[0] : r.po
      const m = Array.isArray(r.material) ? r.material[0] : r.material
      if (!po || po.status === 'cancelled') continue
      const cur = agg.get(r.material_id)
      if (!cur) {
        // Lần đầu gặp = dòng của PO mới nhất (đã order desc theo po.created_at).
        agg.set(r.material_id, {
          material_id: r.material_id,
          material_code: m?.code ?? '?',
          material_name: m?.name ?? '?',
          material_unit: m?.unit ?? '',
          total_qty: Number(r.qty_ordered) || 0,
          order_lines: 1,
          last_price: r.unit_price,
          last_currency: po.currency,
          last_at: po.created_at,
        })
      } else {
        cur.total_qty += Number(r.qty_ordered) || 0
        cur.order_lines += 1
      }
    }
    return [...agg.values()]
  },

  async findById(id: string): Promise<PoWithRefs | null> {
    const { data } = await db()
      .from('supply_purchase_orders')
      .select(SELECT)
      .eq('id', id)
      .maybeSingle()
    if (!data) return null
    return unwrap([data as Raw])[0]
  },

  async listLines(poId: string): Promise<PoLine[]> {
    const { data } = await db()
      .from('supply_purchase_order_lines')
      .select(
        'id, po_id, material_id, qty_ordered, unit_price, spec, qty2, unit2, note, sort_order, material:warehouse_materials(code, name, unit)',
      )
      .eq('po_id', poId)
      .order('sort_order')
    type P = { code: string; name: string; unit: string }
    type RawLine = Omit<PoLine, 'material_code' | 'material_name' | 'material_unit'> & {
      material: P | P[] | null
    }
    return ((data ?? []) as RawLine[]).map((r) => {
      const m = Array.isArray(r.material) ? r.material[0] : r.material
      return {
        ...r,
        material: undefined,
        material_code: m?.code ?? '?',
        material_name: m?.name ?? '?',
        material_unit: m?.unit ?? '',
      } as PoLine
    })
  },

  async insert(
    row: {
      code: string
      production_order_id: string
      supplier_id: string
      currency: string
      vat_rate?: number | null
      price_includes_vat: boolean
      expected_at?: string | null
      terms?: string | null
      note?: string | null
      created_by: string
    },
    lines: PoLineInput[],
  ): Promise<Po> {
    const { data, error } = await db()
      .from('supply_purchase_orders')
      .insert(row)
      .select(COLS)
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Insert PO failed')
    const po = data as Po
    await this.replaceLines(po.id, lines)
    return po
  },

  async replaceLines(poId: string, lines: PoLineInput[]): Promise<void> {
    const { error: delErr } = await db()
      .from('supply_purchase_order_lines')
      .delete()
      .eq('po_id', poId)
    if (delErr) throw new Error(delErr.message)
    if (lines.length === 0) return
    const { error } = await db()
      .from('supply_purchase_order_lines')
      .insert(
        lines.map((l, i) => ({
          po_id: poId,
          material_id: l.material_id,
          qty_ordered: l.qty_ordered,
          unit_price: l.unit_price ?? null,
          spec: l.spec ?? null,
          qty2: l.qty2 ?? null,
          unit2: l.unit2 ?? null,
          note: l.note ?? null,
          sort_order: i,
        })),
      )
    if (error) throw new Error(error.message)
  },

  async patch(id: string, patch: Partial<Po>): Promise<Po> {
    const { data, error } = await db()
      .from('supply_purchase_orders')
      .update(patch)
      .eq('id', id)
      .select(COLS)
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Update PO failed')
    return data as Po
  },

  async delete(id: string): Promise<void> {
    const { error } = await db().from('supply_purchase_orders').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },
}
