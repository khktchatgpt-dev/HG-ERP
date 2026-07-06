import { db } from '@/server/db'

export type StockRow = {
  material_id: string
  code: string
  name: string
  unit: string
  group_name: string | null
  min_stock: number
  shelf_location: string | null
  is_active: boolean
  on_hand: number
  /** on_hand < min_stock (FR-WMS-08). */
  is_low: boolean
}

export type Direction = 'in' | 'out'

export type Movement = {
  id: string
  material_id: string
  direction: Direction
  qty: number
  qty_rejected: number
  qc_status: string | null
  ref_type: string
  ref_no: string | null
  shelf_location: string | null
  note: string | null
  created_by: string | null
  created_at: string
  material_code: string | null
  material_name: string | null
  material_unit: string | null
}

const STOCK_COLS =
  'material_id, code, name, unit, group_name, min_stock, shelf_location, is_active, on_hand'

const MV_COLS =
  'id, material_id, direction, qty, qty_rejected, qc_status, ref_type, ref_no, shelf_location, note, created_by, created_at'

function num(v: unknown): number {
  return Number(v ?? 0)
}

export const stockRepo = {
  async list(filter: {
    q?: string
    group_name?: string
    low_only: boolean
  }): Promise<StockRow[]> {
    let q = db()
      .from('warehouse_stock')
      .select(STOCK_COLS)
      .eq('is_active', true)
      .order('code', { ascending: true })

    if (filter.group_name) q = q.eq('group_name', filter.group_name)
    if (filter.q) q = q.or(`code.ilike.%${filter.q}%,name.ilike.%${filter.q}%`)

    const { data } = await q
    const rows = ((data as Record<string, unknown>[] | null) ?? []).map((r) => {
      const on_hand = num(r.on_hand)
      const min_stock = num(r.min_stock)
      return {
        material_id: r.material_id as string,
        code: r.code as string,
        name: r.name as string,
        unit: r.unit as string,
        group_name: (r.group_name as string | null) ?? null,
        min_stock,
        shelf_location: (r.shelf_location as string | null) ?? null,
        is_active: r.is_active as boolean,
        on_hand,
        is_low: on_hand < min_stock,
      } satisfies StockRow
    })
    return filter.low_only ? rows.filter((r) => r.is_low) : rows
  },

  /** Tồn hiện tại của 1 vật tư (để kiểm khi xuất). */
  async onHand(materialId: string): Promise<number> {
    const { data } = await db()
      .from('warehouse_stock')
      .select('on_hand')
      .eq('material_id', materialId)
      .maybeSingle()
    return data ? num((data as { on_hand: unknown }).on_hand) : 0
  },
}

export const movementsRepo = {
  async insert(row: {
    material_id: string
    direction: Direction
    qty: number
    qty_rejected?: number
    qc_status?: string | null
    ref_type: string
    ref_no?: string | null
    shelf_location?: string | null
    note?: string | null
    created_by: string | null
  }): Promise<{ id: string }> {
    const { data, error } = await db()
      .from('warehouse_movements')
      .insert(row)
      .select('id')
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Insert movement failed')
    return data as { id: string }
  },

  async list(filter: {
    material_id?: string
    direction?: Direction
    page: number
    page_size: number
  }): Promise<{ rows: Movement[]; total: number }> {
    let q = db()
      .from('warehouse_movements')
      .select(`${MV_COLS}, material:warehouse_materials(code, name, unit)`, {
        count: 'exact',
      })
      .order('created_at', { ascending: false })

    if (filter.material_id) q = q.eq('material_id', filter.material_id)
    if (filter.direction) q = q.eq('direction', filter.direction)

    const from = (filter.page - 1) * filter.page_size
    const to = from + filter.page_size - 1
    q = q.range(from, to)

    const { data, count } = await q
    const rows = ((data as Record<string, unknown>[] | null) ?? []).map((r) => {
      const m = Array.isArray(r.material) ? r.material[0] : r.material
      const mat = (m ?? {}) as { code?: string; name?: string; unit?: string }
      return {
        id: r.id as string,
        material_id: r.material_id as string,
        direction: r.direction as Direction,
        qty: num(r.qty),
        qty_rejected: num(r.qty_rejected),
        qc_status: (r.qc_status as string | null) ?? null,
        ref_type: r.ref_type as string,
        ref_no: (r.ref_no as string | null) ?? null,
        shelf_location: (r.shelf_location as string | null) ?? null,
        note: (r.note as string | null) ?? null,
        created_by: (r.created_by as string | null) ?? null,
        created_at: r.created_at as string,
        material_code: mat.code ?? null,
        material_name: mat.name ?? null,
        material_unit: mat.unit ?? null,
      } satisfies Movement
    })
    return { rows, total: count ?? 0 }
  },
}
