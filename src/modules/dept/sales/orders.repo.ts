import { db } from '@/server/db'
import type { Json } from '@/lib/database.types'
import type { OrderStatus } from './orders.schema'

export type Order = {
  id: string
  code: string
  quote_id: string | null
  customer_id: string
  customer_po_no: string | null
  status: OrderStatus
  currency: string
  due_date: string | null
  deposit_percent: number | null
  price_term: string | null
  payment_terms: string | null
  container_summary: string | null
  note: string | null
  qty_tolerance_pct: number | null
  partial_shipment: boolean | null
  transhipment: boolean | null
  port_of_loading: string | null
  port_of_discharge: string | null
  payment_method: string | null
  required_docs: string | null
  /** Lệnh sản xuất đang chạy đơn này — NULL = chưa phát lệnh (0113). */
  production_order_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type OrderWithCustomer = Order & {
  customer_name: string
  quote_code: string | null
}

export type OrderLine = {
  id: string
  order_id: string
  product_id: string
  qty: number
  unit_price: number
  ship_date: string | null
  note: string | null
  sort_order: number
  product_code: string
  product_name: string
  product_unit: string
  customer_item_code: string | null
  /** EAN/barcode của SP — cột EAN CODE trên sổ đơn + hợp đồng. */
  barcode: string | null
  /** Mô tả tiếng Anh — DESCRIPTION OF GOODS trên Sales Contract. */
  description_en: string | null
  bom_status: 'none' | 'drawing' | 'done'
  image_file_id: string | null
}

/** Số liệu gộp của các dòng trong một đơn — bảng danh sách đọc thẳng. */
export type OrderLineSummary = { lines: number; qty: number; total: number }

export type OrderLineInput = {
  product_id: string
  qty: number
  unit_price: number
  ship_date?: string | null
  note?: string | null
}

/** Một đợt thực xuất của một dòng đơn (0120) — đã xuất = Σ qty theo dòng. */
export type OrderShipment = {
  id: string
  order_id: string
  order_line_id: string
  qty: number
  shipped_at: string
  note: string | null
  created_by: string | null
  created_by_name: string | null
  created_at: string
}

export type OrderChange = {
  id: string
  order_id: string
  changed_by: string | null
  changed_by_name: string | null
  change: Record<string, unknown>
  note: string | null
  created_at: string
}

const COLS =
  'id, code, quote_id, customer_id, customer_po_no, status, currency, due_date, deposit_percent, price_term, payment_terms, container_summary, note, qty_tolerance_pct, partial_shipment, transhipment, port_of_loading, port_of_discharge, payment_method, required_docs, production_order_id, created_by, created_at, updated_at'

type RawOrder = Order & {
  customer: { name: string } | { name: string }[] | null
  quote: { code: string } | { code: string }[] | null
}

function unwrap(rows: RawOrder[] | null): OrderWithCustomer[] {
  return (rows ?? []).map((r) => {
    const c = Array.isArray(r.customer) ? r.customer[0] : r.customer
    const q = Array.isArray(r.quote) ? r.quote[0] : r.quote
    return { ...r, customer_name: c?.name ?? '?', quote_code: q?.code ?? null }
  })
}

export const ordersRepo = {
  async nextCode(): Promise<string> {
    const { data, error } = await db().rpc('next_doc_code', { p_kind: 'DH' })
    if (error || !data) throw new Error(error?.message ?? 'next_doc_code failed')
    return data as string
  },

  async existsByCode(code: string): Promise<boolean> {
    const { data } = await db()
      .from('sales_orders')
      .select('id')
      .eq('code', code)
      .maybeSingle()
    return !!data
  },

  async list(filter: {
    q?: string
    customer_id?: string
    status?: OrderStatus
    page: number
    page_size: number
  }): Promise<{ rows: OrderWithCustomer[]; total: number }> {
    let q = db()
      .from('sales_orders')
      .select(`${COLS}, customer:sales_customers(name), quote:sales_quotes(code)`, {
        count: 'exact',
      })
      .order('created_at', { ascending: false })
    if (filter.customer_id) q = q.eq('customer_id', filter.customer_id)
    if (filter.status) q = q.eq('status', filter.status)
    if (filter.q) q = q.or(`code.ilike.%${filter.q}%,customer_po_no.ilike.%${filter.q}%`)
    const from = (filter.page - 1) * filter.page_size
    q = q.range(from, from + filter.page_size - 1)
    const { data, count } = await q
    return { rows: unwrap(data as RawOrder[] | null), total: count ?? 0 }
  },

  async findById(id: string): Promise<OrderWithCustomer | null> {
    const { data } = await db()
      .from('sales_orders')
      .select(`${COLS}, customer:sales_customers(name), quote:sales_quotes(code)`)
      .eq('id', id)
      .maybeSingle()
    if (!data) return null
    return unwrap([data as RawOrder])[0]
  },

  /**
   * Σ số dòng / số lượng / giá trị theo lô đơn — MỘT truy vấn cho cả trang danh
   * sách (bảng đơn hàng hiện SL và giá trị từng đơn, đừng gọi N lần).
   *
   * NGƯỠNG: Supabase trả tối đa `max-rows` (mặc định 1000) mỗi truy vấn, nên
   * quá ~1000 dòng đơn thì tổng bị hụt âm thầm. Hiện ~90 dòng nên chưa chạm;
   * khi tới ngưỡng phải chuyển sang view/RPC cộng ở Postgres.
   */
  async lineSummaryByOrderIds(ids: string[]): Promise<Record<string, OrderLineSummary>> {
    if (ids.length === 0) return {}
    const { data } = await db()
      .from('sales_order_lines')
      .select('order_id, qty, unit_price')
      .in('order_id', ids)
    const out: Record<string, OrderLineSummary> = {}
    for (const r of (data ?? []) as {
      order_id: string
      qty: number
      unit_price: number
    }[]) {
      const e = (out[r.order_id] ??= { lines: 0, qty: 0, total: 0 })
      e.lines += 1
      e.qty += r.qty
      e.total += r.qty * r.unit_price
    }
    return out
  },

  /** Tổng giá trị (Σ qty×unit_price) theo lô đơn — cho KPI dashboard/khách. */
  async totalsByOrderIds(ids: string[]): Promise<Record<string, number>> {
    const summary = await ordersRepo.lineSummaryByOrderIds(ids)
    const totals: Record<string, number> = {}
    for (const [id, s] of Object.entries(summary)) totals[id] = s.total
    return totals
  },

  /** Đơn thuộc một lệnh sản xuất (N đơn : 1 LSX, 0113) — sắp theo mã đơn. */
  async listByProductionOrder(lsxId: string): Promise<OrderWithCustomer[]> {
    const { data } = await db()
      .from('sales_orders')
      .select(`${COLS}, customer:sales_customers(name), quote:sales_quotes(code)`)
      .eq('production_order_id', lsxId)
      .order('code')
    return unwrap(data as RawOrder[] | null)
  },

  /**
   * Đơn đã xác nhận, CHƯA thuộc lệnh nào, của một khách — danh sách để gộp vào
   * lệnh sản xuất (phát lệnh mới hoặc thêm vào lệnh đang chạy).
   */
  async listMergeCandidates(customerId: string): Promise<OrderWithCustomer[]> {
    const { data } = await db()
      .from('sales_orders')
      .select(`${COLS}, customer:sales_customers(name), quote:sales_quotes(code)`)
      .eq('customer_id', customerId)
      .eq('status', 'confirmed')
      .is('production_order_id', null)
      .order('code')
      .limit(200)
    return unwrap(data as RawOrder[] | null)
  },

  /**
   * MỌI đơn đã xác nhận mà CHƯA phát lệnh — hàng đợi việc của Sales trên trang
   * Lệnh sản xuất. Khác `listMergeCandidates` ở chỗ không giới hạn một khách.
   */
  async listAwaitingLsx(): Promise<OrderWithCustomer[]> {
    const { data } = await db()
      .from('sales_orders')
      .select(`${COLS}, customer:sales_customers(name), quote:sales_quotes(code)`)
      .eq('status', 'confirmed')
      .is('production_order_id', null)
      .order('created_at', { ascending: true })
      .limit(300)
    return unwrap(data as RawOrder[] | null)
  },

  async listLines(orderId: string): Promise<OrderLine[]> {
    return ordersRepo.listLinesByOrders([orderId])
  },

  /** Dòng SP của NHIỀU đơn — lệnh gộp nhiều đơn đọc một phát cho cả lệnh. */
  async listLinesByOrders(orderIds: string[]): Promise<OrderLine[]> {
    if (!orderIds.length) return []
    const { data } = await db()
      .from('sales_order_lines')
      .select(
        'id, order_id, product_id, qty, unit_price, ship_date, note, sort_order, product:technical_products(code, name, unit, customer_item_code, barcode, description_en, bom_status, image_file_id)',
      )
      .in('order_id', orderIds)
      .order('sort_order')
    type P = {
      code: string
      name: string
      unit: string
      customer_item_code: string | null
      barcode: string | null
      description_en: string | null
      bom_status: 'none' | 'drawing' | 'done'
      image_file_id: string | null
    }
    type RawLine = Omit<
      OrderLine,
      | 'product_code'
      | 'product_name'
      | 'product_unit'
      | 'customer_item_code'
      | 'barcode'
      | 'description_en'
      | 'bom_status'
      | 'image_file_id'
    > & { product: P | P[] | null }
    return ((data ?? []) as RawLine[]).map((r) => {
      const p = Array.isArray(r.product) ? r.product[0] : r.product
      return {
        id: r.id,
        order_id: r.order_id,
        product_id: r.product_id,
        qty: r.qty,
        unit_price: r.unit_price,
        ship_date: r.ship_date,
        note: r.note,
        sort_order: r.sort_order,
        product_code: p?.code ?? '?',
        product_name: p?.name ?? '?',
        product_unit: p?.unit ?? '',
        customer_item_code: p?.customer_item_code ?? null,
        barcode: p?.barcode ?? null,
        description_en: p?.description_en ?? null,
        bom_status: p?.bom_status ?? 'none',
        image_file_id: p?.image_file_id ?? null,
      }
    })
  },

  async insert(
    row: {
      code: string
      quote_id: string | null
      customer_id: string
      customer_po_no?: string | null
      currency: string
      due_date?: string | null
      deposit_percent?: number | null
      price_term?: string | null
      payment_terms?: string | null
      container_summary?: string | null
      note?: string | null
      qty_tolerance_pct?: number | null
      partial_shipment?: boolean | null
      transhipment?: boolean | null
      port_of_loading?: string | null
      port_of_discharge?: string | null
      payment_method?: string | null
      required_docs?: string | null
      created_by: string
    },
    lines: OrderLineInput[],
  ): Promise<Order> {
    const { data, error } = await db()
      .from('sales_orders')
      .insert(row)
      .select(COLS)
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Insert order failed')
    const order = data as Order
    if (lines.length > 0) await this.replaceLines(order.id, lines)
    return order
  },

  /**
   * Đồng bộ dòng đơn theo danh sách mới — GIỮ NGUYÊN id của dòng còn lại (khớp
   * theo product_id, mỗi SP một dòng). Bản cũ xoá sạch rồi chèn lại: id dòng đổi
   * hết → FK cascade nuốt luôn lịch sử xuất hàng (0120) và link công việc SX
   * (production_jobs.order_line_id) của cả những dòng KHÔNG đổi gì.
   */
  async replaceLines(orderId: string, lines: OrderLineInput[]): Promise<void> {
    const { data: existing, error: exErr } = await db()
      .from('sales_order_lines')
      .select('id, product_id')
      .eq('order_id', orderId)
    if (exErr) throw new Error(exErr.message)
    const byProduct = new Map(
      ((existing ?? []) as { id: string; product_id: string }[]).map((r) => [
        r.product_id,
        r.id,
      ]),
    )

    type LineRow = {
      order_id: string
      product_id: string
      qty: number
      unit_price: number
      ship_date: string | null
      note: string | null
      sort_order: number
    }
    const keepIds: string[] = []
    const inserts: LineRow[] = []
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]
      const row = {
        qty: l.qty,
        unit_price: l.unit_price,
        ship_date: l.ship_date ?? null,
        note: l.note ?? null,
        sort_order: i,
      }
      const id = byProduct.get(l.product_id)
      if (id) {
        const { error } = await db().from('sales_order_lines').update(row).eq('id', id)
        if (error) throw new Error(error.message)
        keepIds.push(id)
      } else {
        inserts.push({ ...row, order_id: orderId, product_id: l.product_id })
      }
    }
    if (inserts.length > 0) {
      const { error } = await db().from('sales_order_lines').insert(inserts)
      if (error) throw new Error(error.message)
    }
    // Xoá dòng bị bỏ = dòng CŨ không nằm trong danh sách giữ (không đụng dòng
    // vừa chèn — chỉ nhắm vào id đã tồn tại trước khi sync).
    const keep = new Set(keepIds)
    const removeIds = [...byProduct.values()].filter((id) => !keep.has(id))
    if (removeIds.length > 0) {
      const { error: delErr } = await db()
        .from('sales_order_lines')
        .delete()
        .in('id', removeIds)
      if (delErr) throw new Error(delErr.message)
    }
  },

  async patch(id: string, patch: Partial<Order>): Promise<Order> {
    const { data, error } = await db()
      .from('sales_orders')
      .update(patch)
      .eq('id', id)
      .select(COLS)
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Update order failed')
    return data as Order
  },

  /** Lịch sử thay đổi (FR-SAL-05) — append-only. */
  async insertChange(row: {
    order_id: string
    changed_by: string
    change: Record<string, unknown>
    note?: string | null
  }): Promise<void> {
    const { error } = await db()
      .from('sales_order_changes')
      .insert({ ...row, change: row.change as Json })
    if (error) throw new Error(error.message)
  },

  async listChanges(orderId: string): Promise<OrderChange[]> {
    const { data } = await db()
      .from('sales_order_changes')
      .select('id, order_id, changed_by, change, note, created_at, actor:users(name)')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })
    type Raw = Omit<OrderChange, 'changed_by_name'> & {
      actor: { name: string | null } | { name: string | null }[] | null
    }
    return ((data ?? []) as Raw[]).map((r) => {
      const a = Array.isArray(r.actor) ? r.actor[0] : r.actor
      return {
        id: r.id,
        order_id: r.order_id,
        changed_by: r.changed_by,
        changed_by_name: a?.name ?? null,
        change: r.change,
        note: r.note,
        created_at: r.created_at,
      }
    })
  },

  /** Thay đổi đơn của 1 KHÁCH (mọi đơn) — tab Hoạt động ở hồ sơ khách (P4). */
  async listChangesByCustomer(
    customerId: string,
    limit = 100,
  ): Promise<(OrderChange & { order_code: string })[]> {
    const { data } = await db()
      .from('sales_order_changes')
      .select(
        'id, order_id, changed_by, change, note, created_at, actor:users(name), order:sales_orders!inner(code, customer_id)',
      )
      .eq('order.customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(limit)
    type Raw = Omit<OrderChange, 'changed_by_name'> & {
      actor: { name: string | null } | { name: string | null }[] | null
      order: { code: string } | { code: string }[] | null
    }
    return ((data ?? []) as Raw[]).map((r) => {
      const a = Array.isArray(r.actor) ? r.actor[0] : r.actor
      const o = Array.isArray(r.order) ? r.order[0] : r.order
      return {
        id: r.id,
        order_id: r.order_id,
        changed_by: r.changed_by,
        changed_by_name: a?.name ?? null,
        change: r.change,
        note: r.note,
        created_at: r.created_at,
        order_code: o?.code ?? '?',
      }
    })
  },

  // ── Giao hàng từng phần (0120) ────────────────────────────────────────────

  async listShipments(orderId: string): Promise<OrderShipment[]> {
    const { data } = await db()
      .from('sales_order_shipments')
      .select(
        'id, order_id, order_line_id, qty, shipped_at, note, created_by, created_at, actor:users(name)',
      )
      .eq('order_id', orderId)
      .order('shipped_at', { ascending: false })
      .order('created_at', { ascending: false })
    type Raw = Omit<OrderShipment, 'created_by_name'> & {
      actor: { name: string | null } | { name: string | null }[] | null
    }
    return ((data ?? []) as Raw[]).map((r) => {
      const a = Array.isArray(r.actor) ? r.actor[0] : r.actor
      return {
        id: r.id,
        order_id: r.order_id,
        order_line_id: r.order_line_id,
        qty: r.qty,
        shipped_at: r.shipped_at,
        note: r.note,
        created_by: r.created_by,
        created_by_name: a?.name ?? null,
        created_at: r.created_at,
      }
    })
  },

  async findShipment(id: string): Promise<OrderShipment | null> {
    const { data } = await db()
      .from('sales_order_shipments')
      .select(
        'id, order_id, order_line_id, qty, shipped_at, note, created_by, created_at',
      )
      .eq('id', id)
      .maybeSingle()
    return data
      ? { ...(data as Omit<OrderShipment, 'created_by_name'>), created_by_name: null }
      : null
  },

  async insertShipment(row: {
    order_id: string
    order_line_id: string
    qty: number
    shipped_at?: string | null
    note?: string | null
    created_by: string
  }): Promise<void> {
    const { error } = await db()
      .from('sales_order_shipments')
      .insert({
        order_id: row.order_id,
        order_line_id: row.order_line_id,
        qty: row.qty,
        ...(row.shipped_at ? { shipped_at: row.shipped_at } : {}),
        note: row.note ?? null,
        created_by: row.created_by,
      })
    if (error) throw new Error(error.message)
  },

  async deleteShipment(id: string): Promise<void> {
    const { error } = await db().from('sales_order_shipments').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },

  /** Σ đã xuất theo từng dòng của MỘT đơn — "ĐÃ XUẤT / CÒN" đọc từ đây. */
  async shippedByLine(orderId: string): Promise<Record<string, number>> {
    const { data } = await db()
      .from('sales_order_shipments')
      .select('order_line_id, qty')
      .eq('order_id', orderId)
    const out: Record<string, number> = {}
    for (const r of (data ?? []) as { order_line_id: string; qty: number }[]) {
      out[r.order_line_id] = (out[r.order_line_id] ?? 0) + r.qty
    }
    return out
  },

  /** Σ đã xuất theo LÔ đơn (một query cho cả trang danh sách). */
  async shippedByOrderIds(ids: string[]): Promise<Record<string, number>> {
    if (ids.length === 0) return {}
    const { data } = await db()
      .from('sales_order_shipments')
      .select('order_id, qty')
      .in('order_id', ids)
    const out: Record<string, number> = {}
    for (const r of (data ?? []) as { order_id: string; qty: number }[]) {
      out[r.order_id] = (out[r.order_id] ?? 0) + r.qty
    }
    return out
  },
}
