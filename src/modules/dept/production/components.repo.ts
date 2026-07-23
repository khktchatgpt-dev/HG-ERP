import { db } from '@/server/db'

/** 1 dòng chi tiết của LSX (kèm thông tin vật tư join để hiển thị). */
export type ComponentRow = {
  id: string
  production_order_id: string
  order_line_id: string
  cluster: string | null
  name: string
  material_id: string | null
  material_type: string | null
  spec_thickness_mm: number | null
  spec_width_mm: number | null
  spec_length_mm: number | null
  qty_per_unit: number
  dm_kg: number | null
  pcs_per_bar: number | null
  final_stage: string | null
  sort_order: number
  note: string | null
  material_code: string | null
  material_name: string | null
  material_unit: string | null
}

export type ComponentInput = {
  order_line_id: string
  cluster?: string | null
  name: string
  material_id?: string | null
  material_type?: string | null
  spec_thickness_mm?: number | null
  spec_width_mm?: number | null
  spec_length_mm?: number | null
  qty_per_unit: number
  dm_kg?: number | null
  pcs_per_bar?: number | null
  final_stage?: string | null
  note?: string | null
}

const COLS =
  'id, production_order_id, order_line_id, cluster, name, material_id, material_type, spec_thickness_mm, spec_width_mm, spec_length_mm, qty_per_unit, dm_kg, pcs_per_bar, final_stage, sort_order, note'

type Raw = Omit<ComponentRow, 'material_code' | 'material_name' | 'material_unit'> & {
  material:
    | { code: string; name: string; unit: string }
    | { code: string; name: string; unit: string }[]
    | null
}

function unwrap(rows: Raw[] | null): ComponentRow[] {
  return (rows ?? []).map((r) => {
    const m = Array.isArray(r.material) ? r.material[0] : r.material
    return {
      ...r,
      material: undefined,
      material_code: m?.code ?? null,
      material_name: m?.name ?? null,
      material_unit: m?.unit ?? null,
    } as unknown as ComponentRow
  })
}

export const componentsRepo = {
  async listByLsx(productionOrderId: string): Promise<ComponentRow[]> {
    const { data } = await db()
      .from('production_order_components')
      .select(`${COLS}, material:warehouse_materials(code, name, unit)`)
      .eq('production_order_id', productionOrderId)
      .order('sort_order')
    return unwrap(data as Raw[] | null)
  },

  /** Ghi đè trọn bộ bảng chi tiết của 1 LSX (pattern BOM editor). */
  async replaceAll(productionOrderId: string, lines: ComponentInput[]): Promise<void> {
    const { error: delErr } = await db()
      .from('production_order_components')
      .delete()
      .eq('production_order_id', productionOrderId)
    if (delErr) throw new Error(delErr.message)
    if (lines.length === 0) return
    const { error } = await db()
      .from('production_order_components')
      .insert(
        lines.map((l, i) => ({
          production_order_id: productionOrderId,
          order_line_id: l.order_line_id,
          cluster: l.cluster ?? null,
          name: l.name,
          material_id: l.material_id ?? null,
          material_type: l.material_type ?? null,
          spec_thickness_mm: l.spec_thickness_mm ?? null,
          spec_width_mm: l.spec_width_mm ?? null,
          spec_length_mm: l.spec_length_mm ?? null,
          qty_per_unit: l.qty_per_unit,
          dm_kg: l.dm_kg ?? null,
          pcs_per_bar: l.pcs_per_bar ?? null,
          final_stage: l.final_stage ?? null,
          note: l.note ?? null,
          sort_order: i,
        })),
      )
    if (error) throw new Error(error.message)
  },

  /**
   * Bảng chi tiết của các LSX TRƯỚC có cùng SP — nguồn "Chép từ lệnh trước".
   * Trả kèm product_id (qua dòng đơn) để remap sang dòng của lệnh hiện tại.
   */
  async listPreviousByProducts(
    productIds: string[],
    excludeLsxId: string,
  ): Promise<(ComponentRow & { product_id: string })[]> {
    if (productIds.length === 0) return []
    const { data } = await db()
      .from('production_order_components')
      .select(
        `${COLS}, created_at, material:warehouse_materials(code, name, unit), line:sales_order_lines!inner(product_id)`,
      )
      .neq('production_order_id', excludeLsxId)
      .in('line.product_id', productIds)
      .order('created_at', { ascending: false })
      .limit(1000)
    type PrevRaw = Raw & {
      line: { product_id: string } | { product_id: string }[] | null
    }
    return (unwrap(data as Raw[] | null) as ComponentRow[]).map((r, i) => {
      const raw = (data as PrevRaw[] | null)?.[i]
      const line = raw ? (Array.isArray(raw.line) ? raw.line[0] : raw.line) : null
      return { ...r, product_id: line?.product_id ?? '' }
    })
  },

  /**
   * Dòng chi tiết của NHIỀU LSX kèm SL sản phẩm của dòng đơn — nguồn tính tồn
   * đặt trước (bước 2 Kho, lib reserved-stock). 1 truy vấn cho cả danh sách
   * LSX cam kết thay vì lặp listByLsx.
   */
  async listForReserve(productionOrderIds: string[]): Promise<
    {
      production_order_id: string
      material_id: string | null
      qty_per_unit: number
      dm_kg: number | null
      pcs_per_bar: number | null
      order_qty: number
    }[]
  > {
    if (productionOrderIds.length === 0) return []
    const { data } = await db()
      .from('production_order_components')
      .select(
        'production_order_id, material_id, qty_per_unit, dm_kg, pcs_per_bar, line:sales_order_lines(qty)',
      )
      .in('production_order_id', productionOrderIds)
      .limit(20000)
    type Row = {
      production_order_id: string
      material_id: string | null
      qty_per_unit: number
      dm_kg: number | null
      pcs_per_bar: number | null
      line: { qty: number } | { qty: number }[] | null
    }
    return ((data as Row[] | null) ?? []).map((r) => {
      const line = Array.isArray(r.line) ? r.line[0] : r.line
      return {
        production_order_id: r.production_order_id,
        material_id: r.material_id,
        qty_per_unit: Number(r.qty_per_unit) || 0,
        dm_kg: r.dm_kg == null ? null : Number(r.dm_kg),
        pcs_per_bar: r.pcs_per_bar == null ? null : Number(r.pcs_per_bar),
        order_qty: Number(line?.qty) || 0,
      }
    })
  },

  /** Số dòng chi tiết theo LSX — cờ "Chưa nhập bảng chi tiết" ở bảng điều phối. */
  async countsByLsx(): Promise<Map<string, number>> {
    const { data } = await db()
      .from('production_order_components')
      .select('production_order_id')
      .limit(20000)
    const map = new Map<string, number>()
    for (const r of (data ?? []) as { production_order_id: string }[]) {
      map.set(r.production_order_id, (map.get(r.production_order_id) ?? 0) + 1)
    }
    return map
  },
}
