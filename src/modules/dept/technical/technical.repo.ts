import { db } from '@/server/db'
import { customerLabelFrom } from '@/lib/customer-label'
import { searchTokens } from '@/lib/search-text'
import type { Lifecycle } from '@/lib/product-lifecycle'
import type { BomStatus } from './technical.schema'

export type ProductPacking = {
  /*
   * l_cm/w_cm/h_cm KHÔNG CÒN TRONG DB (migration 0129 đã xoá): kích thước SP chỉ
   * sống ở ba cột `length/width/height_mm`. Ba khoá dưới đây chỉ do tầng hiển
   * thị BƠM VÀO khi dựng chứng từ dùng cm (báo giá, bản in) — xem
   * `@/lib/packing-dims`. Không ghi ngược xuống DB.
   */
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
  /**
   * CBM/thùng KHAI TRỰC TIẾP (m³) — khách như ROSCO chốt sẵn con số trên LSX
   * để soát đóng đầy cont. Có kích thước thùng thì `cartonCbm` vẫn ưu tiên
   * TÍNH từ 3 chiều; ô này là đường nhập cho SP chưa đo thùng.
   */
  cbm?: number
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
  // ── Nhận diện + số tổng hợp lấy từ file BOM khi import (0092) ──
  // Đã nằm trong DB từ lâu nhưng KHÔNG được đọc lên: trang hồ sơ vì thế in
  // "Kích thước SP —" cho 292/537 SP thực ra có đủ dài×rộng×cao. Xem
  // ProductProfileTab để biết chỗ dùng.
  /** Loại SP phân rã từ mã (TB/CH/BN/ST/SL/OT/AC) — nhãn ở `PRODUCT_TYPES`. */
  product_type: string | null
  /** Vật liệu KHUNG phân rã từ mã (AL/IR/IN…) — nhãn ở `FRAME_MATERIALS`. */
  frame_material: string | null
  /** Mã cũ (C0201HG-IN) — chứng từ, file BOM và ảnh cũ đều gọi theo mã này. */
  code_legacy: string | null
  is_upholstered: boolean
  has_glass: boolean
  is_set: boolean
  net_weight_kg: number | null
  frame_weight_kg: number | null
  frame_length_m: number | null
  paint_area_m2: number | null
  part_count: number | null
  /**
   * Kích thước tổng thể SP ở trạng thái ĐÓNG/GẤP — file BOM ghi **mm**,
   * `packing` jsonb ghi **cm**. Đây là bộ số dùng để xếp cont và in báo giá.
   */
  length_mm: number | null
  width_mm: number | null
  height_mm: number | null
  /**
   * Kích thước ở trạng thái MỞ / KÉO GIÃN (mm) — null với SP không gập/mở, tức
   * đại đa số thư viện (0104). Bàn kéo giãn chỉ đổi một chiều
   * (1800→2500); ghế gấp đổi hai chiều và chiều CAO đi NGƯỢC: mở ra thì thấp
   * xuống (1110→995), nên `height_open_mm` có thể nhỏ hơn `height_mm`.
   */
  length_open_mm: number | null
  width_open_mm: number | null
  height_open_mm: number | null
  /** Độ dày SP (mm, 0146) — mặt bàn / tấm / kính. Khác wall_thickness_mm của dòng ĐM. */
  thickness_mm: number | null
  // Đầu biểu mẫu "BẢNG ĐỊNH MỨC NGUYÊN - PHỤ KIỆN" (0097).
  /** Ô "Nhiên Liệu" — 'AL' | 'IR' | 'IN', nguồn tra tỉ trọng. Mặc định của SP. */
  base_material: string | null
  /** Ô "KL.Thực tế / BK" — khối lượng cân thật, để so với khối lượng tính ra. */
  actual_weight_kg: number | null
  /** m² sơn phủ được trên 1 kg sơn. Biểu mẫu hard-code 5. */
  paint_coverage_m2_per_kg: number | null
  /** Khối kiểm soát tài liệu ISO (HG-QT-07/M02). */
  bom_rev: number | null
  bom_effective_date: string | null
  bom_prepared_by: string | null
  bom_approved_by: string | null
  /**
   * KIỂM SOÁT BẢN DÙNG (0140 — 13/08/2026). `bom_file_id` là file BOM ĐANG
   * DÙNG (UI làm nổi bật, file BOM khác lùi về bản cũ); `bom_checked_*` là dấu
   * Kỹ thuật tự xác nhận đã rà; `locked_*` khoá TOÀN BỘ hồ sơ, `unlocked_*`
   * giữ vết lần mở gần nhất.
   */
  bom_checked_at: string | null
  bom_checked_by: string | null
  bom_file_id: string | null
  locked_at: string | null
  locked_by: string | null
  lock_note: string | null
  unlocked_at: string | null
  unlocked_by: string | null
  unlock_reason: string | null
  /**
   * XÁC NHẬN MẪU (0141) — nhãn tiến trình ĐỘC LẬP với `locked_*`: mẫu đã được
   * chốt với khách hay chưa. Chưa xác nhận thì hồ sơ còn đang chạy (vẫn sửa
   * bình thường); xác nhận rồi mới tính chuyện khoá. Không phải `showroom_sample`
   * (cờ "có mẫu vật lý ở showroom").
   */
  sample_confirmed_at: string | null
  sample_confirmed_by: string | null
  sample_note: string | null
  /** Người phụ trách hồ sơ (0144) — người trả lời khi hồ sơ có vấn đề. */
  owner_id: string | null
  /**
   * TRẠNG THÁI hồ sơ (0145) — nguồn DUY NHẤT người dùng chạm vào. Không ghi qua
   * `patch` (xem `ProductWrite`): mọi đường đổi trạng thái phải đi
   * `productsService.setLifecycle` để còn đồng bộ cờ cũ + ghi lịch sử.
   */
  lifecycle: Lifecycle
  lifecycle_at: string | null
  lifecycle_by: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

/**
 * Trường GHI ĐƯỢC qua `patch` thường. `lifecycle` bị loại ra CÓ CHỦ Ý (0145):
 * đổi trạng thái còn phải đồng bộ `is_active` / `sample_confirmed_*` và ghi một
 * dòng lịch sử, nên chỉ có `productsRepo.setLifecycle` (gọi từ service) mới
 * được chạm vào. Loại ở tầng type để quên là hỏng build, không phải hỏng dữ liệu.
 */
export type ProductWrite = Partial<Omit<Product, 'lifecycle'>>

// Một string literal duy nhất — supabase-js suy type cột từ literal, nối chuỗi sẽ hỏng.
const COLS =
  'id, code, name, category, customer_id, customer_name, customer_item_code, description_en, unit, bom_status, packing, image_file_id, notes, name_foreign, shipping_mark, barcode, showroom_sample, reference_price, tech_spec, hs_code, origin_country, material, max_load_kg, assembly, set_contents, product_type, frame_material, code_legacy, is_upholstered, has_glass, is_set, net_weight_kg, frame_weight_kg, frame_length_m, paint_area_m2, part_count, length_mm, width_mm, height_mm, length_open_mm, width_open_mm, height_open_mm, thickness_mm, base_material, actual_weight_kg, paint_coverage_m2_per_kg, bom_rev, bom_effective_date, bom_prepared_by, bom_approved_by, bom_checked_at, bom_checked_by, bom_file_id, locked_at, locked_by, lock_note, unlocked_at, unlocked_by, unlock_reason, sample_confirmed_at, sample_confirmed_by, sample_note, owner_id, lifecycle, lifecycle_at, lifecycle_by, is_active, created_at, updated_at'

/** Cột nhẹ cho thư viện (thẻ/bảng) — KHÔNG kéo tech_spec/notes/shipping_mark… để
 *  tiết kiệm egress Supabase. Chi tiết đầy đủ nạp riêng ở trang chi tiết. */
const LITE_COLS =
  'id, code, name, category, product_type, frame_material, customer_id, customer_name, customer_item_code, unit, bom_status, packing, length_mm, width_mm, height_mm, image_file_id, locked_at, lifecycle, is_active, created_at'

export type ProductLite = Pick<
  Product,
  | 'id'
  | 'code'
  | 'name'
  | 'category'
  // Phân loại THẬT của thư viện (529/537 SP có, khớp 100% với mã SP). Cột
  // `category` thì gần như rỗng và bị gõ nhầm tên khách vào — đừng dùng nó.
  | 'product_type'
  | 'frame_material'
  | 'customer_id'
  | 'customer_name'
  | 'customer_item_code'
  | 'unit'
  | 'bom_status'
  | 'packing'
  // Kích thước SP — MỘT nguồn duy nhất là ba cột mm (0129).
  | 'length_mm'
  | 'width_mm'
  | 'height_mm'
  | 'image_file_id'
  /** Hồ sơ đã khoá (0140) — thư viện gắn badge để ai cũng thấy bản chốt. */
  | 'locked_at'
  /** TRẠNG THÁI hồ sơ (0145) — badge trên thẻ/bảng + chip lọc của thư viện. */
  | 'lifecycle'
  | 'is_active'
  | 'created_at'
>

/**
 * Cột cho Ô CHỌN SP ở báo giá / đơn hàng — hẹp hơn cả `LITE_COLS`: chỉ những gì
 * ô chọn hiển thị và báo giá in ra. Trước đây form báo giá nạp `COLS` (49 cột,
 * cả `tech_spec`/`notes`/`search_text`) cho toàn bộ 537 SP mỗi lần mở trang —
 * ~715 kB egress Supabase cho một cái `<select>`. Nay tìm ở server, trả ≤25 dòng.
 */
const PICK_COLS =
  'id, code, name, unit, customer_id, customer_item_code, bom_status, packing, image_file_id, description_en, length_mm, width_mm, height_mm'

export type ProductPickRow = Pick<
  Product,
  | 'id'
  | 'code'
  | 'name'
  | 'unit'
  | 'customer_id'
  | 'customer_item_code'
  | 'bom_status'
  | 'packing'
  | 'image_file_id'
  | 'description_en'
  // Kích thước do import BOM ghi (mm) — nguồn thứ hai của cùng một thứ với
  // `packing.l_cm…` (cm, gõ tay). Xem `toQuotePickPayload`: 290/537 SP chỉ có bộ
  // mm này, form báo giá đọc mỗi `packing` nên báo "thiếu" oan.
  | 'length_mm'
  | 'width_mm'
  | 'height_mm'
>

export type ProductCounts = {
  total: number
  active: number
  bom_none: number
  bom_drawing: number
  bom_done: number
  /** SP chưa có ảnh đại diện — lỗ hổng hồ sơ thấy được ngay trên thẻ thư viện. */
  no_image: number
  /** Hồ sơ ĐÃ KHOÁ (0140) — bản đã chốt, mọi phòng dùng được ngay. */
  locked: number
}

/** Giá trị lọc đặc biệt = SP chưa gõ nhãn khách nào (nhóm "Mẫu chung"). */
export const NO_CUSTOMER_FILTER = '__common'

/** Giá trị lọc đặc biệt = SP chưa gán danh mục (`category` null). */
export const NO_CATEGORY_FILTER = '__uncategorized'

/**
 * Lọc theo từ khoá trên cột `search_text` (0098) — cột đã gộp sẵn mã, mã cũ, tên,
 * tên theo khách, mã KH đặt và nhãn khách, đã hạ chữ thường và BỎ DẤU.
 *
 * `code_legacy` nằm trong cột đó: mã cũ (`S0049HG-AL`) là mã mà mọi file Excel,
 * bản vẽ và chứng từ giấy đang gọi — người dùng gõ nó chứ không gõ mã mới
 * (`ST000049HG-AL`). Thiếu nó thì tra mã trong file ra 0 kết quả.
 *
 * Mỗi từ là một điều kiện `ilike` RIÊNG và chúng AND với nhau, nên "ghe florenz"
 * ra đúng "Ghế xếp Florenz" — cách cũ ghép cả chuỗi vào một `%…%` nên đòi hai từ
 * phải nằm liền nhau đúng thứ tự.
 */
function applySearch<T extends { ilike: (col: string, pat: string) => T }>(
  query: T,
  q: string,
): T {
  let out = query
  for (const token of searchTokens(q)) out = out.ilike('search_text', `%${token}%`)
  return out
}

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
    if (filter.q) q = applySearch(q, filter.q)
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
    /** false = chỉ SP CHƯA có ảnh; true = chỉ SP đã có; bỏ trống = không lọc. */
    has_image?: boolean
    /** true = chỉ hồ sơ ĐÃ KHOÁ (0140); bỏ trống = không lọc. */
    locked?: boolean
    /** Lọc theo TRẠNG THÁI hồ sơ (0145); bỏ trống = mọi trạng thái. */
    lifecycle?: Lifecycle
    /** Mã loại SP 2 ký tự ('CH', 'TB'…) — xem PRODUCT_TYPES ở lib/product-code. */
    product_type?: string
    /**
     * Mã danh mục SP (`catalog_items` loại `product_category`), hoặc
     * `NO_CATEGORY_FILTER` = chưa gán danh mục.
     */
    category?: string
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
    if (filter.product_type) q = q.eq('product_type', filter.product_type)
    if (filter.category === NO_CATEGORY_FILTER) q = q.is('category', null)
    else if (filter.category) q = q.eq('category', filter.category)
    if (filter.has_image === false) q = q.is('image_file_id', null)
    else if (filter.has_image === true) q = q.not('image_file_id', 'is', null)
    if (filter.locked === true) q = q.not('locked_at', 'is', null)
    else if (filter.locked === false) q = q.is('locked_at', null)
    if (filter.lifecycle) q = q.eq('lifecycle', filter.lifecycle)
    if (filter.q) q = applySearch(q, filter.q)
    const from = (filter.page - 1) * filter.page_size
    q = q.range(from, from + filter.page_size - 1)
    const { data, count } = await q
    return { rows: (data ?? []) as ProductLite[], total: count ?? 0 }
  },

  /**
   * Id các SP GẦN GIỐNG từ khoá, xếp theo độ giống (0098). Chỉ gọi khi tìm khớp
   * chặt ra 0 dòng — xem `productsService.list`.
   */
  async fuzzyIds(q: string, limit = 50): Promise<string[]> {
    const { data, error } = await db().rpc('technical_products_fuzzy', {
      p_q: q,
      p_limit: limit,
    })
    if (error) throw new Error(error.message)
    return (data ?? []).map((r: { id: string }) => r.id)
  },

  /** Như `listLite` nhưng lấy đúng một tập id, GIỮ thứ tự id truyền vào. */
  async listLiteByIds(ids: string[]): Promise<ProductLite[]> {
    if (ids.length === 0) return []
    const { data } = await db().from('technical_products').select(LITE_COLS).in('id', ids)
    const byId = new Map((data ?? []).map((r) => [(r as ProductLite).id, r]))
    // `.in()` trả về theo thứ tự bảng, còn thứ tự ta cần là thứ tự ĐỘ GIỐNG.
    return ids.map((id) => byId.get(id)).filter(Boolean) as ProductLite[]
  },

  /**
   * Ô chọn SP ở báo giá/đơn — MỘT query, cột hẹp, có giới hạn.
   *
   * Không gõ gì + biết khách: trả SP CỦA KHÁCH ĐÓ + mẫu chung (rổ hay dùng nhất),
   * khỏi bắt sale lướt qua SP của khách khác. Có gõ: tìm toàn thư viện trên cột
   * `search_text` (đã bỏ dấu, gộp cả mã cũ) — client tự chia nhóm own/chung/khác
   * trên đúng mấy chục dòng trả về.
   */
  async listForPick(filter: {
    q?: string
    customer_id?: string
    limit: number
  }): Promise<ProductPickRow[]> {
    let q = db()
      .from('technical_products')
      .select(PICK_COLS)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(filter.limit)
    if (filter.q) q = applySearch(q, filter.q)
    else if (filter.customer_id) {
      q = q.or(`customer_id.eq.${filter.customer_id},customer_id.is.null`)
    }
    const { data } = await q
    return (data ?? []) as ProductPickRow[]
  },

  /** Như `listForPick` nhưng lấy đúng một tập id, GIỮ thứ tự id truyền vào. */
  async listPickByIds(ids: string[]): Promise<ProductPickRow[]> {
    if (ids.length === 0) return []
    const { data } = await db().from('technical_products').select(PICK_COLS).in('id', ids)
    const byId = new Map((data ?? []).map((r) => [(r as ProductPickRow).id, r]))
    return ids.map((id) => byId.get(id)).filter(Boolean) as ProductPickRow[]
  },

  /**
   * Đếm cho StatsBar — GỘP 5 head-count thành 1 query 1 scan qua function
   * `technical_product_counts()` (0069). bigint về dạng string nên Number().
   */
  async counts(): Promise<ProductCounts> {
    // `locked` đếm riêng bằng head-count thay vì nới function 0069: có partial
    // index `technical_products_locked_idx` nên chỉ quét đúng phần đã khoá,
    // rẻ hơn cả việc sửa + chạy lại RPC cho mọi lần đếm. Trạng thái hồ sơ
    // (0145) KHÔNG đếm ở đây: bộ lọc của nó là dropdown, không phải chip có số.
    const [rpc, locked] = await Promise.all([
      db().rpc('technical_product_counts'),
      db()
        .from('technical_products')
        .select('id', { count: 'exact', head: true })
        .not('locked_at', 'is', null),
    ])
    if (rpc.error) throw new Error(rpc.error.message)
    const r = rpc.data?.[0]
    return {
      total: Number(r?.total ?? 0),
      active: Number(r?.active ?? 0),
      bom_none: Number(r?.bom_none ?? 0),
      bom_drawing: Number(r?.bom_drawing ?? 0),
      bom_done: Number(r?.bom_done ?? 0),
      no_image: Number(r?.no_image ?? 0),
      locked: locked.count ?? 0,
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
   * Nhãn khách cho SP do Kinh doanh tạo nhanh (có customer_id). Query thẳng bảng
   * ngoài domain để tránh import chéo module (cùng lý do referenceCounts).
   *
   * Lấy MÃ khách chứ không tên pháp nhân — xem `customerLabelFrom`: thư viện SP
   * gọi khách bằng mã ngắn (MERXX), lấy `name` là đẻ lại nhãn
   * "MERXX HANDELS GMBH" vừa gộp xong.
   */
  async customerNameById(customerId: string): Promise<string | null> {
    const { data } = await db()
      .from('sales_customers')
      .select('name, code')
      .eq('id', customerId)
      .maybeSingle()
    return data ? customerLabelFrom(data) : null
  },

  async findById(id: string): Promise<Product | null> {
    const { data } = await db()
      .from('technical_products')
      .select(COLS)
      .eq('id', id)
      .maybeSingle()
    return (data as Product | null) ?? null
  },

  /** Hồ sơ đầy đủ theo lô id — nạp snapshot dòng lệnh sản xuất (0114). */
  async listByIds(ids: string[]): Promise<Product[]> {
    if (!ids.length) return []
    const { data } = await db()
      .from('technical_products')
      .select(COLS)
      .in('id', ids)
      .limit(2000)
    return (data ?? []) as unknown as Product[]
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

  /**
   * Hồ sơ đang giữ mã này — trả về CẢ TÊN chứ không chỉ true/false.
   *
   * Luồng "Tạo SP từ file BOM" cần biết mình đang đụng vào SP nào để nói với
   * người dùng, thay vì lặng lẽ cấp một mã khác rồi đẻ hồ sơ thứ hai cho cùng
   * một sản phẩm (0163 — user chốt 19/08/2026).
   */
  async findByCodeLite(
    code: string,
  ): Promise<{ id: string; code: string; name: string } | null> {
    const { data } = await db()
      .from('technical_products')
      .select('id, code, name')
      .eq('code', code)
      .maybeSingle()
    return data ?? null
  },

  /**
   * Tra SP theo mã — trả id để DÙNG LẠI thay vì tạo trùng. `code` là UNIQUE nên
   * chèn đè sẽ vỡ ở DB; chỗ nhập hàng loạt (nhập báo giá từ Excel) phải kiểm
   * ngay trước khi chèn vì danh mục có thể đổi giữa lúc xem trước và lúc lưu.
   */
  async findIdByCode(code: string): Promise<string | null> {
    const { data } = await db()
      .from('technical_products')
      .select('id')
      .eq('code', code)
      .maybeSingle()
    return (data as { id: string } | null)?.id ?? null
  },

  async insert(row: ProductWrite & Pick<Product, 'code' | 'name'>): Promise<Product> {
    const { data, error } = await db()
      .from('technical_products')
      .insert(row)
      .select(COLS)
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Insert product failed')
    return data as Product
  },

  /**
   * Đổi TRẠNG THÁI + các cờ đi kèm trong MỘT lệnh ghi (0145). Tách khỏi `patch`
   * để `ProductWrite` chặn được mọi đường ghi lifecycle khác — xem ghi chú ở
   * `ProductWrite`. Gọi từ `productsService.setLifecycle`, đừng gọi thẳng.
   */
  async setLifecycle(
    id: string,
    row: {
      lifecycle: Lifecycle
      lifecycle_at: string
      lifecycle_by: string
      is_active: boolean
      sample_confirmed_at: string | null
      sample_confirmed_by: string | null
      sample_note: string | null
    },
  ): Promise<Product> {
    const { data, error } = await db()
      .from('technical_products')
      .update(row)
      .eq('id', id)
      .select(COLS)
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Update lifecycle failed')
    return data as Product
  },

  async patch(id: string, patch: ProductWrite): Promise<Product> {
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
  /** "Mộng" (mm) — tham gia công thức diện tích / m³ của khối gỗ, nệm. */
  tenon_mm: number | null
  /** Cụm (`Parts/ Bộ phận`). null = dòng RỜI, trực thuộc sản phẩm. */
  cluster_id: string | null
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
  /** "Phi hao chi tiết uốn" (mm) — cộng vào chiều dài phôi, KHÔNG vào diện tích. */
  bend_waste_mm: number | null
  /** Profile tra bảng kg/m (TD-HG04 = 0.260) — thay cho phép tính hình học. */
  kg_per_m: number | null
  /* ── Quy đổi sang ĐƠN VỊ MUA (0132) ────────────────────────────────────
   * Định mức ra mét/kg/m³, còn đơn đặt hàng cần cây/tấm/mét khổ. Mỗi nhóm
   * dùng vài trường: khung → bar_*, gỗ → wood_species, vải → roll/waste,
   * polywood-kính → sheet_*, mút → m3_per_sheet. */
  wood_species: string | null
  bar_length_m: number | null
  pcs_per_bar: number | null
  roll_width_m: number | null
  waste_pct: number | null
  sheet_w_mm: number | null
  sheet_l_mm: number | null
  m3_per_sheet: number | null
  /** NULL = file BOM chưa ghi SL, người dùng điền sau (0163). */
  qty: number | null
  unit: string | null
  /** Màu sơn / màu vật tư — là quy cách, không phải giá. */
  color: string | null
  weight_kg: number | null
  total_length_m: number | null
  paint_area_m2: number | null
  /** DT theo công thức của biểu mẫu (chu vi hình hộp) — để đối chiếu bảng kê giấy. */
  paint_area_box_m2: number | null
  /** Khối GỖ/POLYWOOD tính khối lượng bằng m³ ("K. Lượng (m3)" trong biểu mẫu). */
  volume_m3: number | null
  /** "Xác nhận Phôi" — xưởng phôi tick, không sửa số liệu nên tick được cả khi đã chốt. */
  blank_confirmed_at: string | null
  blank_confirmed_by: string | null
  note: string | null
  sort_order: number
  /** Ghi vết ai sửa cuối — bảo đảm bằng dấu vết, không bằng rào cản. */
  updated_by?: string | null
}

/**
 * CỤM (`Parts/ Bộ phận` của biểu mẫu). Bảng riêng chứ không phải cột text trên
 * dòng định mức: tên lưu một chỗ nên đổi tên không drift, và cụm có chỗ treo số
 * riêng (SL cụm/SP, lộ trình công đoạn) mà dòng chi tiết không mang được.
 */
export type ProductCluster = {
  id: string
  name: string
  qty_per_product: number | null
  first_stage: string | null
  final_stage: string | null
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

// `volume_m3` bắt buộc có: khối GỖ/POLYWOOD trong file BOM tính khối lượng bằng
// **m³**, không phải kg như khối khung kim loại — thiếu cột này thì dòng gỗ hiện
// ra trống trơn dù nguồn có số. KHÔNG còn `unit_price`/`amount`: định mức trả lời
// "cần bao nhiêu", giá thuộc bảng giá NCC bên Cung ứng (0097, quyết định D4).
const PART_COLS =
  'id, group_code, section_title, unit_basis, material_note, tenon, tenon_mm, cluster_id, part_no, part_name, material_code, material_kind, profile_shape, profile_code, dim_a_mm, dim_b_mm, wall_thickness_mm, cut_length_mm, bend_waste_mm, kg_per_m, wood_species, bar_length_m, pcs_per_bar, roll_width_m, waste_pct, sheet_w_mm, sheet_l_mm, m3_per_sheet, qty, unit, color, weight_kg, total_length_m, paint_area_m2, paint_area_box_m2, volume_m3, blank_confirmed_at, blank_confirmed_by, note, sort_order'

const CLUSTER_COLS =
  'id, name, qty_per_product, first_stage, final_stage, note, sort_order'

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

  async findPart(productId: string, partId: string): Promise<ProductPart | null> {
    const { data } = await db()
      .from('technical_product_parts')
      .select(PART_COLS)
      .eq('id', partId)
      .eq('product_id', productId)
      .maybeSingle()
    return (data as ProductPart | null) ?? null
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

  /**
   * Đếm dòng định mức theo nhóm — để màn đọc file BOM nói được "hồ sơ đã có 19
   * dòng nhóm Khung" TRƯỚC khi người dùng bấm lưu. Không có con số này thì đọc
   * lại một file đã nạp rồi bấm Lưu là âm thầm nhân đôi.
   */
  async countPartsByGroup(productId: string): Promise<Record<string, number>> {
    const { data, error } = await db()
      .from('technical_product_parts')
      .select('group_code')
      .eq('product_id', productId)
    if (error) throw new Error(error.message)
    const out: Record<string, number> = {}
    for (const r of data ?? []) {
      const g = (r as { group_code: string }).group_code
      out[g] = (out[g] ?? 0) + 1
    }
    return out
  },

  /**
   * Xoá định mức của MỘT SỐ NHÓM. Khác `deleteAllParts`: đọc lại file BOM chỉ
   * nên thay phần file đó nói tới. File chỉ có khối khung mà xoá sạch cả hồ sơ
   * là mất luôn mấy dòng bao bì ai đó đã nhập tay.
   */
  async deletePartsByGroups(productId: string, groups: string[]): Promise<number> {
    if (groups.length === 0) return 0
    const { data, error } = await db()
      .from('technical_product_parts')
      .delete()
      .eq('product_id', productId)
      .in('group_code', groups)
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

  // ── CỤM ────────────────────────────────────────────────────────────────────

  async clusters(productId: string): Promise<ProductCluster[]> {
    const { data } = await db()
      .from('technical_product_clusters')
      .select(CLUSTER_COLS)
      .eq('product_id', productId)
      .order('sort_order')
    return (data ?? []) as ProductCluster[]
  },

  /**
   * Lấy cụm theo tên, chưa có thì tạo. Đây là chỗ dựa của ô "Cụm" kiểu combobox:
   * gõ tên đã có thì gán vào cụm đó, gõ tên mới thì tạo — y như gõ cột B của
   * Excel, nhưng lưu bằng khoá chứ không bằng chuỗi nên đổi tên không drift.
   */
  async ensureCluster(productId: string, name: string): Promise<ProductCluster> {
    const clean = name.trim()
    const { data: found } = await db()
      .from('technical_product_clusters')
      .select(CLUSTER_COLS)
      .eq('product_id', productId)
      .eq('name', clean)
      .maybeSingle()
    if (found) return found as ProductCluster

    const { data, error } = await db()
      .from('technical_product_clusters')
      .insert({
        product_id: productId,
        name: clean,
        sort_order: await this.nextClusterOrder(productId),
      })
      .select(CLUSTER_COLS)
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Tạo cụm thất bại')
    return data as ProductCluster
  },

  async nextClusterOrder(productId: string): Promise<number> {
    const { data } = await db()
      .from('technical_product_clusters')
      .select('sort_order')
      .eq('product_id', productId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()
    return ((data?.sort_order as number | undefined) ?? 0) + 1
  },

  async patchCluster(
    productId: string,
    clusterId: string,
    patch: Partial<Omit<ProductCluster, 'id'>>,
  ): Promise<ProductCluster | null> {
    const { data, error } = await db()
      .from('technical_product_clusters')
      .update(patch)
      .eq('id', clusterId)
      .eq('product_id', productId)
      .select(CLUSTER_COLS)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return (data as ProductCluster | null) ?? null
  },

  /** Xoá cụm — dòng con về RỜI nhờ `on delete set null`, không mất dòng nào. */
  async deleteCluster(productId: string, clusterId: string): Promise<boolean> {
    const { data, error } = await db()
      .from('technical_product_clusters')
      .delete()
      .eq('id', clusterId)
      .eq('product_id', productId)
      .select('id')
      .maybeSingle()
    if (error) throw new Error(error.message)
    return !!data
  },

  /** Gán nhiều dòng vào một cụm (hoặc `null` để đưa về Rời) trong 1 lượt. */
  async assignCluster(
    productId: string,
    partIds: string[],
    clusterId: string | null,
  ): Promise<number> {
    if (partIds.length === 0) return 0
    const { data, error } = await db()
      .from('technical_product_parts')
      .update({ cluster_id: clusterId })
      .eq('product_id', productId)
      .in('id', partIds)
      .select('id')
    if (error) throw new Error(error.message)
    return (data ?? []).length
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

  /**
   * Số xếp cont 40HC theo SP, cho MỘT TRANG thư viện (map productId → loading).
   *
   * Số thật nằm ở `technical_packing_options`, KHÔNG phải jsonb
   * `technical_products.packing` — jsonb chỉ là ô tóm tắt nhập tay và phần lớn
   * SP bỏ trống (5/537 có số, trong khi 168 SP đã có phương án đóng gói thật).
   * Đọc nhầm chỗ thì thư viện báo "chưa có đóng gói" cho SP đã khai đủ — đúng
   * lỗi mà trang chi tiết đã phải sửa bằng `withPackingFallback`.
   *
   * Nhiều phương án thì lấy phương án MẶC ĐỊNH, không có mặc định thì lấy
   * `option_no` nhỏ nhất — cùng thứ tự ưu tiên với trang chi tiết.
   */
  async packingLoadingByProducts(ids: string[]): Promise<Record<string, number>> {
    if (ids.length === 0) return {}
    const { data } = await db()
      .from('technical_packing_options')
      .select('product_id, loading_40hc, is_default, option_no')
      .in('product_id', ids)
      .not('loading_40hc', 'is', null)
      .order('option_no')

    const best = new Map<string, { loading: number; is_default: boolean }>()
    for (const r of data ?? []) {
      const cur = best.get(r.product_id)
      // `.order('option_no')` đã lo thứ tự, nên chỉ cần cướp chỗ khi gặp mặc định.
      if (!cur || (r.is_default && !cur.is_default)) {
        best.set(r.product_id, { loading: r.loading_40hc!, is_default: r.is_default })
      }
    }
    return Object.fromEntries([...best].map(([id, v]) => [id, v.loading]))
  },
}
