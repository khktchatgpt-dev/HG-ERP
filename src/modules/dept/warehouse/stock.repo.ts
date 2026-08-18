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
  'material_id, code, name, unit, group_name, min_stock, shelf_location, is_active, on_hand, is_low'

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
    // is_low (0160) lọc Ở SQL: PostgREST trần 1000 dòng/lượt — lọc client thì
    // vật tư dưới min ngoài 1000 mã đầu không bao giờ về tới nơi.
    if (filter.low_only) q = q.eq('is_low', true)

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
        // Cột view (0160): min_stock > 0 && on_hand < min — đồng nhất với
        // sweep quét sáng + notifyLowStock, và là cột SQL đã lọc ở trên.
        is_low: Boolean(r.is_low),
      } satisfies StockRow
    })
    return rows
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
  /**
   * Vòng duyệt kiểm kê (0157): 'pending' chờ quản lý Kho duyệt (tồn CHƯA đổi),
   * 'posted' đã áp sổ (mặc định — mọi phiếu nhập/xuất và phiếu cũ), 'rejected'.
   */
  status: 'pending' | 'posted' | 'rejected'
  approved_by: string | null
  approved_by_name: string | null
  approved_at: string | null
  reject_reason: string | null
  /** Phiếu ĐẢO (0161): trỏ phiếu gốc bị đảo — null = phiếu thường. */
  reversal_of_doc_id: string | null
  reversal_of_code: string | null
  /** Số phiếu giao hàng / hoá đơn của NCC (0161) — đối chiếu 3 chiều. */
  supplier_doc_no: string | null
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

const DOC_COLS =
  'id, code, kind, doc_date, counterparty, reason, note, status, approved_by, approved_at, reject_reason, reversal_of_doc_id, supplier_doc_no, created_by, created_at'
/*
 * warehouse_docs nay có HAI FK sang users (created_by + approved_by 0157) —
 * embed `users(name)` trần là mơ hồ, PostgREST trả lỗi. Hint đích danh.
 * BẪY: `reversal_of` (0161) là SELF-JOIN — embed kiểu !fkey trên bảng tự trỏ
 * mình mơ hồ HAI CHIỀU (cha hay con?) làm cả findById trả rỗng. Mã phiếu gốc
 * tra bằng truy vấn phụ (fillReversalCodes), không embed.
 */
const DOC_JOINS =
  'actor:users!warehouse_docs_created_by_fkey(name), approver:users!warehouse_docs_approved_by_fkey(name)'

/** Điền reversal_of_code cho các phiếu đảo trong danh sách — 1 truy vấn phụ. */
async function fillReversalCodes(rows: WarehouseDoc[]): Promise<WarehouseDoc[]> {
  const ids = [
    ...new Set(
      rows.map((r) => r.reversal_of_doc_id).filter((x): x is string => x != null),
    ),
  ]
  if (ids.length === 0) return rows
  const { data } = await db().from('warehouse_docs').select('id, code').in('id', ids)
  const codeById = new Map(
    ((data ?? []) as { id: string; code: string }[]).map((r) => [r.id, r.code]),
  )
  for (const r of rows) {
    if (r.reversal_of_doc_id) {
      r.reversal_of_code = codeById.get(r.reversal_of_doc_id) ?? null
    }
  }
  return rows
}

function toDoc(r: Record<string, unknown>): WarehouseDoc {
  const a = Array.isArray(r.actor) ? r.actor[0] : r.actor
  const ap = Array.isArray(r.approver) ? r.approver[0] : r.approver
  const rev = null as { code?: string } | null
  return {
    id: r.id,
    code: r.code,
    kind: r.kind,
    doc_date: r.doc_date,
    counterparty: r.counterparty ?? null,
    reason: r.reason ?? null,
    note: r.note ?? null,
    status: (r.status as WarehouseDoc['status']) ?? 'posted',
    approved_by: r.approved_by ?? null,
    approved_by_name: (ap as { name?: string } | null)?.name ?? null,
    approved_at: (r.approved_at as string | null) ?? null,
    reject_reason: (r.reject_reason as string | null) ?? null,
    reversal_of_doc_id: (r.reversal_of_doc_id as string | null) ?? null,
    reversal_of_code: (rev as { code?: string } | null)?.code ?? null,
    supplier_doc_no: (r.supplier_doc_no as string | null) ?? null,
    created_by: r.created_by ?? null,
    created_by_name: (a as { name?: string } | null)?.name ?? null,
    created_at: r.created_at,
  } as WarehouseDoc
}

export const docsRepo = {
  /** Số phiếu lập HÔM NAY theo loại — nuôi ô "Nhập/Xuất hôm nay" của dashboard. */
  async countTodayByKind(): Promise<Record<string, number>> {
    const today = new Date().toISOString().slice(0, 10)
    const { data } = await db()
      .from('warehouse_docs')
      .select('kind')
      .gte('created_at', `${today}T00:00:00Z`)
      .limit(500)
    const out: Record<string, number> = {}
    for (const r of (data ?? []) as { kind: string }[]) {
      out[r.kind] = (out[r.kind] ?? 0) + 1
    }
    return out
  },

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
    /** PNK nhận cho đợt giao nào (0153) — null = không theo đợt. */
    shipment_id?: string | null
    /** Vòng duyệt kiểm kê (0157) — bỏ trống = 'posted' (áp sổ ngay, flow cũ). */
    status?: 'pending' | 'posted'
    /** Ngày chứng từ (K3) — bỏ trống = hôm nay (default DB). */
    doc_date?: string
    /** Số phiếu giao / hoá đơn NCC (K3). */
    supplier_doc_no?: string | null
    /** Phiếu ĐẢO (K1) — trỏ phiếu gốc. */
    reversal_of_doc_id?: string
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

  /** Duyệt / từ chối kiểm kê (0157) — chỉ 4 cột vòng duyệt. */
  async patchStatus(
    id: string,
    patch: {
      status: 'posted' | 'rejected'
      approved_by: string
      approved_at: string
      reject_reason?: string | null
    },
  ): Promise<void> {
    const { error } = await db().from('warehouse_docs').update(patch).eq('id', id)
    if (error) throw new Error(error.message)
  },

  /** shipment_id của phiếu (0153) — không nằm trong DOC_COLS, chỉ K1 cần khi đảo. */
  async findShipmentId(docId: string): Promise<string | null> {
    const { data } = await db()
      .from('warehouse_docs')
      .select('shipment_id')
      .eq('id', docId)
      .maybeSingle()
    return (
      ((data as { shipment_id: string | null } | null)?.shipment_id as string) ?? null
    )
  },

  /** Phiếu ĐẢO của một phiếu (K1) — null = chưa bị đảo. Mỗi phiếu tối đa một. */
  async findReversalOf(docId: string): Promise<{ id: string; code: string } | null> {
    const { data } = await db()
      .from('warehouse_docs')
      .select('id, code')
      .eq('reversal_of_doc_id', docId)
      .maybeSingle()
    return (data as { id: string; code: string } | null) ?? null
  },

  /** Đếm phiếu theo loại trên TOÀN SỔ — stats của Sổ chứng từ khi đã phân trang. */
  async countByKind(): Promise<{ total: number; receipt: number; issue: number }> {
    const head = (kind?: DocKind) => {
      let q = db().from('warehouse_docs').select('id', { count: 'exact', head: true })
      if (kind) q = q.eq('kind', kind)
      return q
    }
    const [t, r, i] = await Promise.all([head(), head('receipt'), head('issue')])
    return { total: t.count ?? 0, receipt: r.count ?? 0, issue: i.count ?? 0 }
  },

  /** Biên bản kiểm kê CHỜ DUYỆT — nuôi màn duyệt + ô dashboard. */
  async countPending(): Promise<number> {
    const { count } = await db()
      .from('warehouse_docs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
    return count ?? 0
  },

  async list(filter: {
    kind?: DocKind
    page: number
    page_size: number
  }): Promise<{ rows: WarehouseDoc[]; total: number }> {
    let q = db()
      .from('warehouse_docs')
      .select(`${DOC_COLS}, ${DOC_JOINS}`, { count: 'exact' })
      .order('created_at', { ascending: false })
    if (filter.kind) q = q.eq('kind', filter.kind)
    const from = (filter.page - 1) * filter.page_size
    q = q.range(from, from + filter.page_size - 1)
    const { data, count } = await q
    const rows = await fillReversalCodes(
      ((data as Record<string, unknown>[] | null) ?? []).map(toDoc),
    )
    return { rows, total: count ?? 0 }
  },

  async findById(id: string): Promise<WarehouseDoc | null> {
    const { data } = await db()
      .from('warehouse_docs')
      .select(`${DOC_COLS}, ${DOC_JOINS}`)
      .eq('id', id)
      .maybeSingle()
    if (!data) return null
    const [doc] = await fillReversalCodes([toDoc(data as Record<string, unknown>)])
    return doc
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

// ── Kiểm kê (warehouse_stocktake_lines — 0077) ─────────────────────────────

/** 1 dòng biên bản kiểm kê (kèm thông tin vật tư để hiển thị/in). */
export type StocktakeLine = {
  id: string
  doc_id: string
  material_id: string
  system_qty: number
  counted_qty: number
  diff: number
  note: string | null
  material_code: string | null
  material_name: string | null
  material_unit: string | null
}

export const stocktakeRepo = {
  async insertLines(
    rows: {
      doc_id: string
      material_id: string
      system_qty: number
      counted_qty: number
      diff: number
      note?: string | null
    }[],
  ): Promise<void> {
    if (rows.length === 0) return
    const { error } = await db().from('warehouse_stocktake_lines').insert(rows)
    if (error) throw new Error(error.message)
  },

  /** Biên bản đầy đủ của 1 phiếu KK — mọi dòng đã đếm, kể cả khớp sổ. */
  async listByDoc(docId: string): Promise<StocktakeLine[]> {
    const { data } = await db()
      .from('warehouse_stocktake_lines')
      .select(
        'id, doc_id, material_id, system_qty, counted_qty, diff, note, material:warehouse_materials(code, name, unit)',
      )
      .eq('doc_id', docId)
      .order('created_at')
    return ((data as Record<string, unknown>[] | null) ?? []).map((r) => {
      const m = Array.isArray(r.material) ? r.material[0] : r.material
      const mat = (m ?? {}) as { code?: string; name?: string; unit?: string }
      return {
        id: r.id as string,
        doc_id: r.doc_id as string,
        material_id: r.material_id as string,
        system_qty: num(r.system_qty),
        counted_qty: num(r.counted_qty),
        diff: num(r.diff),
        note: (r.note as string | null) ?? null,
        material_code: mat.code ?? null,
        material_name: mat.name ?? null,
        material_unit: mat.unit ?? null,
      } satisfies StocktakeLine
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
export async function stockInfoMany(materialIds: string[]): Promise<
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
/**
 * Đã cấp cho LSX = NET Σ xuất − Σ nhập cùng lệnh (K2 go-live): xưởng dùng
 * không hết trả về kho (PNK "Hoàn kho từ LSX") hay phiếu xuất bị ĐẢO (K1)
 * đều là movement `in` gắn production_order_id — không trừ lại thì "đã cấp"
 * phồng, nhu cầu còn lại của lệnh âm sai.
 */
export async function issuedByLsx(
  productionOrderId: string,
): Promise<Map<string, number>> {
  const { data } = await db()
    .from('warehouse_movements')
    .select('material_id, direction, qty')
    .eq('production_order_id', productionOrderId)
    .limit(5000)
  const map = new Map<string, number>()
  for (const r of (data ?? []) as {
    material_id: string
    direction: 'in' | 'out'
    qty: number
  }[]) {
    const signed = r.direction === 'out' ? Number(r.qty) : -Number(r.qty)
    map.set(r.material_id, (map.get(r.material_id) ?? 0) + signed)
  }
  return map
}

/** Đã xuất theo NHIỀU LSX (gộp dòng) — nguồn tính tồn đặt trước (bước 2 Kho). */
/** Bản nhiều lệnh của issuedByLsx — cùng luật NET xuất − nhập (K2). */
export async function issuedByLsxIds(
  productionOrderIds: string[],
): Promise<{ production_order_id: string; material_id: string; qty: number }[]> {
  if (productionOrderIds.length === 0) return []
  const { data } = await db()
    .from('warehouse_movements')
    .select('production_order_id, material_id, direction, qty')
    .in('production_order_id', productionOrderIds)
    .limit(10000)
  return (
    (data as
      | {
          production_order_id: string
          material_id: string
          direction: 'in' | 'out'
          qty: unknown
        }[]
      | null) ?? []
  ).map((r) => ({
    production_order_id: r.production_order_id,
    material_id: r.material_id,
    qty: r.direction === 'out' ? num(r.qty) : -num(r.qty),
  }))
}

/** Nhu cầu còn lại theo BOM của NHIỀU LSX (view) — cho LSX chưa nhập bảng chi tiết. */
export async function lsxRemainingByIds(
  productionOrderIds: string[],
): Promise<
  { production_order_id: string; material_id: string; qty_remaining: number }[]
> {
  if (productionOrderIds.length === 0) return []
  const { data } = await db()
    .from('v_lsx_material_status')
    .select('production_order_id, material_id, qty_remaining')
    .in('production_order_id', productionOrderIds)
    .limit(10000)
  return (
    (data as
      | { production_order_id: string; material_id: string; qty_remaining: unknown }[]
      | null) ?? []
  ).map((r) => ({
    production_order_id: r.production_order_id,
    material_id: r.material_id,
    qty_remaining: num(r.qty_remaining),
  }))
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

/**
 * PHÂN BỔ THEO SẢN PHẨM từ BOM × SL đơn (khoá = MÃ vật tư) — fallback cho lệnh
 * CHƯA nhập bảng chi tiết, cùng nguồn với nhánh need của v_lsx_material_status
 * (0113): dòng SP của mọi đơn thuộc lệnh × định mức technical_product_parts.
 * Nguồn cho ghi chú "300 Bàn 65 gỗ (4c/sp)" trên dòng đơn đặt.
 */
export async function bomAllocationByCode(
  productionOrderId: string,
): Promise<Map<string, { product: string; qty: number; per_unit: number | null }[]>> {
  const out = new Map<
    string,
    { product: string; qty: number; per_unit: number | null }[]
  >()
  const { data: lines } = await db()
    .from('sales_order_lines')
    .select(
      'product_id, qty, product:technical_products(name), order:sales_orders!inner(production_order_id)',
    )
    .eq('order.production_order_id', productionOrderId)
    .limit(2000)
  type LineRow = {
    product_id: string
    qty: unknown
    product: { name: string } | { name: string }[] | null
  }
  const lineRows = ((lines ?? []) as unknown as LineRow[])
    .map((r) => {
      const p = Array.isArray(r.product) ? r.product[0] : r.product
      return { product_id: r.product_id, qty: num(r.qty), name: p?.name ?? '' }
    })
    .filter((r) => r.qty > 0 && r.product_id)
  if (lineRows.length === 0) return out

  const productIds = [...new Set(lineRows.map((r) => r.product_id))]
  // Định mức gộp theo (SP, mã VT): một vật tư dùng cho nhiều chi tiết của cùng
  // SP thì đm cộng dồn — "chân trước 2c + chân sau 2c" ra 4c/sp như sổ ghi.
  const perUnit = new Map<string, number>()

  /*
   * ƯU TIÊN ẢNH CHỤP ĐỊNH MỨC CỦA LỆNH (0142) — cùng nguồn với
   * v_lsx_material_status. Ghi chú phân bổ trên dòng đơn đặt ("4c/sp") mà đọc
   * định mức sống trong khi số lượng cần đọc bản đã chốt thì hai con số trên
   * cùng một dòng phiếu sẽ chửi nhau.
   */
  const { data: snap } = await db()
    .from('production_order_boms')
    .select('product_id, material_code, qty_per_unit')
    .eq('production_order_id', productionOrderId)
    .limit(10000)
  const snapped = new Set<string>()
  for (const s of snap ?? []) {
    snapped.add(s.product_id)
    perUnit.set(`${s.product_id}::${s.material_code}`, num(s.qty_per_unit))
  }

  const liveIds = productIds.filter((id) => !snapped.has(id))
  if (liveIds.length) {
    const { data: parts } = await db()
      .from('technical_product_parts')
      .select('product_id, material_code, qty')
      .in('product_id', liveIds)
      .not('material_code', 'is', null)
      .limit(10000)
    for (const p of (parts ?? []) as {
      product_id: string
      material_code: string
      qty: unknown
    }[]) {
      const key = `${p.product_id}::${p.material_code}`
      perUnit.set(key, (perUnit.get(key) ?? 0) + num(p.qty))
    }
  }
  for (const [key, dm] of perUnit) {
    const [productId, materialCode] = key.split('::')
    for (const line of lineRows.filter((l) => l.product_id === productId)) {
      const list = out.get(materialCode) ?? []
      list.push({
        product: line.name.trim().split('\n')[0] || '—',
        qty: line.qty,
        per_unit: dm > 0 ? dm : null,
      })
      out.set(materialCode, list)
    }
  }
  return out
}
