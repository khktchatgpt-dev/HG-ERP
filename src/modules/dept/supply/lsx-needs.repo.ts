import { db } from '@/server/db'

/**
 * BẢNG KÊ NHẬP TAY của Cung ứng theo lệnh (0184) — data access thuần.
 * Một mã một dòng trên một lệnh; ghi là upsert theo (lệnh, mã).
 */
export type LsxNeedManual = {
  id: string
  production_order_id: string
  material_id: string
  material_code: string
  material_name: string
  unit: string
  group_name: string | null
  qty_needed: number
  note: string | null
  updated_at: string
}

const COLS =
  'id, production_order_id, material_id, qty_needed, note, updated_at, material:warehouse_materials(code, name, unit, group_name)'

type Mat = { code: string; name: string; unit: string; group_name: string | null }
type Raw = {
  id: string
  production_order_id: string
  material_id: string
  qty_needed: unknown
  note: string | null
  updated_at: string
  material: Mat | Mat[] | null
}

function unwrap(rows: Raw[] | null): LsxNeedManual[] {
  return (rows ?? []).map((r) => {
    const m = Array.isArray(r.material) ? r.material[0] : r.material
    return {
      id: r.id,
      production_order_id: r.production_order_id,
      material_id: r.material_id,
      material_code: m?.code ?? '',
      material_name: m?.name ?? '?',
      unit: m?.unit ?? '',
      group_name: m?.group_name ?? null,
      qty_needed: Number(r.qty_needed) || 0,
      note: r.note,
      updated_at: r.updated_at,
    }
  })
}

export const lsxNeedsRepo = {
  async listByLsx(productionOrderId: string): Promise<LsxNeedManual[]> {
    const { data, error } = await db()
      .from('supply_lsx_needs')
      .select(COLS)
      .eq('production_order_id', productionOrderId)
      .limit(2000)
    if (error) throw new Error(error.message)
    return unwrap(data as Raw[] | null)
  },

  /** Upsert theo (lệnh, mã) — dòng đã có thì đè số + ghi chú, giữ người tạo. */
  async upsertMany(
    productionOrderId: string,
    rows: { material_id: string; qty_needed: number; note: string | null }[],
    userId: string,
  ): Promise<void> {
    if (rows.length === 0) return
    const { error } = await db()
      .from('supply_lsx_needs')
      .upsert(
        rows.map((r) => ({
          production_order_id: productionOrderId,
          material_id: r.material_id,
          qty_needed: r.qty_needed,
          note: r.note,
          created_by: userId,
          updated_by: userId,
        })),
        { onConflict: 'production_order_id,material_id', ignoreDuplicates: false },
      )
    if (error) throw new Error(error.message)
  },

  async deleteMany(productionOrderId: string, materialIds: string[]): Promise<void> {
    if (materialIds.length === 0) return
    const { error } = await db()
      .from('supply_lsx_needs')
      .delete()
      .eq('production_order_id', productionOrderId)
      .in('material_id', materialIds)
    if (error) throw new Error(error.message)
  },
}
