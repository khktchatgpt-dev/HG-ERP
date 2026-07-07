import { db } from '@/server/db'
import type { BomStatus } from './technical.schema'

export type ProductPacking = {
  l_cm?: number
  w_cm?: number
  h_cm?: number
  carton_l_cm?: number
  carton_w_cm?: number
  carton_h_cm?: number
  qty_per_carton?: number
  loading_40hc?: number
}

export type Product = {
  id: string
  code: string
  name: string
  category: string | null
  customer_id: string | null
  customer_item_code: string | null
  description_en: string | null
  unit: string
  bom_status: BomStatus
  packing: ProductPacking
  drawing_url: string | null
  bom_url: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type BomLine = {
  id: string
  product_id: string
  material_id: string
  qty_per_unit: number
  note: string | null
  sort_order: number
}

// Một string literal duy nhất — supabase-js suy type cột từ literal, nối chuỗi sẽ hỏng.
const COLS =
  'id, code, name, category, customer_id, customer_item_code, description_en, unit, bom_status, packing, drawing_url, bom_url, notes, is_active, created_at, updated_at'

export const productsRepo = {
  async list(filter: {
    q?: string
    category?: string
    customer_id?: string
    bom_status?: BomStatus
    active_only: boolean
    page: number
    page_size: number
  }): Promise<{ rows: Product[]; total: number }> {
    let q = db()
      .from('technical_products')
      .select(COLS, { count: 'exact' })
      .order('created_at', { ascending: false })
    if (filter.active_only) q = q.eq('is_active', true)
    if (filter.category) q = q.eq('category', filter.category)
    if (filter.customer_id) q = q.eq('customer_id', filter.customer_id)
    if (filter.bom_status) q = q.eq('bom_status', filter.bom_status)
    if (filter.q) {
      q = q.or(
        `name.ilike.%${filter.q}%,code.ilike.%${filter.q}%,customer_item_code.ilike.%${filter.q}%`,
      )
    }
    const from = (filter.page - 1) * filter.page_size
    const to = from + filter.page_size - 1
    q = q.range(from, to)
    const { data, count } = await q
    return { rows: (data ?? []) as Product[], total: count ?? 0 }
  },

  async findById(id: string): Promise<Product | null> {
    const { data } = await db()
      .from('technical_products')
      .select(COLS)
      .eq('id', id)
      .maybeSingle()
    return (data as Product | null) ?? null
  },

  async existsByCode(code: string): Promise<boolean> {
    const { data } = await db()
      .from('technical_products')
      .select('id')
      .eq('code', code)
      .maybeSingle()
    return !!data
  },

  async insert(row: Partial<Product> & Pick<Product, 'code' | 'name'>): Promise<Product> {
    const { data, error } = await db()
      .from('technical_products')
      .insert(row)
      .select(COLS)
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Insert product failed')
    return data as Product
  },

  async patch(id: string, patch: Partial<Product>): Promise<Product> {
    const { data, error } = await db()
      .from('technical_products')
      .update(patch)
      .eq('id', id)
      .select(COLS)
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Update product failed')
    return data as Product
  },

  async delete(id: string): Promise<void> {
    const { error } = await db().from('technical_products').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },
}

export const bomLinesRepo = {
  async listByProduct(productId: string): Promise<BomLine[]> {
    const { data } = await db()
      .from('technical_bom_lines')
      .select('id, product_id, material_id, qty_per_unit, note, sort_order')
      .eq('product_id', productId)
      .order('sort_order')
    return (data ?? []) as BomLine[]
  },

  async copyAll(fromProductId: string, toProductId: string): Promise<number> {
    const lines = await this.listByProduct(fromProductId)
    if (lines.length === 0) return 0
    const { error } = await db()
      .from('technical_bom_lines')
      .insert(
        lines.map((l) => ({
          product_id: toProductId,
          material_id: l.material_id,
          qty_per_unit: l.qty_per_unit,
          note: l.note,
          sort_order: l.sort_order,
        })),
      )
    if (error) throw new Error(error.message)
    return lines.length
  },
}
