import { db } from '@/server/db'

export type Product = {
  id: string
  code: string
  name: string
  category: string | null
  drawing_url: string | null
  bom_url: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

const COLS = 'id, code, name, category, drawing_url, bom_url, notes, is_active, created_at, updated_at'

export const productsRepo = {
  async list(filter: {
    q?: string
    category?: string
    active_only: boolean
    page: number
    page_size: number
  }): Promise<{ rows: Product[]; total: number }> {
    let q = db().from('technical_products').select(COLS, { count: 'exact' })
      .order('created_at', { ascending: false })
    if (filter.active_only) q = q.eq('is_active', true)
    if (filter.category) q = q.eq('category', filter.category)
    if (filter.q) {
      q = q.or(`name.ilike.%${filter.q}%,code.ilike.%${filter.q}%`)
    }
    const from = (filter.page - 1) * filter.page_size
    const to = from + filter.page_size - 1
    q = q.range(from, to)
    const { data, count } = await q
    return { rows: (data ?? []) as Product[], total: count ?? 0 }
  },

  async findById(id: string): Promise<Product | null> {
    const { data } = await db().from('technical_products').select(COLS).eq('id', id).maybeSingle()
    return (data as Product | null) ?? null
  },

  async existsByCode(code: string): Promise<boolean> {
    const { data } = await db().from('technical_products').select('id').eq('code', code).maybeSingle()
    return !!data
  },

  async insert(row: Omit<Product, 'id' | 'created_at' | 'updated_at' | 'is_active'> & { is_active?: boolean }): Promise<Product> {
    const { data, error } = await db().from('technical_products').insert(row).select(COLS).single()
    if (error || !data) throw new Error(error?.message ?? 'Insert product failed')
    return data as Product
  },

  async patch(id: string, patch: Partial<Product>): Promise<Product> {
    const { data, error } = await db().from('technical_products').update(patch).eq('id', id).select(COLS).single()
    if (error || !data) throw new Error(error?.message ?? 'Update product failed')
    return data as Product
  },

  async delete(id: string): Promise<void> {
    const { error } = await db().from('technical_products').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },
}
