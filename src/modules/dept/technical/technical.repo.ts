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
  pack_unit_label?: string
  nw_kg?: number // Net weight / carton
  gw_kg?: number // Gross weight / carton
}

/** Thông số sản xuất (jsonb `tech_spec`) — in trên LSX. */
export type ProductTechSpec = {
  machine?: string
  cushion?: string
  paint?: string
  glass?: string
  wood?: string
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
  image_file_id: string | null
  notes: string | null
  // Thông số kỹ thuật (0026) — phục vụ LSX / hợp đồng.
  /** Tên hàng theo cách gọi của khách — mọi ngôn ngữ (0058, trước là name_de). */
  name_foreign: string | null
  /** Ký mã hiệu in trên thùng — KHÁC tên hàng. */
  shipping_mark: string | null
  barcode: string | null
  showroom_sample: boolean
  reference_price: number | null
  tech_spec: ProductTechSpec
  // Thông tin XK + đặc tính nội thất (0037).
  hs_code: string | null
  origin_country: string | null
  material: string | null
  max_load_kg: number | null
  assembly: 'assembled' | 'kd' | null
  set_contents: string | null
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

export type BomLineWithMaterial = BomLine & {
  material_code: string
  material_name: string
  material_unit: string
}

// Một string literal duy nhất — supabase-js suy type cột từ literal, nối chuỗi sẽ hỏng.
const COLS =
  'id, code, name, category, customer_id, customer_item_code, description_en, unit, bom_status, packing, image_file_id, notes, name_foreign, shipping_mark, barcode, showroom_sample, reference_price, tech_spec, hs_code, origin_country, material, max_load_kg, assembly, set_contents, is_active, created_at, updated_at'

/** Cột nhẹ cho thư viện (thẻ/bảng) — KHÔNG kéo tech_spec/notes/shipping_mark… để
 *  tiết kiệm egress Supabase. Chi tiết đầy đủ nạp riêng ở trang chi tiết. */
const LITE_COLS =
  'id, code, name, category, customer_id, customer_item_code, unit, bom_status, packing, image_file_id, is_active, created_at'

export type ProductLite = Pick<
  Product,
  | 'id'
  | 'code'
  | 'name'
  | 'category'
  | 'customer_id'
  | 'customer_item_code'
  | 'unit'
  | 'bom_status'
  | 'packing'
  | 'image_file_id'
  | 'is_active'
  | 'created_at'
>

export type ProductCounts = {
  total: number
  active: number
  bom_none: number
  bom_drawing: number
  bom_done: number
}

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

  /** Danh sách nhẹ + lọc/tìm/phân trang phía server (thư viện). */
  async listLite(filter: {
    q?: string
    customer_id?: string
    bom_status?: BomStatus
    is_active?: boolean
    page: number
    page_size: number
  }): Promise<{ rows: ProductLite[]; total: number }> {
    let q = db()
      .from('technical_products')
      .select(LITE_COLS, { count: 'exact' })
      .order('created_at', { ascending: false })
    if (filter.is_active != null) q = q.eq('is_active', filter.is_active)
    if (filter.customer_id === 'common') q = q.is('customer_id', null)
    else if (filter.customer_id) q = q.eq('customer_id', filter.customer_id)
    if (filter.bom_status) q = q.eq('bom_status', filter.bom_status)
    if (filter.q) {
      q = q.or(
        `name.ilike.%${filter.q}%,code.ilike.%${filter.q}%,customer_item_code.ilike.%${filter.q}%`,
      )
    }
    const from = (filter.page - 1) * filter.page_size
    q = q.range(from, from + filter.page_size - 1)
    const { data, count } = await q
    return { rows: (data ?? []) as ProductLite[], total: count ?? 0 }
  },

  /**
   * Đếm cho StatsBar — GỘP 5 head-count thành 1 query 1 scan qua function
   * `technical_product_counts()` (0069). bigint về dạng string nên Number().
   */
  async counts(): Promise<ProductCounts> {
    const { data, error } = await db().rpc('technical_product_counts')
    if (error) throw new Error(error.message)
    const r = data?.[0]
    return {
      total: Number(r?.total ?? 0),
      active: Number(r?.active ?? 0),
      bom_none: Number(r?.bom_none ?? 0),
      bom_drawing: Number(r?.bom_drawing ?? 0),
      bom_done: Number(r?.bom_done ?? 0),
    }
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

  /** blocked = FK restrict chặn (23503 — SP đang được chứng từ tham chiếu). */
  async delete(id: string): Promise<{ blocked: boolean }> {
    const { error } = await db().from('technical_products').delete().eq('id', id)
    if (error) {
      if (error.code === '23503') return { blocked: true }
      throw new Error(error.message)
    }
    return { blocked: false }
  },

  /**
   * Đếm tham chiếu CHẶN xoá SP (FK restrict: báo giá 0013, đơn hàng 0013,
   * mẫu 0061) — query thẳng bảng ngoài domain để tránh import chéo module
   * (cùng lý do departmentsRepo.stageCodeExists). files/BOM không chặn
   * (set null / cascade).
   */
  async referenceCounts(
    id: string,
  ): Promise<{ quotes: number; orders: number; samples: number }> {
    const cnt = async (
      table: 'sales_quote_lines' | 'sales_order_lines' | 'technical_samples',
    ) => {
      const { count } = await db()
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq('product_id', id)
      return count ?? 0
    }
    const [quotes, orders, samples] = await Promise.all([
      cnt('sales_quote_lines'),
      cnt('sales_order_lines'),
      cnt('technical_samples'),
    ])
    return { quotes, orders, samples }
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

  /** Dòng BOM kèm thông tin vật tư (mã kho = mã BOM — đặc tả 4.2). */
  async listWithMaterials(productId: string): Promise<BomLineWithMaterial[]> {
    const { data } = await db()
      .from('technical_bom_lines')
      .select(
        'id, product_id, material_id, qty_per_unit, note, sort_order, material:warehouse_materials(code, name, unit)',
      )
      .eq('product_id', productId)
      .order('sort_order')
    type Raw = BomLine & {
      material:
        | { code: string; name: string; unit: string }
        | { code: string; name: string; unit: string }[]
        | null
    }
    return ((data ?? []) as Raw[]).map((r) => {
      const m = Array.isArray(r.material) ? r.material[0] : r.material
      return {
        id: r.id,
        product_id: r.product_id,
        material_id: r.material_id,
        qty_per_unit: r.qty_per_unit,
        note: r.note,
        sort_order: r.sort_order,
        material_code: m?.code ?? '?',
        material_name: m?.name ?? '?',
        material_unit: m?.unit ?? '',
      }
    })
  },

  /** Ghi đè trọn bộ BOM của 1 SP (delete + insert — bộ nhỏ, chấp nhận không transaction). */
  async replaceAll(
    productId: string,
    lines: { material_id: string; qty_per_unit: number; note?: string | null }[],
  ): Promise<void> {
    const { error: delErr } = await db()
      .from('technical_bom_lines')
      .delete()
      .eq('product_id', productId)
    if (delErr) throw new Error(delErr.message)
    if (lines.length === 0) return
    const { error } = await db()
      .from('technical_bom_lines')
      .insert(
        lines.map((l, i) => ({
          product_id: productId,
          material_id: l.material_id,
          qty_per_unit: l.qty_per_unit,
          note: l.note ?? null,
          sort_order: i,
        })),
      )
    if (error) throw new Error(error.message)
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
