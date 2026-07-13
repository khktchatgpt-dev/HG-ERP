import { db } from '@/server/db'
import type { QuoteStatus } from './quotes.schema'

export type Quote = {
  id: string
  code: string
  customer_id: string
  status: QuoteStatus
  currency: string
  valid_from: string | null
  valid_to: string | null
  price_term: string | null
  payment_terms: string | null
  note: string | null
  created_by: string | null
  approved_by: string | null
  approved_at: string | null
  rejected_reason: string | null
  created_at: string
  updated_at: string
}

export type QuoteWithCustomer = Quote & { customer_name: string }

export type QuoteLine = {
  id: string
  quote_id: string
  product_id: string
  qty: number
  unit_price: number
  discount_pct: number | null
  note: string | null
  sort_order: number
  product_code: string
  product_name: string
  product_unit: string
  customer_item_code: string | null
}

export type QuoteLineInput = {
  product_id: string
  qty: number
  unit_price: number
  discount_pct?: number | null
  note?: string | null
}

const COLS =
  'id, code, customer_id, status, currency, valid_from, valid_to, price_term, payment_terms, note, created_by, approved_by, approved_at, rejected_reason, created_at, updated_at'

type RawQuote = Quote & { customer: { name: string } | { name: string }[] | null }

function unwrapCustomer(rows: RawQuote[] | null): QuoteWithCustomer[] {
  return (rows ?? []).map((r) => {
    const c = Array.isArray(r.customer) ? r.customer[0] : r.customer
    return { ...r, customer_name: c?.name ?? '?' }
  })
}

export const quotesRepo = {
  async nextCode(): Promise<string> {
    const { data, error } = await db().rpc('next_doc_code', { p_kind: 'BG' })
    if (error || !data) throw new Error(error?.message ?? 'next_doc_code failed')
    return data as string
  },

  async list(filter: {
    q?: string
    customer_id?: string
    status?: QuoteStatus
    page: number
    page_size: number
  }): Promise<{ rows: QuoteWithCustomer[]; total: number }> {
    let q = db()
      .from('sales_quotes')
      .select(`${COLS}, customer:sales_customers(name)`, { count: 'exact' })
      .order('created_at', { ascending: false })
    if (filter.customer_id) q = q.eq('customer_id', filter.customer_id)
    if (filter.status) q = q.eq('status', filter.status)
    if (filter.q) q = q.ilike('code', `%${filter.q}%`)
    const from = (filter.page - 1) * filter.page_size
    q = q.range(from, from + filter.page_size - 1)
    const { data, count } = await q
    return { rows: unwrapCustomer(data as RawQuote[] | null), total: count ?? 0 }
  },

  async findById(id: string): Promise<QuoteWithCustomer | null> {
    const { data } = await db()
      .from('sales_quotes')
      .select(`${COLS}, customer:sales_customers(name)`)
      .eq('id', id)
      .maybeSingle()
    if (!data) return null
    return unwrapCustomer([data as RawQuote])[0]
  },

  async listLines(quoteId: string): Promise<QuoteLine[]> {
    const { data } = await db()
      .from('sales_quote_lines')
      .select(
        'id, quote_id, product_id, qty, unit_price, discount_pct, note, sort_order, product:technical_products(code, name, unit, customer_item_code)',
      )
      .eq('quote_id', quoteId)
      .order('sort_order')
    type RawLine = Omit<
      QuoteLine,
      'product_code' | 'product_name' | 'product_unit' | 'customer_item_code'
    > & {
      product:
        | { code: string; name: string; unit: string; customer_item_code: string | null }
        | {
            code: string
            name: string
            unit: string
            customer_item_code: string | null
          }[]
        | null
    }
    return ((data ?? []) as RawLine[]).map((r) => {
      const p = Array.isArray(r.product) ? r.product[0] : r.product
      return {
        id: r.id,
        quote_id: r.quote_id,
        product_id: r.product_id,
        qty: r.qty,
        unit_price: r.unit_price,
        discount_pct: r.discount_pct,
        note: r.note,
        sort_order: r.sort_order,
        product_code: p?.code ?? '?',
        product_name: p?.name ?? '?',
        product_unit: p?.unit ?? '',
        customer_item_code: p?.customer_item_code ?? null,
      }
    })
  },

  async insert(
    row: {
      code: string
      customer_id: string
      currency: string
      valid_from?: string | null
      valid_to?: string | null
      price_term?: string | null
      payment_terms?: string | null
      note?: string | null
      created_by: string
    },
    lines: QuoteLineInput[],
  ): Promise<Quote> {
    const { data, error } = await db()
      .from('sales_quotes')
      .insert(row)
      .select(COLS)
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Insert quote failed')
    const quote = data as Quote
    if (lines.length > 0) await this.replaceLines(quote.id, lines)
    return quote
  },

  async replaceLines(quoteId: string, lines: QuoteLineInput[]): Promise<void> {
    const { error: delErr } = await db()
      .from('sales_quote_lines')
      .delete()
      .eq('quote_id', quoteId)
    if (delErr) throw new Error(delErr.message)
    if (lines.length === 0) return
    const { error } = await db()
      .from('sales_quote_lines')
      .insert(
        lines.map((l, i) => ({
          quote_id: quoteId,
          product_id: l.product_id,
          qty: l.qty,
          unit_price: l.unit_price,
          discount_pct: l.discount_pct ?? null,
          note: l.note ?? null,
          sort_order: i,
        })),
      )
    if (error) throw new Error(error.message)
  },

  async patch(id: string, patch: Partial<Quote>): Promise<Quote> {
    const { data, error } = await db()
      .from('sales_quotes')
      .update(patch)
      .eq('id', id)
      .select(COLS)
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Update quote failed')
    return data as Quote
  },

  async delete(id: string): Promise<void> {
    const { error } = await db().from('sales_quotes').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },

  async countLines(quoteId: string): Promise<number> {
    const { count } = await db()
      .from('sales_quote_lines')
      .select('id', { count: 'exact', head: true })
      .eq('quote_id', quoteId)
    return count ?? 0
  },
}

/** Dòng báo giá + đủ thuộc tính SP để in mẫu Quotation (packing, mô tả EN). */
export type QuotePrintLine = {
  qty: number
  unit_price: number
  discount_pct: number | null
  note: string | null
  product_code: string
  product_name: string
  product_unit: string
  customer_item_code: string | null
  description_en: string | null
  image_file_id: string | null
  packing: {
    l_cm?: number
    w_cm?: number
    h_cm?: number
    carton_l_cm?: number
    carton_w_cm?: number
    carton_h_cm?: number
    qty_per_carton?: number
    loading_40hc?: number
  }
}

export async function listQuoteLinesForPrint(quoteId: string): Promise<QuotePrintLine[]> {
  const { data } = await db()
    .from('sales_quote_lines')
    .select(
      'qty, unit_price, discount_pct, note, sort_order, product:technical_products(code, name, unit, customer_item_code, description_en, packing, image_file_id)',
    )
    .eq('quote_id', quoteId)
    .order('sort_order')
  type P = {
    code: string
    name: string
    unit: string
    customer_item_code: string | null
    description_en: string | null
    packing: QuotePrintLine['packing'] | null
    image_file_id: string | null
  }
  type Raw = {
    qty: number
    unit_price: number
    discount_pct: number | null
    note: string | null
    product: P | P[] | null
  }
  return ((data ?? []) as Raw[]).map((r) => {
    const p = Array.isArray(r.product) ? r.product[0] : r.product
    return {
      qty: r.qty,
      unit_price: r.unit_price,
      discount_pct: r.discount_pct,
      note: r.note,
      product_code: p?.code ?? '?',
      product_name: p?.name ?? '?',
      product_unit: p?.unit ?? '',
      customer_item_code: p?.customer_item_code ?? null,
      description_en: p?.description_en ?? null,
      image_file_id: p?.image_file_id ?? null,
      packing: p?.packing ?? {},
    }
  })
}

/** Giá bán gần nhất theo (khách, SP) — gợi ý khi lập báo giá, tránh báo lệch giá. */
export type LastPrice = {
  product_id: string
  unit_price: number
  quote_code: string
  quoted_at: string
}

export async function lastPricesForCustomer(customerId: string): Promise<LastPrice[]> {
  const { data } = await db()
    .from('sales_quote_lines')
    .select(
      'product_id, unit_price, quote:sales_quotes!inner(code, customer_id, created_at)',
    )
    .eq('quote.customer_id', customerId)
    .order('created_at', { ascending: false, referencedTable: 'quote' })
    .limit(500)
  type Raw = {
    product_id: string
    unit_price: number
    quote:
      | { code: string; customer_id: string; created_at: string }
      | { code: string; customer_id: string; created_at: string }[]
  }
  const seen = new Map<string, LastPrice>()
  for (const r of (data ?? []) as Raw[]) {
    const q = Array.isArray(r.quote) ? r.quote[0] : r.quote
    if (!q) continue
    const cur = seen.get(r.product_id)
    if (!cur || q.created_at > cur.quoted_at) {
      seen.set(r.product_id, {
        product_id: r.product_id,
        unit_price: r.unit_price,
        quote_code: q.code,
        quoted_at: q.created_at,
      })
    }
  }
  return [...seen.values()]
}

/**
 * Giá chào gần nhất theo SP trên MỌI khách (bàn chào giá — Sales P3):
 * "SP A — lần gần nhất 145 USD, khách XYZ, SL 2.000, 30 ngày trước".
 * Chỉ tính báo giá ĐÃ GỬI (sent) — nháp chưa phải giá đã chào.
 */
export type LastPriceGlobal = {
  product_id: string
  unit_price: number
  qty: number
  currency: string
  customer_name: string
  quote_code: string
  quoted_at: string
}

export async function lastPricesGlobal(): Promise<LastPriceGlobal[]> {
  const { data } = await db()
    .from('sales_quote_lines')
    .select(
      'product_id, unit_price, qty, quote:sales_quotes!inner(code, status, currency, created_at, customer:sales_customers(name))',
    )
    .eq('quote.status', 'sent')
    .order('created_at', { ascending: false, referencedTable: 'quote' })
    .limit(1000)
  type RawQ = {
    code: string
    status: string
    currency: string
    created_at: string
    customer: { name: string } | { name: string }[] | null
  }
  type Raw = {
    product_id: string
    unit_price: number
    qty: number
    quote: RawQ | RawQ[]
  }
  const seen = new Map<string, LastPriceGlobal>()
  for (const r of (data ?? []) as Raw[]) {
    const q = Array.isArray(r.quote) ? r.quote[0] : r.quote
    if (!q) continue
    const c = Array.isArray(q.customer) ? q.customer[0] : q.customer
    const cur = seen.get(r.product_id)
    if (!cur || q.created_at > cur.quoted_at) {
      seen.set(r.product_id, {
        product_id: r.product_id,
        unit_price: r.unit_price,
        qty: r.qty,
        currency: q.currency,
        customer_name: c?.name ?? '?',
        quote_code: q.code,
        quoted_at: q.created_at,
      })
    }
  }
  return [...seen.values()]
}
