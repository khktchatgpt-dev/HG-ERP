import { db } from '@/server/db'
import { normalizeSearch, searchTokens } from '@/lib/search-text'

/**
 * Vật tư như FORM SOẠN ĐƠN cần — TÌM Ở SERVER, không nạp sẵn cả kho.
 *
 * Trang tạo đơn cũ nạp 1.000 vật tư + toàn bộ tồn + 500 PO ngay ở server render,
 * chỉ để phục vụ một ô lọc. Ở đây trả tối đa `limit` dòng theo từ khoá, kèm đúng
 * những trường quyết định cách dòng được nhập:
 *   · kg_per_m + default_bar_length_m → tự tính tổng kg cho mẫu nhôm
 *   · spec, vat_rate, last_purchase_price → tự điền lên dòng
 */
/**
 * Ô MÔ TẢ của lần đặt GẦN NHẤT — điền sẵn lên dòng mới (08/08/2026, "hạn chế
 * nhân viên phải gõ"): Vật liệu/Màu/Kích thước/Cách mở… của một vật tư gần như
 * không đổi giữa các đơn, gõ lại mỗi lần chỉ tổ sai chính tả so với phiếu cũ.
 */
export type PoLastLine = {
  material_grade: string | null
  dimension_text: string | null
  finish: string | null
  pcs_per_ctn: number | null
  open_style: string | null
  dm_per_sp: number | null
}

export type PoMaterial = {
  id: string
  code: string
  name: string
  unit: string
  group_name: string | null
  /** Nhóm phụ (0111) — hiện trên dòng kết quả để phân biệt hàng cùng tên. */
  sub_group: string | null
  spec: string | null
  kg_per_m: number | null
  kg_per_unit: number | null
  default_bar_length_m: number | null
  /**
   * GIÁ ĐƠN VỊ KÉP khai ở danh mục (0053): `price_unit` = đơn vị của đơn giá
   * ('kg'…), `unit2_factor` = bao nhiêu đơn-vị-giá trong MỘT ĐVT mua (23,94
   * kg/tấm). Kho khai một lần, đơn đặt dùng lại — trước 10/08/2026 form không
   * đọc hai trường này nên người mua vẫn phải gõ lại kg/đơn-vị.
   */
  price_unit: string | null
  unit2_factor: number | null
  vat_rate: number | null
  default_supplier_id: string | null
  last_purchase_price: number | null
  /** Đóng gói mua (0124): 1 pack_unit = pack_size ĐVT (vd 1 bì = 500 con). */
  pack_size: number | null
  pack_unit: string | null
  /** Vật liệu/màu khai ở danh mục (0124) — nguồn dự phòng khi chưa có lần đặt nào. */
  material_grade: string | null
  /**
   * Tồn hiện tại. NULL = vật tư CHƯA CÓ SỔ KHO (chưa từng nhập/xuất/kiểm kê) —
   * khác hẳn "tồn 0 thật". Trước go-live tồn đầu kỳ, gần như cả danh mục là
   * null; hiện "tồn 0" cho chúng là dạy người mua bỏ qua cột tồn vĩnh viễn
   * (bất cập #2, 09/08/2026).
   */
  on_hand: number | null
  /** null = vật tư chưa từng lên đơn nào. */
  last_line: PoLastLine | null
}

const COLS =
  'id, code, name, unit, group_name, sub_group, spec, kg_per_m, kg_per_unit, default_bar_length_m, price_unit, unit2_factor, vat_rate, default_supplier_id, last_purchase_price, pack_size, pack_unit, material_grade'

function toMaterial(
  r: Record<string, unknown>,
  onHand: number | null,
  lastLine: PoLastLine | null,
): PoMaterial {
  return {
    id: r.id as string,
    code: r.code as string,
    name: r.name as string,
    unit: (r.unit as string) ?? '',
    group_name: (r.group_name as string | null) ?? null,
    sub_group: (r.sub_group as string | null) ?? null,
    spec: (r.spec as string | null) ?? null,
    // numeric của PostgREST về dạng chuỗi → ép về number.
    kg_per_m: r.kg_per_m == null ? null : Number(r.kg_per_m),
    kg_per_unit: r.kg_per_unit == null ? null : Number(r.kg_per_unit),
    default_bar_length_m:
      r.default_bar_length_m == null ? null : Number(r.default_bar_length_m),
    price_unit: (r.price_unit as string | null) ?? null,
    unit2_factor: r.unit2_factor == null ? null : Number(r.unit2_factor),
    vat_rate: r.vat_rate == null ? null : Number(r.vat_rate),
    default_supplier_id: (r.default_supplier_id as string | null) ?? null,
    last_purchase_price:
      r.last_purchase_price == null ? null : Number(r.last_purchase_price),
    pack_size: r.pack_size == null ? null : Number(r.pack_size),
    pack_unit: (r.pack_unit as string | null) ?? null,
    material_grade: (r.material_grade as string | null) ?? null,
    on_hand: onHand,
    last_line: lastLine,
  }
}

/** Tồn hiện tại của các vật tư — 1 truy vấn cho cả trang kết quả, không N+1. */
async function onHandMany(ids: string[]): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map()
  const { data } = await db()
    .from('warehouse_stock')
    .select('material_id, on_hand')
    .in('material_id', ids)
  const m = new Map<string, number>()
  for (const r of (data ?? []) as { material_id: string; on_hand: unknown }[]) {
    m.set(r.material_id, Number(r.on_hand ?? 0))
  }
  return m
}

/**
 * Ô mô tả của dòng đơn GẦN NHẤT theo từng vật tư — 1 truy vấn cho cả trang.
 *
 * Bảng dòng không có created_at nên độ mới lấy theo NGÀY TẠO ĐƠN (embed
 * supply_purchase_orders.created_at) rồi chọn dòng mới nhất trong JS. Kéo dư
 * (limit 400) vì một vật tư có thể nằm trên nhiều đơn; thiếu lịch sử thì trả
 * null — dòng mới để trống như cũ, không chặn gì.
 */
async function lastLinesMany(ids: string[]): Promise<Map<string, PoLastLine>> {
  if (ids.length === 0) return new Map()
  const { data } = await db()
    .from('supply_purchase_order_lines')
    .select(
      'material_id, material_grade, dimension_text, finish, pcs_per_ctn, open_style, dm_per_sp, supply_purchase_orders!inner(created_at)',
    )
    .in('material_id', ids)
    .limit(400)
  type Row = {
    material_id: string
    material_grade: string | null
    dimension_text: string | null
    finish: string | null
    pcs_per_ctn: unknown
    open_style: string | null
    dm_per_sp: unknown
    supply_purchase_orders: { created_at: string }
  }
  const rows = ((data ?? []) as unknown as Row[]).sort((a, b) =>
    (b.supply_purchase_orders?.created_at ?? '').localeCompare(
      a.supply_purchase_orders?.created_at ?? '',
    ),
  )
  const m = new Map<string, PoLastLine>()
  for (const r of rows) {
    if (m.has(r.material_id)) continue
    m.set(r.material_id, {
      material_grade: r.material_grade ?? null,
      dimension_text: r.dimension_text ?? null,
      finish: r.finish ?? null,
      pcs_per_ctn: r.pcs_per_ctn == null ? null : Number(r.pcs_per_ctn),
      open_style: r.open_style ?? null,
      dm_per_sp: r.dm_per_sp == null ? null : Number(r.dm_per_sp),
    })
  }
  return m
}

export const poMaterialsRepo = {
  /**
   * Tìm theo mã / tên / barcode — KHÔNG dính gì tới mẫu đơn.
   *
   * Trước đây lọc theo `po_template` gắn trên vật tư: gỗ mang mẫu "Đơn giản" nên
   * soạn đơn phụ kiện gõ "gỗ" ra trắng tay, người mua tưởng danh mục không có gỗ.
   * Bỏ hẳn (08/08/2026): mẫu đơn là thuộc tính của ĐƠN — chọn ở đầu form, quyết
   * định bộ cột; vật tư nào cũng đặt được ở mẫu nào.
   */
  async search(opts: {
    q?: string
    /** Lọc theo nhóm — danh mục 13k dòng, gõ "hộp" ra hàng trăm kết quả. */
    group?: string
    limit: number
  }): Promise<PoMaterial[]> {
    const base = () => {
      let query = db().from('warehouse_materials').select(COLS).eq('is_active', true)
      if (opts.group) query = query.eq('group_name', opts.group)
      return query
    }

    /*
     * TÌM KHÔNG DẤU (0127): AND từng từ khoá bằng ilike trên cột `search_text`
     * (đã hạ thường + bỏ dấu, gộp mã + tên + barcode + quy cách + nhóm phụ) —
     * "vit 4x15" không dấu, đảo thứ tự từ, đều trúng "Vít 4x15". Trước đây
     * ilike trên cột gốc phân biệt dấu, người gõ vội trắng tay.
     */
    const tokens = searchTokens(opts.q ?? '')
    let rows: Record<string, unknown>[]
    if (tokens.length > 0) {
      let query = base()
      for (const t of tokens) query = query.ilike('search_text', `%${t}%`)
      // Kéo dư gấp đôi rồi tự xếp hạng bên dưới — thứ hạng cần lịch sử đặt,
      // thứ DB không biết lúc lọc.
      const { data } = await query.order('name').limit(opts.limit * 2)
      rows = (data as Record<string, unknown>[] | null) ?? []
    } else {
      const { data } = await base().order('code', { ascending: true }).limit(opts.limit)
      rows = (data as Record<string, unknown>[] | null) ?? []
    }

    const rowIds = rows.map((r) => r.id as string)
    const [onHand, lastLines] = await Promise.all([
      onHandMany(rowIds),
      lastLinesMany(rowIds),
    ])
    const mats = rows.map((r) =>
      toMaterial(
        r,
        onHand.get(r.id as string) ?? null, // null = chưa có sổ kho (0127)
        lastLines.get(r.id as string) ?? null,
      ),
    )
    if (tokens.length === 0) return mats

    /*
     * XẾP HẠNG "MÃ ĐANG DÙNG" LÊN ĐẦU (bất cập #4 — rừng mã trùng): "vít 4x15"
     * ra 25 mã na ná nhau, tồn 0 hết, không có tín hiệu nào để chọn. Tín hiệu
     * tốt nhất hệ thống có: mã ĐÃ TỪNG LÊN ĐƠN (last_line) rồi tới mã có giá
     * trong danh mục — người trước đã chọn nó thì người sau nên theo, danh mục
     * mới liền mạch thay vì mỗi người một mã.
     */
    const nq = normalizeSearch(opts.q ?? '')
    const score = (m: PoMaterial) =>
      (m.last_line ? 4 : 0) +
      (m.last_purchase_price != null ? 2 : 0) +
      (normalizeSearch(m.name).startsWith(nq) || normalizeSearch(m.code).startsWith(nq)
        ? 1
        : 0)
    return mats
      .sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name, 'vi'))
      .slice(0, opts.limit)
  },

  /** Nạp lại đúng các vật tư đang nằm trên dòng (mở form sửa đơn). */
  async byIds(ids: string[]): Promise<PoMaterial[]> {
    if (ids.length === 0) return []
    const { data } = await db()
      .from('warehouse_materials')
      .select(COLS)
      .in('id', ids.slice(0, 200))
    const rows = (data as Record<string, unknown>[] | null) ?? []
    const rowIds = rows.map((r) => r.id as string)
    const [onHand, lastLines] = await Promise.all([
      onHandMany(rowIds),
      lastLinesMany(rowIds),
    ])
    return rows.map((r) =>
      toMaterial(
        r,
        onHand.get(r.id as string) ?? null, // null = chưa có sổ kho (0127)
        lastLines.get(r.id as string) ?? null,
      ),
    )
  },
}
