import { db } from '@/server/db'
import type { ExistingSp, PkSummary } from '@/lib/sp-excel'

/**
 * Dữ liệu cho luồng Excel SP (09/10/2026): SP đang có ở dạng ExistingSp (đúng
 * 36 cột của file) + 8 ô đóng gói của phương án mặc định; SP của một lệnh SX;
 * nhãn khách để làm ô thả xuống.
 */

type Row = {
  id: string
  code: string
  name: string
  product_type: string | null
  frame_material: string | null
  name_foreign: string | null
  customer_name: string | null
  customer_item_code: string | null
  unit: string
  length_mm: number | null
  width_mm: number | null
  height_mm: number | null
  net_weight_kg: number | null
  actual_weight_kg: number | null
  material: string | null
  tech_spec: Record<string, string | null> | null
  packing: Record<string, number | string | null> | null
  barcode: string | null
  description_en: string | null
  notes: string | null
  is_active: boolean
  locked_at: string | null
  updated_at: string
  image_file_id: string | null
}
const COLS =
  'id, code, name, product_type, frame_material, name_foreign, customer_name, customer_item_code, unit, length_mm, width_mm, height_mm, net_weight_kg, actual_weight_kg, material, tech_spec, packing, barcode, description_en, notes, is_active, locked_at, updated_at, image_file_id'

type OptRow = {
  id: string
  product_id: string
  option_no: number
  is_default: boolean
  cartons_per_set: number | null
  loading_40hc: number | null
  packages:
    | {
        id: string
        package_label: string
        qty: number
        carton_l_mm: number | null
        carton_w_mm: number | null
        carton_h_mm: number | null
        net_weight_kg: number | null
        gross_weight_kg: number | null
        sort_order: number
      }[]
    | null
}
export type DefaultPacking = {
  optionId: string
  cartons_per_set: number | null
  loading_40hc: number | null
  pkg: NonNullable<OptRow['packages']>[number] | null
}

async function allPages<T>(
  build: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999)
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as T[]
    out.push(...rows)
    if (rows.length < 1000) return out
  }
}

const cm = (v: number | null | undefined) => (v == null ? null : v / 10)
const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null

function toExisting(r: Row, def: DefaultPacking | undefined): ExistingSp {
  const j = r.packing ?? {}
  const k = def?.pkg
  const pk: PkSummary = def
    ? {
        pk_qty: def.cartons_per_set ?? num(j.qty_per_carton),
        pk_l: cm(k?.carton_l_mm),
        pk_w: cm(k?.carton_w_mm),
        pk_h: cm(k?.carton_h_mm),
        pk_nw: k?.net_weight_kg ?? null,
        pk_gw: k?.gross_weight_kg ?? null,
        pk_cbm:
          k?.carton_l_mm && k.carton_w_mm && k.carton_h_mm
            ? +((k.carton_l_mm * k.carton_w_mm * k.carton_h_mm) / 1e9).toFixed(4)
            : num(j.cbm),
        pk_hc: def.loading_40hc ?? num(j.loading_40hc),
      }
    : {
        pk_qty: num(j.qty_per_carton),
        pk_l: num(j.carton_l_cm),
        pk_w: num(j.carton_w_cm),
        pk_h: num(j.carton_h_cm),
        pk_nw: num(j.nw_kg),
        pk_gw: num(j.gw_kg),
        pk_cbm: num(j.cbm),
        pk_hc: num(j.loading_40hc),
      }
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    product_type: r.product_type,
    frame_material: r.frame_material,
    name_foreign: r.name_foreign,
    customer_name: r.customer_name,
    customer_item_code: r.customer_item_code,
    unit: r.unit,
    length_mm: r.length_mm,
    width_mm: r.width_mm,
    height_mm: r.height_mm,
    net_weight_kg: r.net_weight_kg,
    actual_weight_kg: r.actual_weight_kg,
    material: r.material,
    tech_spec: (r.tech_spec ?? {}) as ExistingSp['tech_spec'],
    barcode: r.barcode,
    description_en: r.description_en,
    notes: r.notes,
    is_active: r.is_active,
    locked_at: r.locked_at,
    updated_at: r.updated_at,
    image_file_id: r.image_file_id,
    pk,
  }
}

export const spExcelRepo = {
  /** Phương án đóng gói MẶC ĐỊNH (không đánh dấu thì số nhỏ nhất) + kiện đầu của từng SP. */
  async defaultPacking(ids: string[]): Promise<Map<string, DefaultPacking>> {
    const out = new Map<string, DefaultPacking>()
    for (let i = 0; i < ids.length; i += 500) {
      const { data, error } = await db()
        .from('technical_packing_options')
        .select(
          'id, product_id, option_no, is_default, cartons_per_set, loading_40hc, packages:technical_packages(id, package_label, qty, carton_l_mm, carton_w_mm, carton_h_mm, net_weight_kg, gross_weight_kg, sort_order)',
        )
        .in('product_id', ids.slice(i, i + 500))
        .order('option_no')
      if (error) throw new Error(error.message)
      for (const o of (data ?? []) as OptRow[]) {
        const cur = out.get(o.product_id)
        if (cur && !o.is_default) continue
        const pkg =
          (o.packages ?? []).sort((a, b) => a.sort_order - b.sort_order)[0] ?? null
        out.set(o.product_id, {
          optionId: o.id,
          cartons_per_set: o.cartons_per_set,
          loading_40hc: o.loading_40hc,
          pkg,
        })
      }
    }
    return out
  },

  /** Mọi SP (hoặc theo id) ở dạng file Excel cần — kéo theo trang, không dính trần 1000. */
  async listExisting(ids?: string[]): Promise<ExistingSp[]> {
    let rows: Row[]
    if (ids) {
      rows = []
      for (let i = 0; i < ids.length; i += 500) {
        const { data, error } = await db()
          .from('technical_products')
          .select(COLS)
          .in('id', ids.slice(i, i + 500))
        if (error) throw new Error(error.message)
        rows.push(...((data ?? []) as Row[]))
      }
      const order = new Map(ids.map((id, i) => [id, i]))
      rows.sort((x, y) => (order.get(x.id) ?? 0) - (order.get(y.id) ?? 0))
    } else {
      rows = await allPages<Row>((from, to) =>
        db().from('technical_products').select(COLS).order('code').range(from, to),
      )
    }
    const def = await this.defaultPacking(rows.map((r) => r.id))
    return rows.map((r) => toExisting(r, def.get(r.id)))
  },

  /** SP trên một lệnh SX, theo thứ tự dòng lệnh. */
  async productIdsOfLsx(code: string): Promise<string[] | null> {
    const lsx = await db()
      .from('production_orders')
      .select('id')
      .eq('code', code)
      .maybeSingle()
    if (!lsx.data) return null
    const { data, error } = await db()
      .from('production_order_lines')
      .select('product_id, sort_order')
      .eq('production_order_id', lsx.data.id)
      .order('sort_order')
    if (error) throw new Error(error.message)
    return [
      ...new Set((data ?? []).map((l) => l.product_id).filter((v): v is string => !!v)),
    ]
  },

  async customerNames(): Promise<string[]> {
    const rows = await allPages<{ customer_name: string | null }>((from, to) =>
      db()
        .from('technical_products')
        .select('customer_name')
        .not('customer_name', 'is', null)
        .range(from, to),
    )
    return [...new Set(rows.map((r) => r.customer_name!).filter(Boolean))].sort()
  },

  /** Mã đang có của một loại — để cấp số kế tiếp cho SP mới. */
  async codesByType(type: string): Promise<string[]> {
    const rows = await allPages<{ code: string }>((from, to) =>
      db()
        .from('technical_products')
        .select('code')
        .like('code', `${type}%`)
        .range(from, to),
    )
    return rows.map((r) => r.code)
  },
}
