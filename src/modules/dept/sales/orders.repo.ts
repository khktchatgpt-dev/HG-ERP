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
  note: string | null
  sort_order: number
  product_code: string
  product_name: string
  product_unit: string
  customer_item_code: string | null
  bom_status: 'none' | 'drawing' | 'done'
  image_file_id: string | null
}

export type OrderLineInput = {
  product_id: string
  qty: number
  unit_price: number
  note?: string | null
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
  'id, code, quote_id, customer_id, customer_po_no, status, currency, due_date, deposit_percent, price_term, payment_terms, container_summary, note, qty_tolerance_pct, partial_shipment, transhipment, port_of_loading, port_of_discharge, payment_method, required_docs, created_by, created_at, updated_at'

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

  /** Tổng giá trị (Σ qty×unit_price) theo lô đơn — cho KPI dashboard/khách. */
  async totalsByOrderIds(ids: string[]): Promise<Record<string, number>> {
    if (ids.length === 0) return {}
    const { data } = await db()
      .from('sales_order_lines')
      .select('order_id, qty, unit_price')
      .in('order_id', ids)
    const totals: Record<string, number> = {}
    for (const r of (data ?? []) as {
      order_id: string
      qty: number
      unit_price: number
    }[]) {
      totals[r.order_id] = (totals[r.order_id] ?? 0) + r.qty * r.unit_price
    }
    return totals
  },

  async listLines(orderId: string): Promise<OrderLine[]> {
    const { data } = await db()
      .from('sales_order_lines')
      .select(
        'id, order_id, product_id, qty, unit_price, note, sort_order, product:technical_products(code, name, unit, customer_item_code, bom_status, image_file_id)',
      )
      .eq('order_id', orderId)
      .order('sort_order')
    type P = {
      code: string
      name: string
      unit: string
      customer_item_code: string | null
      bom_status: 'none' | 'drawing' | 'done'
      image_file_id: string | null
    }
    type RawLine = Omit<
      OrderLine,
      | 'product_code'
      | 'product_name'
      | 'product_unit'
      | 'customer_item_code'
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
        note: r.note,
        sort_order: r.sort_order,
        product_code: p?.code ?? '?',
        product_name: p?.name ?? '?',
        product_unit: p?.unit ?? '',
        customer_item_code: p?.customer_item_code ?? null,
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

  async replaceLines(orderId: string, lines: OrderLineInput[]): Promise<void> {
    const { error: delErr } = await db()
      .from('sales_order_lines')
      .delete()
      .eq('order_id', orderId)
    if (delErr) throw new Error(delErr.message)
    if (lines.length === 0) return
    const { error } = await db()
      .from('sales_order_lines')
      .insert(
        lines.map((l, i) => ({
          order_id: orderId,
          product_id: l.product_id,
          qty: l.qty,
          unit_price: l.unit_price,
          note: l.note ?? null,
          sort_order: i,
        })),
      )
    if (error) throw new Error(error.message)
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
}
