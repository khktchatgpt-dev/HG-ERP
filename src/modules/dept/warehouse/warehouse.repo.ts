import { db } from '@/server/db'

export type Material = {
  id: string
  code: string
  name: string
  unit: string
  /** Đơn vị TÍNH GIÁ ('kg', 'm²'…) — NULL = giá theo ĐVT mua (0053, giá đv kép). */
  price_unit: string | null
  /** Hệ số quy đổi gợi ý (vd 5.4 kg/cây) — dòng PO sửa được theo cân thực. */
  unit2_factor: number | null
  group_name: string | null
  min_stock: number
  shelf_location: string | null
  note: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

const COLS =
  'id, code, name, unit, price_unit, unit2_factor, group_name, min_stock, shelf_location, note, is_active, created_at, updated_at'

export type ListFilter = {
  q?: string
  group_name?: string
  active_only: boolean
  page: number
  page_size: number
}

// Postgres `numeric` về qua PostgREST là CHUỖI (vd "20.00") → ép về number để
// đúng type + sắp xếp/so sánh số chuẩn.
function toMaterial(row: Record<string, unknown>): Material {
  return {
    ...(row as Material),
    min_stock: Number(row.min_stock ?? 0),
    unit2_factor: row.unit2_factor == null ? null : Number(row.unit2_factor),
  }
}

export const materialsRepo = {
  async list(filter: ListFilter): Promise<{ rows: Material[]; total: number }> {
    let q = db()
      .from('warehouse_materials')
      .select(COLS, { count: 'exact' })
      .order('code', { ascending: true })

    if (filter.active_only) q = q.eq('is_active', true)
    if (filter.group_name) q = q.eq('group_name', filter.group_name)
    if (filter.q) q = q.or(`code.ilike.%${filter.q}%,name.ilike.%${filter.q}%`)

    const from = (filter.page - 1) * filter.page_size
    const to = from + filter.page_size - 1
    q = q.range(from, to)

    const { data, count } = await q
    return {
      rows: ((data as Record<string, unknown>[] | null) ?? []).map(toMaterial),
      total: count ?? 0,
    }
  },

  async findById(id: string): Promise<Material | null> {
    const { data } = await db()
      .from('warehouse_materials')
      .select(COLS)
      .eq('id', id)
      .maybeSingle()
    return data ? toMaterial(data) : null
  },

  async findByCode(code: string): Promise<Material | null> {
    const { data } = await db()
      .from('warehouse_materials')
      .select(COLS)
      .eq('code', code)
      .maybeSingle()
    return data ? toMaterial(data) : null
  },

  async insert(
    row: Omit<Material, 'id' | 'created_at' | 'updated_at' | 'is_active'> & {
      is_active?: boolean
    },
  ): Promise<Material> {
    const { data, error } = await db()
      .from('warehouse_materials')
      .insert(row)
      .select(COLS)
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Insert material failed')
    return toMaterial(data)
  },

  async patch(id: string, patch: Partial<Material>): Promise<Material> {
    const { data, error } = await db()
      .from('warehouse_materials')
      .update(patch)
      .eq('id', id)
      .select(COLS)
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Update material failed')
    return toMaterial(data)
  },

  async delete(id: string): Promise<void> {
    const { error } = await db().from('warehouse_materials').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },
}
