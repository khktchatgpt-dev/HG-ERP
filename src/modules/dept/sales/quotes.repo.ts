import { db } from '@/server/db'
import { packingWithDims } from '@/lib/packing-dims'

/**
 * Quy cách của dòng báo giá = `packing` gõ tay, THIẾU thì bù từ 3 cột mm của hồ
 * sơ SP (xem `@/lib/packing-dims`). Không bù thì bản in trống kích thước với 341
 * SP đã có số đo — chỉ vì số nằm ở bộ cột kia.
 */
function withDims(
  p: {
    packing?: unknown
    length_mm: number | null
    width_mm: number | null
    height_mm: number | null
  } | null,
) {
  if (!p) return {}
  return packingWithDims((p.packing ?? {}) as Record<string, number | undefined>, p)
}
import type { QuoteStatus } from './quotes.schema'
import type { ProductPacking } from '@/modules/dept/technical/technical.repo'

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
  /** Trình GĐ duyệt lần gần nhất (0149) — null nếu chưa từng trình. */
  submitted_at: string | null
  submitted_by: string | null
  approved_by: string | null
  approved_at: string | null
  rejected_reason: string | null
  /** Số bản (1 = bản đầu) và bản trước mà bản này sửa (0225). */
  revision_no: number
  revision_of: string | null
  lost_reason: string | null
  created_at: string
  updated_at: string
}

export type QuoteWithCustomer = Quote & { customer_name: string }

export type QuoteLine = {
  id: string
  quote_id: string
  product_id: string
  qty: number | null
  unit_price: number
  discount_pct: number | null
  /** Giá thành KH chụp lúc chào (0225) — null khi người lập không có quyền xem giá thành. */
  plan_price_snapshot: number | null
  note: string | null
  sort_order: number
  product_code: string
  product_name: string
  product_unit: string
  customer_item_code: string | null
  // Quy cách SP (từ Kỹ thuật) để hiện đầy đủ như tờ báo giá thật — thiếu = null.
  description_en: string | null
  image_file_id: string | null
  packing: ProductPacking
}

export type QuoteLineInput = {
  product_id: string
  qty?: number | null
  unit_price: number
  discount_pct?: number | null
  note?: string | null
  plan_price_snapshot?: number | null
}

const COLS_LEGACY =
  'id, code, customer_id, status, currency, valid_from, valid_to, price_term, payment_terms, note, created_by, submitted_at, submitted_by, approved_by, approved_at, rejected_reason, created_at, updated_at'
const COLS_0225 = `${COLS_LEGACY}, revision_no, revision_of, lost_reason`

/**
 * 0225 CHƯA ÁP thì không chọn/ghi được cột mới — dò một lần rồi nhớ (07/10/2026).
 * Thiếu cột: bản = 1, không chuỗi sửa đổi, không chụp giá thành. Áp xong thì
 * khởi động lại server là đủ.
 */
let has0225: boolean | null = null
async function probe0225(): Promise<boolean> {
  if (has0225 != null) return has0225
  const { error } = await db().from('sales_quotes').select('revision_no').limit(1)
  has0225 = !error
  if (!has0225)
    console.error('[sales_quotes] 0225 chưa áp — chạy ở chế độ cột cũ:', error?.message)
  return has0225
}
async function cols(): Promise<string> {
  return (await probe0225()) ? COLS_0225 : COLS_LEGACY
}

type RawQuote = Quote & { customer: { name: string } | { name: string }[] | null }

function unwrapCustomer(rows: RawQuote[] | null): QuoteWithCustomer[] {
  return (rows ?? []).map((r) => {
    const c = Array.isArray(r.customer) ? r.customer[0] : r.customer
    return {
      ...r,
      revision_no: r.revision_no ?? 1,
      revision_of: r.revision_of ?? null,
      lost_reason: r.lost_reason ?? null,
      customer_name: c?.name ?? '?',
    }
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
      .select(`${await cols()}, customer:sales_customers(name)`, { count: 'exact' })
      .order('created_at', { ascending: false })
    if (filter.customer_id) q = q.eq('customer_id', filter.customer_id)
    if (filter.status) q = q.eq('status', filter.status)
    if (filter.q) q = q.ilike('code', `%${filter.q}%`)
    const from = (filter.page - 1) * filter.page_size
    q = q.range(from, from + filter.page_size - 1)
    const { data, count } = await q
    return {
      rows: unwrapCustomer(data as unknown as RawQuote[] | null),
      total: count ?? 0,
    }
  },

  async findById(id: string): Promise<QuoteWithCustomer | null> {
    const { data } = await db()
      .from('sales_quotes')
      .select(`${await cols()}, customer:sales_customers(name)`)
      .eq('id', id)
      .maybeSingle()
    if (!data) return null
    return unwrapCustomer([data as unknown as RawQuote])[0]
  },

  async listLines(quoteId: string): Promise<QuoteLine[]> {
    const { data } = await db()
      .from('sales_quote_lines')
      .select(
        (await probe0225())
          ? 'id, quote_id, product_id, qty, unit_price, discount_pct, plan_price_snapshot, note, sort_order, product:technical_products(code, name, unit, customer_item_code, description_en, image_file_id, packing, length_mm, width_mm, height_mm)'
          : 'id, quote_id, product_id, qty, unit_price, discount_pct, note, sort_order, product:technical_products(code, name, unit, customer_item_code, description_en, image_file_id, packing, length_mm, width_mm, height_mm)',
      )
      .eq('quote_id', quoteId)
      .order('sort_order')
    type RawProduct = {
      code: string
      name: string
      unit: string
      customer_item_code: string | null
      description_en: string | null
      image_file_id: string | null
      packing: ProductPacking | null
      length_mm: number | null
      width_mm: number | null
      height_mm: number | null
    }

    type RawLine = {
      id: string
      quote_id: string
      product_id: string
      qty: number | null
      unit_price: number
      discount_pct: number | null
      plan_price_snapshot?: number | null
      note: string | null
      sort_order: number
      product: RawProduct | RawProduct[] | null
    }
    return ((data ?? []) as unknown as RawLine[]).map((r) => {
      const p = Array.isArray(r.product) ? r.product[0] : r.product
      return {
        id: r.id,
        quote_id: r.quote_id,
        product_id: r.product_id,
        qty: r.qty == null ? null : Number(r.qty),
        unit_price: r.unit_price,
        discount_pct: r.discount_pct,
        plan_price_snapshot:
          r.plan_price_snapshot == null ? null : Number(r.plan_price_snapshot),
        note: r.note,
        sort_order: r.sort_order,
        product_code: p?.code ?? '?',
        product_name: p?.name ?? '?',
        product_unit: p?.unit ?? '',
        customer_item_code: p?.customer_item_code ?? null,
        description_en: p?.description_en ?? null,
        image_file_id: p?.image_file_id ?? null,
        packing: withDims(p),
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
      revision_no?: number
      revision_of?: string | null
    },
    lines: QuoteLineInput[],
  ): Promise<Quote> {
    const ok = await probe0225()
    const { revision_no, revision_of, ...legacy } = row
    void revision_no
    void revision_of
    const { data, error } = await db()
      .from('sales_quotes')
      .insert(ok ? row : legacy)
      .select(await cols())
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Insert quote failed')
    const quote = data as unknown as Quote
    if (lines.length > 0) await this.replaceLines(quote.id, lines)
    return quote
  },

  async replaceLines(quoteId: string, lines: QuoteLineInput[]): Promise<void> {
    const ok = await probe0225()
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
          qty: l.qty ?? null,
          unit_price: l.unit_price,
          discount_pct: l.discount_pct ?? null,
          ...(ok
            ? {
                plan_price_snapshot: l.plan_price_snapshot ?? null,
                plan_at: l.plan_price_snapshot == null ? null : new Date().toISOString(),
              }
            : {}),
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
      .select(await cols())
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Update quote failed')
    return data as unknown as Quote
  },

  async delete(id: string): Promise<void> {
    const { error } = await db().from('sales_quotes').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },

  /** Chuỗi bản sửa đổi: mọi báo giá có cùng gốc (đi ngược revision_of tới bản đầu). */
  async listRevisions(id: string): Promise<QuoteWithCustomer[]> {
    if (!(await probe0225())) {
      const one = await this.findById(id)
      return one ? [one] : []
    }
    // Tìm gốc: đi ngược tối đa 50 bước.
    let rootId = id
    for (let i = 0; i < 50; i++) {
      const cur = await this.findById(rootId)
      if (!cur?.revision_of) break
      rootId = cur.revision_of
    }
    const out: QuoteWithCustomer[] = []
    let frontier = [rootId]
    for (let i = 0; i < 50 && frontier.length; i++) {
      const { data } = await db()
        .from('sales_quotes')
        .select(`${await cols()}, customer:sales_customers(name)`)
        .in('id', frontier)
      const rows = unwrapCustomer(data as unknown as RawQuote[] | null)
      out.push(...rows.filter((r) => !out.some((x) => x.id === r.id)))
      const { data: kids } = await db()
        .from('sales_quotes')
        .select('id')
        .in('revision_of', frontier)
      frontier = ((kids ?? []) as { id: string }[]).map((k) => k.id)
    }
    return out.sort(
      (a, b) => a.revision_no - b.revision_no || a.created_at.localeCompare(b.created_at),
    )
  },

  /** Đơn hàng sinh từ các báo giá — nút thông minh "Đơn hàng n". */
  async ordersByQuoteIds(
    ids: string[],
  ): Promise<Map<string, { id: string; code: string; status: string }[]>> {
    const m = new Map<string, { id: string; code: string; status: string }[]>()
    if (!ids.length) return m
    const { data } = await db()
      .from('sales_orders')
      .select('id, code, status, quote_id')
      .in('quote_id', ids)
    for (const r of (data ?? []) as {
      id: string
      code: string
      status: string
      quote_id: string
    }[]) {
      const arr = m.get(r.quote_id) ?? []
      arr.push({ id: r.id, code: r.code, status: r.status })
      m.set(r.quote_id, arr)
    }
    return m
  },

  /** Dòng của nhiều báo giá (SL · giá · CK) — trị giá tham chiếu của sổ, một query cho cả trang. */
  async linesByQuoteIds(ids: string[]): Promise<
    {
      quote_id: string
      qty: number | null
      unit_price: number
      discount_pct: number | null
    }[]
  > {
    if (!ids.length) return []
    const { data } = await db()
      .from('sales_quote_lines')
      .select('quote_id, qty, unit_price, discount_pct')
      .in('quote_id', ids)
      .limit(5000)
    return (
      (data ?? []) as {
        quote_id: string
        qty: number | null
        unit_price: number
        discount_pct: number | null
      }[]
    ).map((r) => ({
      ...r,
      qty: r.qty == null ? null : Number(r.qty),
      unit_price: Number(r.unit_price),
    }))
  },

  /** Số bản sửa đổi đã sinh từ mỗi báo giá (revision_of = id). */
  async revisionCountByIds(ids: string[]): Promise<Map<string, number>> {
    const m = new Map<string, number>()
    if (!ids.length) return m
    const { data } = await db()
      .from('sales_quotes')
      .select('revision_of')
      .in('revision_of', ids)
    for (const r of (data ?? []) as { revision_of: string | null }[]) {
      if (r.revision_of) m.set(r.revision_of, (m.get(r.revision_of) ?? 0) + 1)
    }
    return m
  },

  async countLines(quoteId: string): Promise<number> {
    const { count } = await db()
      .from('sales_quote_lines')
      .select('id', { count: 'exact', head: true })
      .eq('quote_id', quoteId)
    return count ?? 0
  },

  /** Số dòng SP theo từng báo giá — cột "SP" của sổ báo giá (một query cho cả trang). */
  async lineCountByQuoteIds(ids: string[]): Promise<Map<string, number>> {
    const m = new Map<string, number>()
    if (ids.length === 0) return m
    const { data } = await db()
      .from('sales_quote_lines')
      .select('quote_id')
      .in('quote_id', ids)
    for (const r of (data ?? []) as { quote_id: string }[]) {
      m.set(r.quote_id, (m.get(r.quote_id) ?? 0) + 1)
    }
    return m
  },

  /** Tên người lập theo user ids — dòng phụ "tạo … bởi …" của sổ báo giá. */
  async ownerNamesByIds(ids: string[]): Promise<Map<string, string>> {
    const m = new Map<string, string>()
    const uniq = [...new Set(ids)]
    if (uniq.length === 0) return m
    const { data } = await db().from('users').select('id, name').in('id', uniq)
    for (const r of (data ?? []) as { id: string; name: string }[]) m.set(r.id, r.name)
    return m
  },
}

/** Dòng báo giá + đủ thuộc tính SP để in mẫu Quotation (packing, mô tả EN). */
export type QuotePrintLine = {
  /** SL dự kiến / MOQ (0225) — null = chào đơn giá, không in cột SL. */
  qty: number | null
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
      'qty, unit_price, discount_pct, note, sort_order, product:technical_products(code, name, unit, customer_item_code, description_en, packing, image_file_id, length_mm, width_mm, height_mm)',
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
    length_mm: number | null
    width_mm: number | null
    height_mm: number | null
  }
  type Raw = {
    qty: number | null
    unit_price: number
    discount_pct: number | null
    note: string | null
    product: P | P[] | null
  }
  return ((data ?? []) as Raw[]).map((r) => {
    const p = Array.isArray(r.product) ? r.product[0] : r.product
    return {
      qty: r.qty == null ? null : Number(r.qty),
      unit_price: r.unit_price,
      discount_pct: r.discount_pct,
      note: r.note,
      product_code: p?.code ?? '?',
      product_name: p?.name ?? '?',
      product_unit: p?.unit ?? '',
      customer_item_code: p?.customer_item_code ?? null,
      description_en: p?.description_en ?? null,
      image_file_id: p?.image_file_id ?? null,
      packing: withDims(p),
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

export async function lastPricesForCustomer(
  customerId: string,
  currency?: string | null,
): Promise<LastPrice[]> {
  // Chỉ giá ĐÃ CHÀO (sent) hoặc GĐ đã duyệt — bản nháp chưa phải giá; và cùng
  // tiền tệ, không thì giá USD bị điền vào báo giá EUR (07/10/2026).
  let q = db()
    .from('sales_quote_lines')
    .select(
      'product_id, unit_price, quote:sales_quotes!inner(code, customer_id, status, currency, created_at)',
    )
    .eq('quote.customer_id', customerId)
    .in('quote.status', ['sent', 'approved', 'won'])
  if (currency) q = q.eq('quote.currency', currency)
  const { data } = await q
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
  currency: string
  customer_name: string
  quote_code: string
  quoted_at: string
}

export async function lastPricesGlobal(): Promise<LastPriceGlobal[]> {
  const { data } = await db()
    .from('sales_quote_lines')
    .select(
      'product_id, unit_price, quote:sales_quotes!inner(code, status, currency, created_at, customer:sales_customers(name))',
    )
    .in('quote.status', ['sent', 'won'])
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
        currency: q.currency,
        customer_name: c?.name ?? '?',
        quote_code: q.code,
        quoted_at: q.created_at,
      })
    }
  }
  return [...seen.values()]
}
