import { db } from '@/server/db'
import { isPoTemplate, type PoTemplate } from '@/lib/po-template'
import { searchTokens } from '@/lib/search-text'

export type Material = {
  id: string
  code: string
  name: string
  unit: string
  /** Mã vạch sẵn có của NCC (EAN…) — ScanInput khớp cả code lẫn barcode (0078). */
  barcode: string | null
  /** Quy cách (0056) — kích thước/thông số, tự điền vào dòng đơn khi chọn vật tư. */
  spec: string | null
  /** Đơn vị TÍNH GIÁ ('kg', 'm²'…) — NULL = giá theo ĐVT mua (0053, giá đv kép). */
  price_unit: string | null
  /** B: hệ số cứng (SL×hệ số); C: định mức kg/đơn-vị-đặt (vd 10.1 kg/cây) — sửa theo cân thực. */
  unit2_factor: number | null
  group_name: string | null
  /** Nhóm phụ trong nhóm chính (0111) — 106 nhóm của sổ Cung ứng. */
  sub_group: string | null
  min_stock: number
  /** Bù tồn (0043, nghiệp vụ ① Cung ứng): trần tồn + ngưỡng/lô đặt lại. */
  max_stock: number | null
  /** Dung sai NHẬN VƯỢT % trên SL đặt của dòng PO (0156) — 0 = chặn mọi mức vượt. */
  over_tolerance_pct: number
  reorder_point: number | null
  reorder_qty: number | null
  shelf_location: string | null
  /** Tự-điền lên đơn (0055). */
  vat_rate: number | null
  default_supplier_id: string | null
  last_purchase_price: number | null
  /** Mẫu đơn đặt hàng mặc định (0106) — quyết định bộ cột khi soạn đơn cho vật tư này. */
  po_template: PoTemplate | null
  /** Nhôm (0109): kg/m và dài cây mặc định — mẫu đơn nhôm nhân ra tổng kg. */
  kg_per_m: number | null
  /** kg mỗi ĐƠN VỊ ĐẶT (kg/tấm, kg/cuộn) — 0112. */
  kg_per_unit: number | null
  default_bar_length_m: number | null
  /** Đóng gói mua (0124): 1 pack_unit = pack_size ĐVT gốc (vd 1 bì = 500 con). */
  pack_size: number | null
  pack_unit: string | null
  /** Vật liệu / màu (0124) — cột "Vật liệu" của đơn phụ kiện/inox. */
  material_grade: string | null
  /** Thông số theo nhóm (0137): bao bì — cách mở AD/MR/ĐK + SP mỗi thùng. */
  open_style: string | null
  pcs_per_ctn: number | null
  /** Thông số theo nhóm (0137): kim loại — màu / bề mặt ("inox bóng"). */
  finish: string | null
  note: string | null
  /** Khai nhanh từ form đơn đặt, chờ Kho rà lại (0136) — gỡ cờ khi đã chuẩn hoá. */
  needs_review: boolean
  /** Key trường khai vội cần rà (0138) — chip từng trường trên màn Kho. */
  needs_review_fields: string[]
  created_by: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

const COLS =
  'id, code, name, unit, barcode, spec, price_unit, unit2_factor, group_name, sub_group, min_stock, max_stock, over_tolerance_pct, reorder_point, reorder_qty, shelf_location, vat_rate, default_supplier_id, last_purchase_price, po_template, kg_per_m, kg_per_unit, default_bar_length_m, pack_size, pack_unit, material_grade, open_style, pcs_per_ctn, finish, note, needs_review, needs_review_fields, created_by, is_active, created_at, updated_at'

export type ListFilter = {
  q?: string
  group_name?: string
  active_only: boolean
  /** true = chỉ vật tư "chờ Kho rà" (0136). */
  needs_review?: boolean
  page: number
  page_size: number
}

// Postgres `numeric` về qua PostgREST là CHUỖI (vd "20.00") → ép về number để
// đúng type + sắp xếp/so sánh số chuẩn.
function toMaterial(row: Record<string, unknown>): Material {
  return {
    ...(row as Material),
    min_stock: Number(row.min_stock ?? 0),
    max_stock: row.max_stock == null ? null : Number(row.max_stock),
    over_tolerance_pct: Number(row.over_tolerance_pct ?? 0),
    reorder_point: row.reorder_point == null ? null : Number(row.reorder_point),
    reorder_qty: row.reorder_qty == null ? null : Number(row.reorder_qty),
    unit2_factor: row.unit2_factor == null ? null : Number(row.unit2_factor),
    vat_rate: row.vat_rate == null ? null : Number(row.vat_rate),
    last_purchase_price:
      row.last_purchase_price == null ? null : Number(row.last_purchase_price),
    // Cột DB là text tự do — lọc qua isPoTemplate để giá trị lạ về null thay vì
    // chảy xuống form soạn đơn rồi hỏng bộ cột.
    po_template: isPoTemplate(row.po_template) ? row.po_template : null,
    kg_per_m: row.kg_per_m == null ? null : Number(row.kg_per_m),
    kg_per_unit: row.kg_per_unit == null ? null : Number(row.kg_per_unit),
    default_bar_length_m:
      row.default_bar_length_m == null ? null : Number(row.default_bar_length_m),
    pack_size: row.pack_size == null ? null : Number(row.pack_size),
    pcs_per_ctn: row.pcs_per_ctn == null ? null : Number(row.pcs_per_ctn),
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
    if (filter.needs_review) q = q.eq('needs_review', true)
    // Tìm KHÔNG DẤU trên search_text (0127) — AND từng từ, gõ "vit 4x15" vẫn trúng.
    for (const t of searchTokens(filter.q ?? '')) q = q.ilike('search_text', `%${t}%`)

    const from = (filter.page - 1) * filter.page_size
    const to = from + filter.page_size - 1
    q = q.range(from, to)

    const { data, count } = await q
    return {
      rows: ((data as Record<string, unknown>[] | null) ?? []).map(toMaterial),
      total: count ?? 0,
    }
  },

  /**
   * Đếm theo BỘ LỌC ĐANG XEM, không đếm cả danh mục.
   *
   * StatsBar trước đây cộng từ mảng đã nạp về client. Trang nạp 1.000 dòng đầu
   * trong khi danh mục có 12.991 nên mọi con số đều là của 1.000 dòng đó, mà
   * nhãn thì không nói gì — đọc xong tưởng cả kho chỉ có ngần ấy.
   */
  async counts(filter: {
    q?: string
    group_name?: string
  }): Promise<{ total: number; active: number; noShelf: number; needsReview: number }> {
    const base = () => {
      let q = db().from('warehouse_materials').select('*', { count: 'exact', head: true })
      if (filter.group_name) q = q.eq('group_name', filter.group_name)
      // Cùng luật tìm không dấu với list — hai nơi lệch nhau là StatsBar nói dối.
      for (const t of searchTokens(filter.q ?? '')) q = q.ilike('search_text', `%${t}%`)
      return q
    }
    const [all, act, shelf, review] = await Promise.all([
      base(),
      base().eq('is_active', true),
      base().is('shelf_location', null),
      // Khai nhanh từ form đơn, chờ Kho rà (0136) — ô đếm để Kho khỏi quên.
      base().eq('needs_review', true),
    ])
    return {
      total: all.count ?? 0,
      active: act.count ?? 0,
      noShelf: shelf.count ?? 0,
      needsReview: review.count ?? 0,
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

  /**
   * Mã + tên của một NHÓM — đủ để so trùng tên và suy tiền tố mã đang dùng.
   *
   * Chỉ lấy hai cột: nhóm to nhất (Nhôm) là 276 dòng, kéo cả `COLS` mỗi lần khai
   * vật tư là tiền egress thuần tuý. Nhóm trống ('' hoặc null) gom về một rọ —
   * đúng như script dọn trùng vẫn làm, để không so chéo vật liệu.
   */
  async namesInGroup(
    groupName: string | null,
  ): Promise<{ code: string; name: string }[]> {
    let q = db().from('warehouse_materials').select('code, name').limit(2000)
    q = groupName ? q.eq('group_name', groupName) : q.is('group_name', null)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    return (data as { code: string; name: string }[] | null) ?? []
  },

  /**
   * Số lớn nhất đang dùng của một tiền tố, để cấp mã kế tiếp.
   *
   * Mã đệm 0 đủ 4 chữ số nên sắp theo CHUỖI giảm dần cũng chính là sắp theo số —
   * chỉ cần một dòng, không phải kéo cả danh mục về đếm. (Vượt 9999 thì thứ tự
   * chuỗi vỡ; lúc đó `NK-10000` vẫn lớn hơn `NK-9999` theo chuỗi nên vẫn đúng.)
   */
  async maxCodeNo(prefix: string): Promise<number> {
    const { data, error } = await db()
      .from('warehouse_materials')
      .select('code')
      .like('code', `${prefix}-%`)
      .order('code', { ascending: false })
      .limit(1)
    if (error) throw new Error(error.message)
    const code = (data as { code: string }[] | null)?.[0]?.code
    const hit = code?.match(/^[A-Z]{2,3}-(\d+)$/)
    return hit ? Number(hit[1]) : 0
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

  /**
   * Trần tồn theo vật tư (P3.1) — nuôi cảnh báo "mua vượt trần" trên form PO.
   * View warehouse_stock không mang max_stock nên tra thẳng danh mục.
   */
  async maxStockMany(ids: string[]): Promise<Map<string, number | null>> {
    if (ids.length === 0) return new Map()
    const { data } = await db()
      .from('warehouse_materials')
      .select('id, max_stock')
      .in('id', ids)
    return new Map(
      ((data ?? []) as { id: string; max_stock: unknown }[]).map((r) => [
        r.id,
        r.max_stock == null ? null : Number(r.max_stock),
      ]),
    )
  },

  /**
   * Đặt DUNG SAI NHẬN VƯỢT cho cả một nhóm (0156) — bulk theo group_name, một
   * câu update thay vì N lượt PATCH (nhóm gỗ/kính hàng trăm mã). Trả số dòng đổi.
   */
  async setGroupTolerance(groupName: string, pct: number): Promise<number> {
    const { data, error } = await db()
      .from('warehouse_materials')
      .update({ over_tolerance_pct: pct })
      .eq('group_name', groupName)
      .select('id')
    if (error) throw new Error(error.message)
    return (data ?? []).length
  },
}
