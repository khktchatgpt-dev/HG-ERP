import { db } from '@/server/db'
import type { LsxStatus } from './production.schema'

export type ProductionOrder = {
  id: string
  code: string
  sales_order_id: string
  status: LsxStatus
  current_stage: string | null
  ship_date: string | null
  container_summary: string | null
  issued_by: string | null
  issued_at: string | null
  received_date: string | null
  completed_at: string | null
  approved_by: string | null
  approved_at: string | null
  rejected_reason: string | null
  note: string | null
  created_at: string
  updated_at: string
}

export type ProductionOrderWithOrder = ProductionOrder & {
  order_code: string
  customer_name: string
}

export type ProgressEntry = {
  id: string
  production_order_id: string
  stage: string
  action: 'start' | 'done'
  note: string | null
  updated_by: string | null
  updated_by_name: string | null
  created_at: string
}

/** 1 dòng của view v_order_tracking (FR-SAL-07). */
export type OrderTracking = {
  id: string
  code: string
  customer_id: string
  customer_name: string
  customer_po_no: string | null
  status: string
  currency: string
  due_date: string | null
  quote_code: string | null
  production_order_id: string | null
  lsx_code: string | null
  lsx_status: string | null
  current_stage: string | null
  ship_date: string | null
  lines_bom_pending: number
  pos_open: number
  created_at: string
  updated_at: string
}

const COLS =
  'id, code, sales_order_id, status, current_stage, ship_date, container_summary, issued_by, issued_at, received_date, completed_at, approved_by, approved_at, rejected_reason, note, created_at, updated_at'

type Raw = ProductionOrder & {
  order:
    | { code: string; customer: { name: string } | { name: string }[] | null }
    | { code: string; customer: { name: string } | { name: string }[] | null }[]
    | null
}

function unwrap(rows: Raw[] | null): ProductionOrderWithOrder[] {
  return (rows ?? []).map((r) => {
    const o = Array.isArray(r.order) ? r.order[0] : r.order
    const c = o ? (Array.isArray(o.customer) ? o.customer[0] : o.customer) : null
    return { ...r, order_code: o?.code ?? '?', customer_name: c?.name ?? '?' }
  })
}

export const productionRepo = {
  async nextCode(): Promise<string> {
    const { data, error } = await db().rpc('next_doc_code', { p_kind: 'LSX' })
    if (error || !data) throw new Error(error?.message ?? 'next_doc_code failed')
    return data as string
  },

  async existsByCode(code: string): Promise<boolean> {
    const { data } = await db()
      .from('production_orders')
      .select('id')
      .eq('code', code)
      .maybeSingle()
    return !!data
  },

  async list(filter: {
    q?: string
    status?: LsxStatus
    page: number
    page_size: number
  }): Promise<{ rows: ProductionOrderWithOrder[]; total: number }> {
    let q = db()
      .from('production_orders')
      .select(`${COLS}, order:sales_orders(code, customer:sales_customers(name))`, {
        count: 'exact',
      })
      .order('created_at', { ascending: false })
    if (filter.status) q = q.eq('status', filter.status)
    if (filter.q) q = q.ilike('code', `%${filter.q}%`)
    const from = (filter.page - 1) * filter.page_size
    q = q.range(from, from + filter.page_size - 1)
    const { data, count } = await q
    return { rows: unwrap(data as Raw[] | null), total: count ?? 0 }
  },

  async findById(id: string): Promise<ProductionOrderWithOrder | null> {
    const { data } = await db()
      .from('production_orders')
      .select(`${COLS}, order:sales_orders(code, customer:sales_customers(name))`)
      .eq('id', id)
      .maybeSingle()
    if (!data) return null
    return unwrap([data as Raw])[0]
  },

  /** LSX của 1 đơn (BR-01: tối đa 1) — để trang chi tiết đơn link sang LSX. */
  async findByOrder(salesOrderId: string): Promise<ProductionOrderWithOrder | null> {
    const { data } = await db()
      .from('production_orders')
      .select(`${COLS}, order:sales_orders(code, customer:sales_customers(name))`)
      .eq('sales_order_id', salesOrderId)
      .maybeSingle()
    if (!data) return null
    return unwrap([data as Raw])[0]
  },

  /**
   * Phát LSX (BR-01): unique constraint DB chặn LSX thứ 2 cùng đơn — bắt lỗi
   * duplicate ở đây để service trả Conflict thay vì 500.
   */
  async insert(row: {
    code: string
    sales_order_id: string
    ship_date?: string | null
    container_summary?: string | null
    issued_by: string
    issued_at: string
    received_date?: string | null
    note?: string | null
  }): Promise<{ order: ProductionOrder | null; duplicate: boolean }> {
    const { data, error } = await db()
      .from('production_orders')
      .insert(row)
      .select(COLS)
      .single()
    if (error) {
      if (error.code === '23505') return { order: null, duplicate: true } // unique_violation
      throw new Error(error.message)
    }
    return { order: data as ProductionOrder, duplicate: false }
  },

  async patch(id: string, patch: Partial<ProductionOrder>): Promise<ProductionOrder> {
    const { data, error } = await db()
      .from('production_orders')
      .update(patch)
      .eq('id', id)
      .select(COLS)
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Update LSX failed')
    return data as ProductionOrder
  },

  async insertProgress(row: {
    production_order_id: string
    stage: string
    action: 'start' | 'done'
    note?: string | null
    updated_by: string
  }): Promise<void> {
    const { error } = await db().from('production_progress').insert(row)
    if (error) throw new Error(error.message)
  },

  async listProgress(productionOrderId: string): Promise<ProgressEntry[]> {
    const { data } = await db()
      .from('production_progress')
      .select(
        'id, production_order_id, stage, action, note, updated_by, created_at, actor:users(name)',
      )
      .eq('production_order_id', productionOrderId)
      .order('created_at', { ascending: false })
    type RawP = Omit<ProgressEntry, 'updated_by_name'> & {
      actor: { name: string | null } | { name: string | null }[] | null
    }
    return ((data ?? []) as RawP[]).map((r) => {
      const a = Array.isArray(r.actor) ? r.actor[0] : r.actor
      return { ...r, actor: undefined, updated_by_name: a?.name ?? null } as ProgressEntry
    })
  },

  /** Danh mục giai đoạn SX (catalog_items type 'production_stage'). */
  async listStages(): Promise<{ code: string; label: string }[]> {
    const { data } = await db()
      .from('catalog_items')
      .select('code, label')
      .eq('type', 'production_stage')
      .eq('is_active', true)
      .order('sort_order')
    return (data ?? []) as { code: string; label: string }[]
  },

  /** Bảng trạng thái tổng hợp (FR-SAL-07) — đọc từ view v_order_tracking. */
  async listTracking(): Promise<OrderTracking[]> {
    const { data } = await db()
      .from('v_order_tracking')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)
    return (data ?? []) as OrderTracking[]
  },
}

/** Dòng SP + đủ thông số kỹ thuật để in phiếu LSX (mẫu Hoàng Gia). */
export type LsxPrintLine = {
  order_line_id: string
  product_code: string
  name_vi: string
  name_de: string | null
  barcode: string | null
  shipping_mark: string | null
  showroom_sample: boolean
  unit: string
  qty: number
  customer_item_code: string | null
  image_file_id: string | null
  tech_spec: {
    machine?: string
    cushion?: string
    paint?: string
    glass?: string
    wood?: string
  }
  qty_per_carton: number | null
  pack_unit_label: string | null
}

/**
 * Dòng in LSX = sales_order_lines của đơn (BR-02: dùng chung) + thông số mặc định
 * từ technical_products.tech_spec, ghi đè bằng production_order_line_specs nếu có.
 */
export async function listLsxPrintLines(
  productionOrderId: string,
  salesOrderId: string,
): Promise<LsxPrintLine[]> {
  const { data } = await db()
    .from('sales_order_lines')
    .select(
      'id, qty, sort_order, product:technical_products(code, name, name_de, unit, barcode, shipping_mark, showroom_sample, customer_item_code, image_file_id, tech_spec, packing)',
    )
    .eq('order_id', salesOrderId)
    .order('sort_order')

  type Spec = LsxPrintLine['tech_spec']
  type P = {
    code: string
    name: string
    name_de: string | null
    unit: string
    barcode: string | null
    shipping_mark: string | null
    showroom_sample: boolean
    customer_item_code: string | null
    image_file_id: string | null
    tech_spec: Spec | null
    packing: { qty_per_carton?: number; pack_unit_label?: string } | null
  }
  type Raw = { id: string; qty: number; product: P | P[] | null }

  // Override thông số per dòng (nếu người dùng nhập ở bước SX).
  const { data: specRows } = await db()
    .from('production_order_line_specs')
    .select('order_line_id, specs')
    .eq('production_order_id', productionOrderId)
  const override = new Map<string, Spec>()
  for (const s of (specRows ?? []) as { order_line_id: string; specs: Spec | null }[]) {
    if (s.specs) override.set(s.order_line_id, s.specs)
  }

  return ((data ?? []) as Raw[]).map((r) => {
    const p = Array.isArray(r.product) ? r.product[0] : r.product
    const base: Spec = p?.tech_spec ?? {}
    const ov = override.get(r.id) ?? {}
    return {
      order_line_id: r.id,
      product_code: p?.code ?? '?',
      name_vi: p?.name ?? '?',
      name_de: p?.name_de ?? null,
      barcode: p?.barcode ?? null,
      shipping_mark: p?.shipping_mark ?? null,
      showroom_sample: p?.showroom_sample ?? false,
      unit: p?.unit ?? '',
      qty: r.qty,
      customer_item_code: p?.customer_item_code ?? null,
      image_file_id: p?.image_file_id ?? null,
      tech_spec: { ...base, ...ov }, // override thắng
      qty_per_carton: p?.packing?.qty_per_carton ?? null,
      pack_unit_label: p?.packing?.pack_unit_label ?? null,
    }
  })
}

/** Spec override per dòng LSX (OI-11) — bảng production_order_line_specs. */
export type LsxLineSpecRow = {
  order_line_id: string
  specs: {
    machine?: string
    cushion?: string
    paint?: string
    glass?: string
    wood?: string
  }
  note: string | null
  important_note: string | null
}

export async function listLsxLineSpecs(
  productionOrderId: string,
): Promise<LsxLineSpecRow[]> {
  const { data } = await db()
    .from('production_order_line_specs')
    .select('order_line_id, specs, note, important_note')
    .eq('production_order_id', productionOrderId)
  return (data ?? []) as LsxLineSpecRow[]
}

/** Ghi đè spec per dòng (upsert theo production_order_id + order_line_id). */
export async function saveLsxLineSpecs(
  productionOrderId: string,
  lines: LsxLineSpecRow[],
): Promise<void> {
  if (lines.length === 0) return
  const rows = lines.map((l) => ({
    production_order_id: productionOrderId,
    order_line_id: l.order_line_id,
    specs: l.specs,
    note: l.note ?? null,
    important_note: l.important_note ?? null,
  }))
  const { error } = await db()
    .from('production_order_line_specs')
    .upsert(rows, { onConflict: 'production_order_id,order_line_id' })
  if (error) throw new Error(error.message)
}
