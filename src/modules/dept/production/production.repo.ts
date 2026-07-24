import { db } from '@/server/db'
import type { LsxStatus } from './production.schema'

/**
 * Repo HEADER lệnh sản xuất (production_orders) + view theo dõi đơn + dòng in
 * LSX. Lớp thực thi (kế hoạch/chi tiết/sổ) nằm ở jobs/components/entries repo
 * — thiết kế lại theo vai 07/2026 (0084).
 */

export type ProductionOrder = {
  id: string
  code: string
  sales_order_id: string
  status: LsxStatus
  priority: number
  ship_date: string | null
  container_summary: string | null
  issued_by: string | null
  issued_at: string | null
  received_date: string | null
  completed_at: string | null
  approved_by: string | null
  approved_at: string | null
  rejected_reason: string | null
  materials_received_at: string | null
  materials_received_by: string | null
  note: string | null
  created_at: string
  updated_at: string
}

export type ProductionOrderWithOrder = ProductionOrder & {
  order_code: string
  customer_name: string
}

/** 1 dòng của view v_order_tracking (FR-SAL-07) — tiến độ SX đếm theo jobs (0084). */
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
  lsx_priority: number | null
  ship_date: string | null
  /** Số công đoạn (jobs) của lệnh / đã xong — 0/0 = chưa lên kế hoạch SX. */
  jobs_total: number
  jobs_done: number
  lines_bom_pending: number
  pos_open: number
  // Lớp thương mại (v_order_tracking mở rộng, migration 0071) — GĐ nhìn theo tiền.
  deposit_percent: number | null
  payment_method: string | null
  /** Σ(qty × đơn giá bán) của các dòng đơn, theo `currency`. */
  order_value: number
  line_count: number
  created_at: string
  updated_at: string
}

const COLS =
  'id, code, sales_order_id, status, priority, ship_date, container_summary, issued_by, issued_at, received_date, completed_at, approved_by, approved_at, rejected_reason, materials_received_at, materials_received_by, note, created_at, updated_at'

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

  /** LSX đang chạy (approved | in_progress) — ưu tiên trước, rồi hạn xuất. */
  async listActive(): Promise<ProductionOrderWithOrder[]> {
    const { data } = await db()
      .from('production_orders')
      .select(`${COLS}, order:sales_orders(code, customer:sales_customers(name))`)
      .in('status', ['approved', 'in_progress'])
      .order('priority', { ascending: false })
      .order('ship_date', { ascending: true, nullsFirst: false })
      .limit(500)
    return unwrap(data as Raw[] | null)
  },

  /**
   * Id các LSX đã CAM KẾT (đã qua duyệt GĐ): approved | in_progress — dùng để
   * tính "giữ chỗ tồn" khi đề xuất mua (plan-don-dat-hang-chuan-erp §P1, Cách 2).
   * LSX pending_approval/rejected/completed/cancelled KHÔNG giữ chỗ.
   */
  async listCommittedIds(): Promise<string[]> {
    const { data } = await db()
      .from('production_orders')
      .select('id')
      .in('status', ['approved', 'in_progress'])
      .limit(1000)
    return ((data as { id: string }[] | null) ?? []).map((r) => r.id)
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

  /** Danh mục công đoạn SX (catalog_items type 'production_stage'). */
  async listStages(): Promise<{ code: string; label: string }[]> {
    const { data } = await db()
      .from('catalog_items')
      .select('code, label')
      .eq('type', 'production_stage')
      .eq('is_active', true)
      .order('sort_order')
    return (data ?? []) as { code: string; label: string }[]
  },

  /** Số dòng SP per đơn — cho màn kế hoạch/định hình ("x/y SP đã chốt"). */
  async linesCountByOrder(orderIds: string[]): Promise<Map<string, number>> {
    if (!orderIds.length) return new Map()
    const { data } = await db()
      .from('sales_order_lines')
      .select('order_id')
      .in('order_id', orderIds)
      .limit(20000)
    const map = new Map<string, number>()
    for (const r of (data ?? []) as { order_id: string }[]) {
      map.set(r.order_id, (map.get(r.order_id) ?? 0) + 1)
    }
    return map
  },

  /** Bảng trạng thái tổng hợp (FR-SAL-07) — đọc từ view v_order_tracking. */
  async listTracking(): Promise<OrderTracking[]> {
    const { data } = await db()
      .from('v_order_tracking')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)
    return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
      ...(r as unknown as OrderTracking),
      jobs_total: Number(r.jobs_total ?? 0),
      jobs_done: Number(r.jobs_done ?? 0),
      lsx_priority: r.lsx_priority == null ? null : Number(r.lsx_priority),
      order_value: Number(r.order_value ?? 0),
      line_count: Number(r.line_count ?? 0),
      deposit_percent: r.deposit_percent == null ? null : Number(r.deposit_percent),
      payment_method: (r.payment_method as string | null) ?? null,
    }))
  },
}

/** Dòng SP + đủ thông số kỹ thuật để in phiếu LSX (mẫu Hoàng Gia). */
export type LsxPrintLine = {
  order_line_id: string
  product_code: string
  name_vi: string
  name_foreign: string | null
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
 * `productionOrderId = null` → bản XEM TRƯỚC khi chưa phát lệnh (không có override).
 */
export async function listLsxPrintLines(
  productionOrderId: string | null,
  salesOrderId: string,
): Promise<LsxPrintLine[]> {
  const { data } = await db()
    .from('sales_order_lines')
    .select(
      'id, qty, sort_order, product:technical_products(code, name, name_foreign, unit, barcode, shipping_mark, showroom_sample, customer_item_code, image_file_id, tech_spec, packing)',
    )
    .eq('order_id', salesOrderId)
    .order('sort_order')

  type Spec = LsxPrintLine['tech_spec']
  type P = {
    code: string
    name: string
    name_foreign: string | null
    unit: string
    barcode: string | null
    shipping_mark: string | null
    showroom_sample: boolean
    customer_item_code: string | null
    image_file_id: string | null
    tech_spec: Spec | null
    packing: { qty_per_carton?: number; pack_unit_label?: string } | null
  }
  type RawLine = { id: string; qty: number; product: P | P[] | null }

  // Override thông số per dòng (nếu người dùng nhập ở bước SX). Bản xem trước
  // (chưa phát lệnh) không có override — dùng thông số mặc định của SP.
  const override = new Map<string, Spec>()
  if (productionOrderId) {
    const { data: specRows } = await db()
      .from('production_order_line_specs')
      .select('order_line_id, specs')
      .eq('production_order_id', productionOrderId)
    for (const s of (specRows ?? []) as {
      order_line_id: string
      specs: Spec | null
    }[]) {
      if (s.specs) override.set(s.order_line_id, s.specs)
    }
  }

  return ((data ?? []) as RawLine[]).map((r) => {
    const p = Array.isArray(r.product) ? r.product[0] : r.product
    const base: Spec = p?.tech_spec ?? {}
    const ov = override.get(r.id) ?? {}
    return {
      order_line_id: r.id,
      product_code: p?.code ?? '?',
      name_vi: p?.name ?? '?',
      name_foreign: p?.name_foreign ?? null,
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
