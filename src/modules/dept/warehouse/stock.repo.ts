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

// ── Phiếu kho (warehouse_docs — 0017) ──────────────────────────────────────

export type DocKind = 'receipt' | 'issue' | 'transfer' | 'stocktake'

export type WarehouseDoc = {
  id: string
  code: string
  kind: DocKind
  doc_date: string
  counterparty: string | null
  reason: string | null
  note: string | null
  created_by: string | null
  created_by_name: string | null
  created_at: string
}

/** Dòng phiếu = movement gắn doc_id, kèm thông tin vật tư + SL chứng từ (PO). */
export type DocLine = Movement & {
  po_line_id: string | null
  production_order_id: string | null
  qty_ordered: number | null // SL theo chứng từ (dòng PO) — mẫu 01-VT
}

export const docsRepo = {
  async nextCode(kind: 'PNK' | 'PXK' | 'DCK' | 'KK'): Promise<string> {
    const { data, error } = await db().rpc('next_doc_code', { p_kind: kind })
    if (error || !data) throw new Error(error?.message ?? 'next_doc_code failed')
    return data as string
  },

  async insert(row: {
    code: string
    kind: DocKind
    counterparty?: string | null
    reason?: string | null
    note?: string | null
    created_by: string
  }): Promise<{ id: string; code: string }> {
    const { data, error } = await db()
      .from('warehouse_docs')
      .insert(row)
      .select('id, code')
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Insert doc failed')
    return data as { id: string; code: string }
  },

  async list(filter: {
    kind?: DocKind
    page: number
    page_size: number
  }): Promise<{ rows: WarehouseDoc[]; total: number }> {
    let q = db()
      .from('warehouse_docs')
      .select(
        'id, code, kind, doc_date, counterparty, reason, note, created_by, created_at, actor:users(name)',
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
    if (filter.kind) q = q.eq('kind', filter.kind)
    const from = (filter.page - 1) * filter.page_size
    q = q.range(from, from + filter.page_size - 1)
    const { data, count } = await q
    const rows = ((data as Record<string, unknown>[] | null) ?? []).map((r) => {
      const a = Array.isArray(r.actor) ? r.actor[0] : r.actor
      return {
        id: r.id,
        code: r.code,
        kind: r.kind,
        doc_date: r.doc_date,
        counterparty: r.counterparty ?? null,
        reason: r.reason ?? null,
        note: r.note ?? null,
        created_by: r.created_by ?? null,
        created_by_name: (a as { name?: string } | null)?.name ?? null,
        created_at: r.created_at,
      } as WarehouseDoc
    })
    return { rows, total: count ?? 0 }
  },

  async findById(id: string): Promise<WarehouseDoc | null> {
    const { data } = await db()
      .from('warehouse_docs')
      .select(
        'id, code, kind, doc_date, counterparty, reason, note, created_by, created_at, actor:users(name)',
      )
      .eq('id', id)
      .maybeSingle()
    if (!data) return null
    const r = data as Record<string, unknown>
    const a = Array.isArray(r.actor) ? r.actor[0] : r.actor
    return {
      id: r.id,
      code: r.code,
      kind: r.kind,
      doc_date: r.doc_date,
      counterparty: r.counterparty ?? null,
      reason: r.reason ?? null,
      note: r.note ?? null,
      created_by: r.created_by ?? null,
      created_by_name: (a as { name?: string } | null)?.name ?? null,
      created_at: r.created_at,
    } as WarehouseDoc
  },

  /** Dòng của 1 phiếu + SL đặt trên dòng PO (in "theo chứng từ" của mẫu 01-VT). */
  async listLines(docId: string): Promise<DocLine[]> {
    const { data } = await db()
      .from('warehouse_movements')
      .select(
        `${MV_COLS}, po_line_id, production_order_id, material:warehouse_materials(code, name, unit), po_line:supply_purchase_order_lines(qty_ordered)`,
      )
      .eq('doc_id', docId)
      .order('created_at')
    return ((data as Record<string, unknown>[] | null) ?? []).map((r) => {
      const m = Array.isArray(r.material) ? r.material[0] : r.material
      const mat = (m ?? {}) as { code?: string; name?: string; unit?: string }
      const pl = Array.isArray(r.po_line) ? r.po_line[0] : r.po_line
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
        po_line_id: (r.po_line_id as string | null) ?? null,
        production_order_id: (r.production_order_id as string | null) ?? null,
        qty_ordered: pl ? num((pl as { qty_ordered: unknown }).qty_ordered) : null,
      } satisfies DocLine
    })
  },
}

export const warehousesRepo = {
  /** Kho chính (GĐ1 chỉ 1 kho — FR-WMS-10 seed 'MAIN' từ 0011). */
  async mainId(): Promise<string> {
    const { data, error } = await db()
      .from('warehouses')
      .select('id')
      .eq('code', 'MAIN')
      .single()
    if (error || !data) throw new Error('Kho MAIN chưa được seed (migration 0011)')
    return (data as { id: string }).id
  },
}

/** Insert nhiều movement 1 lần (các dòng của 1 phiếu). */
export async function insertMovements(
  rows: {
    material_id: string
    direction: Direction
    qty: number
    qty_rejected?: number
    qc_status?: string | null
    ref_type: string
    ref_no?: string | null
    shelf_location?: string | null
    note?: string | null
    created_by: string
    doc_id: string
    warehouse_id: string
    po_line_id?: string | null
    production_order_id?: string | null
  }[],
): Promise<void> {
  const { error } = await db().from('warehouse_movements').insert(rows)
  if (error) throw new Error(error.message)
}

/** Tồn hiện tại của nhiều vật tư (guard xuất nhiều dòng). */
export async function onHandMany(materialIds: string[]): Promise<Map<string, number>> {
  if (materialIds.length === 0) return new Map()
  const { data } = await db()
    .from('warehouse_stock')
    .select('material_id, on_hand, min_stock, code, name')
    .in('material_id', materialIds)
  const map = new Map<string, number>()
  for (const r of (data as { material_id: string; on_hand: unknown }[] | null) ?? []) {
    map.set(r.material_id, num(r.on_hand))
  }
  return map
}

/** Tồn + min_stock (check cảnh báo sau xuất — FR-WMS-08). */
export async function stockInfoMany(
  materialIds: string[],
): Promise<
  {
    material_id: string
    code: string
    name: string
    on_hand: number
    min_stock: number
  }[]
> {
  if (materialIds.length === 0) return []
  const { data } = await db()
    .from('warehouse_stock')
    .select('material_id, code, name, on_hand, min_stock')
    .in('material_id', materialIds)
  return (
    (data as
      | {
          material_id: string
          code: string
          name: string
          on_hand: unknown
          min_stock: unknown
        }[]
      | null) ?? []
  ).map((r) => ({
    material_id: r.material_id,
    code: r.code,
    name: r.name,
    on_hand: num(r.on_hand),
    min_stock: num(r.min_stock),
  }))
}

/** Nhu cầu vật tư theo LSX: cần (BOM×SL) − đã xuất (view v_lsx_material_status, gap G-2). */
export type LsxNeed = {
  production_order_id: string
  material_id: string
  material_code: string
  material_name: string
  unit: string
  qty_needed: number
  qty_issued: number
  qty_remaining: number
  // Nhánh bảng chi tiết (plan-lsx-components P3) — hiển thị tham khảo cho người mua.
  kg_needed?: number | null
  bars_needed?: number | null
  incomplete?: boolean
  source?: 'components' | 'bom'
}

/** Đã xuất theo LSX gộp theo vật tư — cho nhánh nhu cầu từ bảng chi tiết (P3). */
export async function issuedByLsx(
  productionOrderId: string,
): Promise<Map<string, number>> {
  const { data } = await db()
    .from('warehouse_movements')
    .select('material_id, qty')
    .eq('production_order_id', productionOrderId)
    .eq('direction', 'out')
    .limit(5000)
  const map = new Map<string, number>()
  for (const r of (data ?? []) as { material_id: string; qty: number }[]) {
    map.set(r.material_id, (map.get(r.material_id) ?? 0) + Number(r.qty))
  }
  return map
}

export async function lsxNeeds(productionOrderId: string): Promise<LsxNeed[]> {
  const { data } = await db()
    .from('v_lsx_material_status')
    .select('*')
    .eq('production_order_id', productionOrderId)
  return ((data as Record<string, unknown>[] | null) ?? []).map((r) => ({
    production_order_id: r.production_order_id as string,
    material_id: r.material_id as string,
    material_code: r.material_code as string,
    material_name: r.material_name as string,
    unit: r.unit as string,
    qty_needed: num(r.qty_needed),
    qty_issued: num(r.qty_issued),
    qty_remaining: num(r.qty_remaining),
  }))
}
