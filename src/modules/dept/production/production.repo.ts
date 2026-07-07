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
  'id, code, sales_order_id, status, current_stage, ship_date, container_summary, issued_by, issued_at, note, created_at, updated_at'

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
