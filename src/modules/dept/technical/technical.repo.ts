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
  /** FK khách bên Kinh doanh — CHỈ Kinh doanh ghi (chia rổ SP trong báo giá). */
  customer_id: string | null
  /** Nhãn khách/nhóm Kỹ thuật gõ tự do (0091). null = mẫu chung. */
  customer_name: string | null
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
  'id, code, name, category, customer_id, customer_name, customer_item_code, description_en, unit, bom_status, packing, image_file_id, notes, name_foreign, shipping_mark, barcode, showroom_sample, reference_price, tech_spec, hs_code, origin_country, material, max_load_kg, assembly, set_contents, is_active, created_at, updated_at'

/** Cột nhẹ cho thư viện (thẻ/bảng) — KHÔNG kéo tech_spec/notes/shipping_mark… để
 *  tiết kiệm egress Supabase. Chi tiết đầy đủ nạp riêng ở trang chi tiết. */
const LITE_COLS =
  'id, code, name, category, customer_id, customer_name, customer_item_code, unit, bom_status, packing, image_file_id, is_active, created_at'

export type ProductLite = Pick<
  Product,
  | 'id'
  | 'code'
  | 'name'
  | 'category'
  | 'customer_id'
  | 'customer_name'
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

/** Giá trị lọc đặc biệt = SP chưa gõ nhãn khách nào (nhóm "Mẫu chung"). */
export const NO_CUSTOMER_FILTER = '__common'

const searchOr = (q: string) =>
  `name.ilike.%${q}%,code.ilike.%${q}%,customer_item_code.ilike.%${q}%,customer_name.ilike.%${q}%`

export const productsRepo = {
  async list(filter: {
    q?: string
    category?: string
    customer_id?: string
    customer_name?: string
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
    if (filter.customer_name === NO_CUSTOMER_FILTER) q = q.is('customer_name', null)
    else if (filter.customer_name) q = q.eq('customer_name', filter.customer_name)
    if (filter.bom_status) q = q.eq('bom_status', filter.bom_status)
    if (filter.q) q = q.or(searchOr(filter.q))
    const from = (filter.page - 1) * filter.page_size
    const to = from + filter.page_size - 1
    q = q.range(from, to)
    const { data, count } = await q
    return { rows: (data ?? []) as Product[], total: count ?? 0 }
  },

  /** Danh sách nhẹ + lọc/tìm/phân trang phía server (thư viện). */
  async listLite(filter: {
    q?: string
    customer_name?: string
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
    if (filter.customer_name === NO_CUSTOMER_FILTER) q = q.is('customer_name', null)
    else if (filter.customer_name) q = q.eq('customer_name', filter.customer_name)
    if (filter.bom_status) q = q.eq('bom_status', filter.bom_status)
    if (filter.q) q = q.or(searchOr(filter.q))
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

  /**
   * Các nhãn khách/nhóm đã gõ (0091) — đổ vào ô gợi ý khi nhập và dropdown lọc.
   * Gộp ở DB thay vì kéo cả bảng về đếm ở app.
   */
  async customerNames(): Promise<{ name: string; count: number }[]> {
    const { data, error } = await db().rpc('technical_product_customer_names')
    if (error) throw new Error(error.message)
    return (data ?? []).map((r) => ({
      name: r.customer_name,
      count: Number(r.product_count ?? 0),
    }))
  },

  /**
   * Giá trị ĐÃ DÙNG ở các ô gõ tự do (danh mục, ĐVT, chất liệu, thông số LSX…)
   * để đổ vào `datalist` gợi ý — người nhập chọn lại thay vì gõ tay mỗi lần,
   * nhưng vẫn gõ được giá trị mới (xem 0091: không ràng FK sang danh mục khác).
   * Đọc 5 cột nhẹ rồi gom ở app: rẻ hơn thêm một RPC cho thứ chỉ là gợi ý.
   */
  async fieldSuggestions(): Promise<Record<string, string[]>> {
    const { data } = await db()
      .from('technical_products')
      .select('category, unit, material, tech_spec, packing')
      .eq('is_active', true)
      .limit(3000)

    const bag = new Map<string, Map<string, number>>()
    const add = (key: string, raw: unknown) => {
      const v = typeof raw === 'string' ? raw.trim() : ''
      if (!v || v.length > 120) return
      const m = bag.get(key) ?? new Map<string, number>()
      m.set(v, (m.get(v) ?? 0) + 1)
      bag.set(key, m)
    }

    for (const r of data ?? []) {
      add('category', r.category)
      add('unit', r.unit)
      add('material', r.material)
      const ts = (r.tech_spec ?? {}) as Record<string, unknown>
      for (const k of ['machine', 'cushion', 'paint', 'glass', 'wood']) add(k, ts[k])
      const pk = (r.packing ?? {}) as Record<string, unknown>
      add('pack_unit_label', pk.pack_unit_label)
    }

    const out: Record<string, string[]> = {}
    for (const [key, m] of bag)
      out[key] = [...m]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'vi'))
        .slice(0, 50)
        .map(([v]) => v)
    return out
  },

  /**
   * Tên khách bên Kinh doanh — dùng khi Sales tạo nhanh SP (có customer_id) để
   * điền luôn nhãn `customer_name` cho thư viện. Query thẳng bảng ngoài domain
   * để tránh import chéo module (cùng lý do referenceCounts).
   */
  async customerNameById(customerId: string): Promise<string | null> {
    const { data } = await db()
      .from('sales_customers')
      .select('name')
      .eq('id', customerId)
      .maybeSingle()
    return data?.name ?? null
  },

  async findById(id: string): Promise<Product | null> {
    const { data } = await db()
      .from('technical_products')
      .select(COLS)
      .eq('id', id)
      .maybeSingle()
    return (data as Product | null) ?? null
  },

  /**
   * Mã của MỘT loại SP (prefix 2 ký tự) — để cấp số thứ tự kế tiếp. Chỉ kéo cột
   * `code`; loại đông nhất mới 134 dòng nên rẻ hơn hẳn một RPC riêng.
   */
  async codesByType(type: string): Promise<string[]> {
    const { data, error } = await db()
      .from('technical_products')
      .select('code')
      .like('code', `${type}%`)
    if (error) throw new Error(error.message)
    return (data ?? []).map((r) => r.code)
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

/**
 * Nhóm hạng mục của định mức. Từ 0093 đây là DỮ LIỆU trong
 * `technical_part_groups`, không còn danh sách cứng trong code — thêm/đổi/sắp
 * xếp nhóm không cần migration. `parent_code` để lồng cấp khi cần.
 */
export type PartGroupRow = {
  code: string
  label: string
  parent_code: string | null
  sort_order: number
  is_active: boolean
}

export const partGroupsRepo = {
  async list(activeOnly = true): Promise<PartGroupRow[]> {
    let q = db()
      .from('technical_part_groups')
      .select('code, label, parent_code, sort_order, is_active')
      .order('sort_order')
    if (activeOnly) q = q.eq('is_active', true)
    const { data } = await q
    return (data ?? []) as PartGroupRow[]
  },
}

/** Dòng định mức TỰ MÔ TẢ vật tư — không FK sang kho (0092). */
export type ProductPart = {
  id: string
  /** Mã nhóm — tra nhãn qua `partGroupsRepo.list()`, không hằng số hoá. */
  group_code: string
  /** Tiêu đề khối trong file BOM gốc — mang thông số (mật độ mút, FSC, mã bao bì). */
  section_title: string | null
  /** Đơn vị tính của khối ("1 ghế"). null = tính trên 1 sản phẩm. */
  unit_basis: string | null
  /** Cột "Vật liệu" trên dòng: "Nhựa", "7 màu". */
  material_note: string | null
  tenon: string | null
  set_item_label: string | null
  part_no: number | null
  part_name: string
  material_code: string | null
  material_kind: string | null
  profile_shape: string | null
  profile_code: string | null
  dim_a_mm: number | null
  dim_b_mm: number | null
  wall_thickness_mm: number | null
  cut_length_mm: number | null
  qty: number
  unit: string | null
  waste_pct: number
  weight_kg: number | null
  total_length_m: number | null
  paint_area_m2: number | null
  note: string | null
  sort_order: number
}

export type ProductSetItem = {
  id: string
  item_product_id: string | null
  item_label: string
  qty: number
  length_mm: number | null
  width_mm: number | null
  height_mm: number | null
  net_weight_kg: number | null
}

export type ProductPackage = {
  id: string
  package_label: string
  qty: number
  carton_l_mm: number | null
  carton_w_mm: number | null
  carton_h_mm: number | null
  net_weight_kg: number | null
  gross_weight_kg: number | null
}

export type PackingOption = {
  id: string
  option_no: number
  label: string | null
  cartons_per_set: number | null
  loading_40hc: number | null
  is_default: boolean
  packages: ProductPackage[]
}

const PART_COLS =
  'id, group_code, section_title, unit_basis, material_note, tenon, set_item_label, part_no, part_name, material_code, material_kind, profile_shape, profile_code, dim_a_mm, dim_b_mm, wall_thickness_mm, cut_length_mm, qty, unit, waste_pct, weight_kg, total_length_m, paint_area_m2, note, sort_order'

export const productProfileRepo = {
  async parts(productId: string): Promise<ProductPart[]> {
    const { data } = await db()
      .from('technical_product_parts')
      .select(PART_COLS)
      .eq('product_id', productId)
      .order('sort_order')
    return (data ?? []) as ProductPart[]
  },

  /** Đếm dòng định mức — cho nhãn số trên tab, không cần kéo cả bảng. */
  async partsCount(productId: string): Promise<number> {
    const { count } = await db()
      .from('technical_product_parts')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', productId)
    return count ?? 0
  },

  /** Số thứ tự kế tiếp trong 1 sản phẩm — dòng mới xuống cuối, không chen giữa. */
  async nextSortOrder(productId: string): Promise<number> {
    const { data } = await db()
      .from('technical_product_parts')
      .select('sort_order')
      .eq('product_id', productId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()
    return ((data?.sort_order as number | undefined) ?? 0) + 1
  },

  async insertPart(
    productId: string,
    row: Partial<ProductPart> & Pick<ProductPart, 'part_name' | 'qty' | 'group_code'>,
  ): Promise<ProductPart> {
    const { data, error } = await db()
      .from('technical_product_parts')
      .insert({ ...row, product_id: productId })
      .select(PART_COLS)
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Thêm dòng định mức thất bại')
    return data as ProductPart
  },

  /** Ràng buộc product_id để không sửa nhầm dòng của sản phẩm khác. */
  async patchPart(
    productId: string,
    partId: string,
    patch: Partial<ProductPart>,
  ): Promise<ProductPart | null> {
    const { data, error } = await db()
      .from('technical_product_parts')
      .update(patch)
      .eq('id', partId)
      .eq('product_id', productId)
      .select(PART_COLS)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return (data as ProductPart | null) ?? null
  },

  async insertParts(rows: Record<string, unknown>[]): Promise<number> {
    if (rows.length === 0) return 0
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await db()
        .from('technical_product_parts')
        .insert(rows.slice(i, i + 500) as never)
      if (error) throw new Error(error.message)
    }
    return rows.length
  },

  async deleteAllParts(productId: string): Promise<number> {
    const { data, error } = await db()
      .from('technical_product_parts')
      .delete()
      .eq('product_id', productId)
      .select('id')
    if (error) throw new Error(error.message)
    return (data ?? []).length
  },

  async deletePart(productId: string, partId: string): Promise<boolean> {
    const { data, error } = await db()
      .from('technical_product_parts')
      .delete()
      .eq('id', partId)
      .eq('product_id', productId)
      .select('id')
      .maybeSingle()
    if (error) throw new Error(error.message)
    return !!data
  },

  async setItems(productId: string): Promise<ProductSetItem[]> {
    const { data } = await db()
      .from('technical_product_set_items')
      .select(
        'id, item_product_id, item_label, qty, length_mm, width_mm, height_mm, net_weight_kg',
      )
      .eq('set_product_id', productId)
      .order('sort_order')
    return (data ?? []) as ProductSetItem[]
  },

  /** Phương án đóng gói kèm các kiện — 1 query lồng thay vì N+1. */
  async packingOptions(productId: string): Promise<PackingOption[]> {
    const { data } = await db()
      .from('technical_packing_options')
      .select(
        'id, option_no, label, cartons_per_set, loading_40hc, is_default, packages:technical_packages(id, package_label, qty, carton_l_mm, carton_w_mm, carton_h_mm, net_weight_kg, gross_weight_kg, sort_order)',
      )
      .eq('product_id', productId)
      .order('option_no')
    type Raw = Omit<PackingOption, 'packages'> & {
      packages: (ProductPackage & { sort_order: number })[] | null
    }
    return ((data ?? []) as Raw[]).map((o) => ({
      ...o,
      packages: (o.packages ?? []).sort((a, b) => a.sort_order - b.sort_order),
    }))
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
