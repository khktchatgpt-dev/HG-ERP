import { db } from '@/server/db'
import { isPoTemplate, type PoTemplate } from '@/lib/po-template'

/**
 * Vật tư như FORM SOẠN ĐƠN cần — TÌM Ở SERVER, không nạp sẵn cả kho.
 *
 * Trang tạo đơn cũ nạp 1.000 vật tư + toàn bộ tồn + 500 PO ngay ở server render,
 * chỉ để phục vụ một ô lọc. Ở đây trả tối đa `limit` dòng theo từ khoá, kèm đúng
 * những trường quyết định cách dòng được nhập:
 *   · po_template   → mẫu đơn mặc định của vật tư (0106)
 *   · kg_per_m + default_bar_length_m → tự tính tổng kg cho mẫu nhôm
 *   · spec, vat_rate, last_purchase_price → tự điền lên dòng
 */
export type PoMaterial = {
  id: string
  code: string
  name: string
  unit: string
  group_name: string | null
  /** Nhóm phụ (0111) — hiện trên dòng kết quả để phân biệt hàng cùng tên. */
  sub_group: string | null
  spec: string | null
  po_template: PoTemplate | null
  kg_per_m: number | null
  default_bar_length_m: number | null
  vat_rate: number | null
  default_supplier_id: string | null
  last_purchase_price: number | null
  on_hand: number
}

const COLS =
  'id, code, name, unit, group_name, sub_group, spec, po_template, kg_per_m, default_bar_length_m, vat_rate, default_supplier_id, last_purchase_price'

function toMaterial(r: Record<string, unknown>, onHand: number): PoMaterial {
  const tpl = r.po_template
  return {
    id: r.id as string,
    code: r.code as string,
    name: r.name as string,
    unit: (r.unit as string) ?? '',
    group_name: (r.group_name as string | null) ?? null,
    sub_group: (r.sub_group as string | null) ?? null,
    spec: (r.spec as string | null) ?? null,
    po_template: isPoTemplate(tpl) ? tpl : null,
    // numeric của PostgREST về dạng chuỗi → ép về number.
    kg_per_m: r.kg_per_m == null ? null : Number(r.kg_per_m),
    default_bar_length_m:
      r.default_bar_length_m == null ? null : Number(r.default_bar_length_m),
    vat_rate: r.vat_rate == null ? null : Number(r.vat_rate),
    default_supplier_id: (r.default_supplier_id as string | null) ?? null,
    last_purchase_price:
      r.last_purchase_price == null ? null : Number(r.last_purchase_price),
    on_hand: onHand,
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

export const poMaterialsRepo = {
  /**
   * Tìm theo mã / tên / barcode. `template` lọc theo mẫu đang soạn để ô chọn của
   * đơn nhôm không lẫn con vít — vật tư CHƯA khai mẫu vẫn hiện (po_template null)
   * chứ không bị giấu, nếu không 64 vật tư chưa khai sẽ thành "mất tích".
   */
  async search(opts: {
    q?: string
    template?: PoTemplate
    /** Lọc theo nhóm — danh mục 13k dòng, gõ "hộp" ra hàng trăm kết quả. */
    group?: string
    limit: number
  }): Promise<PoMaterial[]> {
    let query = db().from('warehouse_materials').select(COLS).eq('is_active', true)

    if (opts.q) {
      const q = opts.q.replace(/[%,()]/g, ' ').trim()
      if (q) query = query.or(`code.ilike.%${q}%,name.ilike.%${q}%,barcode.ilike.%${q}%`)
    }
    if (opts.group) query = query.eq('group_name', opts.group)
    if (opts.template) {
      query = query
        .or(`po_template.eq.${opts.template},po_template.is.null`)
        // Vật tư ĐÚNG mẫu lên trước, chưa khai mẫu (null) xuống cuối. Không có
        // dòng này thì danh sách mặc định của mẫu nhôm toàn hoá chất chưa khai —
        // sắp theo mã nên "HC-0001" luôn thắng vật tư nhôm.
        .order('po_template', { ascending: true, nullsFirst: false })
    }
    query = query.order('code', { ascending: true }).limit(opts.limit)

    const { data } = await query
    const rows = (data as Record<string, unknown>[] | null) ?? []
    const onHand = await onHandMany(rows.map((r) => r.id as string))
    return rows.map((r) => toMaterial(r, onHand.get(r.id as string) ?? 0))
  },

  /** Nạp lại đúng các vật tư đang nằm trên dòng (mở form sửa đơn). */
  async byIds(ids: string[]): Promise<PoMaterial[]> {
    if (ids.length === 0) return []
    const { data } = await db()
      .from('warehouse_materials')
      .select(COLS)
      .in('id', ids.slice(0, 200))
    const rows = (data as Record<string, unknown>[] | null) ?? []
    const onHand = await onHandMany(rows.map((r) => r.id as string))
    return rows.map((r) => toMaterial(r, onHand.get(r.id as string) ?? 0))
  },
}
