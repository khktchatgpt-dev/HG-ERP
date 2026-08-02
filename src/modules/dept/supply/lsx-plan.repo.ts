import { db } from '@/server/db'
import type { PlanStatus } from './lsx-plan.schema'

/**
 * Truy cập bảng kê vật tư theo LSX (`supply_lsx_material_plan`, migration 0108).
 * Không có nghiệp vụ ở đây — tính toán nằm ở `lsx-plan.calc.ts`, quyền ở service.
 */

export type PlanRow = {
  id: string
  production_order_id: string
  product_id: string | null
  product_code: string | null
  product_name: string | null
  material_id: string | null
  material_name: string
  unit: string | null
  qty_per_product: number | null
  product_qty: number | null
  qty_required: number
  waste_pct: number
  qty_on_hand: number | null
  qty_to_order: number
  unit_price: number | null
  supplier_id: string | null
  supplier_label: string | null
  status: PlanStatus
  po_line_id: string | null
  note: string | null
  source: string
  /** Nối thêm khi đọc — để màn hình không phải tự tra. */
  material_code: string | null
  material_unit: string | null
  material_template: string | null
  supplier_name: string | null
  supplier_code: string | null
}

const SELECT =
  'id, production_order_id, product_id, product_code, product_name, material_id, material_name, unit, qty_per_product, product_qty, qty_required, waste_pct, qty_on_hand, qty_to_order, unit_price, supplier_id, supplier_label, status, po_line_id, note, source, material:warehouse_materials(code, unit, po_template), supplier:supply_suppliers(name, code)'

type Raw = Record<string, unknown> & {
  material: { code: string; unit: string; po_template: string | null } | null
  supplier: { name: string; code: string | null } | null
}

const num = (v: unknown): number => (v == null ? 0 : Number(v))
const numOrNull = (v: unknown): number | null => (v == null ? null : Number(v))

function unwrap(rows: Raw[]): PlanRow[] {
  return rows.map((r) => ({
    id: r.id as string,
    production_order_id: r.production_order_id as string,
    product_id: (r.product_id as string | null) ?? null,
    product_code: (r.product_code as string | null) ?? null,
    product_name: (r.product_name as string | null) ?? null,
    material_id: (r.material_id as string | null) ?? null,
    material_name: r.material_name as string,
    unit: (r.unit as string | null) ?? null,
    qty_per_product: numOrNull(r.qty_per_product),
    product_qty: numOrNull(r.product_qty),
    qty_required: num(r.qty_required),
    waste_pct: num(r.waste_pct),
    qty_on_hand: numOrNull(r.qty_on_hand),
    qty_to_order: num(r.qty_to_order),
    unit_price: numOrNull(r.unit_price),
    supplier_id: (r.supplier_id as string | null) ?? null,
    supplier_label: (r.supplier_label as string | null) ?? null,
    status: r.status as PlanStatus,
    po_line_id: (r.po_line_id as string | null) ?? null,
    note: (r.note as string | null) ?? null,
    source: r.source as string,
    material_code: r.material?.code ?? null,
    material_unit: r.material?.unit ?? null,
    material_template: r.material?.po_template ?? null,
    supplier_name: r.supplier?.name ?? null,
    supplier_code: r.supplier?.code ?? null,
  }))
}

export type PlanInsert = {
  production_order_id: string
  product_id?: string | null
  product_code?: string | null
  product_name?: string | null
  material_id?: string | null
  material_name: string
  unit?: string | null
  qty_per_product?: number | null
  product_qty?: number | null
  qty_required: number
  waste_pct: number
  qty_on_hand?: number | null
  qty_to_order: number
  unit_price?: number | null
  supplier_id?: string | null
  supplier_label?: string | null
  status: PlanStatus
  note?: string | null
  source: string
  created_by: string
}

export const lsxPlanRepo = {
  async listByLsx(productionOrderId: string): Promise<PlanRow[]> {
    const { data } = await db()
      .from('supply_lsx_material_plan')
      .select(SELECT)
      .eq('production_order_id', productionOrderId)
      .order('product_code', { nullsFirst: false })
      .order('created_at')
      .limit(3000)
    return unwrap((data as Raw[] | null) ?? [])
  },

  async byIds(ids: string[]): Promise<PlanRow[]> {
    if (ids.length === 0) return []
    const { data } = await db()
      .from('supply_lsx_material_plan')
      .select(SELECT)
      .in('id', ids)
    return unwrap((data as Raw[] | null) ?? [])
  },

  /** Xoá dòng cùng nguồn trước khi nạp lại — nạp lại file đã sửa không sinh trùng. */
  async deleteBySource(productionOrderId: string, source: string): Promise<void> {
    const { error } = await db()
      .from('supply_lsx_material_plan')
      .delete()
      .eq('production_order_id', productionOrderId)
      .eq('source', source)
      // Dòng đã vào đơn thì KHÔNG xoá: đơn đang chạy còn trỏ vào nó.
      .is('po_line_id', null)
    if (error) throw new Error(error.message)
  },

  async insertMany(rows: PlanInsert[]): Promise<number> {
    if (rows.length === 0) return 0
    let done = 0
    for (let i = 0; i < rows.length; i += 500) {
      const { error, count } = await db()
        .from('supply_lsx_material_plan')
        .insert(rows.slice(i, i + 500), { count: 'exact' })
      if (error) throw new Error(error.message)
      done += count ?? 0
    }
    return done
  },

  async updateMany(
    ids: string[],
    patch: Partial<{
      supplier_id: string | null
      material_id: string | null
      status: PlanStatus
      waste_pct: number
      qty_to_order: number
      unit_price: number | null
      note: string | null
      po_line_id: string | null
      updated_by: string
    }>,
  ): Promise<void> {
    if (ids.length === 0) return
    const { error } = await db()
      .from('supply_lsx_material_plan')
      .update(patch)
      .in('id', ids)
    if (error) throw new Error(error.message)
  },
}
