import { db } from '@/server/db'

/**
 * KẾ HOẠCH MUA — data access (0275 + lịch sử dòng đơn để gợi ý NCC).
 * Thuần truy vấn; tính gợi ý ở `lib/goi-y-ncc`, quyền ở service.
 */

/** Trạng thái đơn coi là GIÁ ĐÃ CHỐT — từ Đã duyệt trở đi (nháp/chờ duyệt chưa phải giá). */
export const TRANG_THAI_GIA_CHOT = [
  'approved',
  'ordered',
  'confirmed',
  'in_transit',
  'partial',
  'received',
] as const

export type DongDonThuan = {
  material_id: string
  qty_ordered: number
  unit_price: number | null
  price_basis: string | null
  qty2: number | null
  unit2: string | null
  spec: string | null
  finish: string | null
  po_code: string
  supplier_id: string
  template: string
  at: string
  mat_name: string
  /** ĐVT của SL trên dòng đơn: ĐVT riêng của dòng, không có thì ĐVT danh mục. */
  dv: string
  sub_group: string | null
  group_name: string | null
}

export type ChonNccRow = {
  material_id: string
  supplier_id: string
  price: number | null
  price_basis: 'unit' | 'kg'
  note: string | null
  updated_at: string
  updated_by: string | null
}

type One<T> = T | T[] | null
const first = <T>(v: One<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v)

export const keHoachMuaRepo = {
  /**
   * Mọi dòng đơn có mã vật tư, đơn từ Đã duyệt trở đi. Cả phòng ~700 dòng (đo
   * 22/10) — đọc hết theo trang để gợi ý theo mã, theo quy cách và theo nhóm
   * từ CÙNG một lần đọc. PostgREST trần 1.000 dòng/lượt → phải `.range()`.
   */
  async dongDonGiaChot(): Promise<DongDonThuan[]> {
    const out: DongDonThuan[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db()
        .from('supply_purchase_order_lines')
        .select(
          'material_id, qty_ordered, unit_price, price_basis, qty2, unit2, spec, finish, line_unit, po:supply_purchase_orders!inner(code, status, ordered_at, created_at, supplier_id, template), mat:warehouse_materials!inner(name, unit, sub_group, group_name)',
        )
        .not('material_id', 'is', null)
        .in('po.status', [...TRANG_THAI_GIA_CHOT])
        .order('id')
        .range(from, from + 999)
      if (error) throw new Error(error.message)
      for (const r of (data ?? []) as Record<string, unknown>[]) {
        const po = first(r.po as One<Record<string, unknown>>)
        const mat = first(r.mat as One<Record<string, unknown>>)
        if (!po || !mat) continue
        out.push({
          material_id: String(r.material_id),
          qty_ordered: Number(r.qty_ordered) || 0,
          unit_price: r.unit_price == null ? null : Number(r.unit_price),
          price_basis: (r.price_basis as string) ?? null,
          qty2: r.qty2 == null ? null : Number(r.qty2),
          unit2: (r.unit2 as string) ?? null,
          spec: (r.spec as string) ?? null,
          finish: (r.finish as string) ?? null,
          po_code: String(po.code),
          supplier_id: String(po.supplier_id),
          template: String(po.template ?? ''),
          at: String(po.ordered_at ?? po.created_at).slice(0, 10),
          mat_name: String(mat.name),
          dv: String((r.line_unit as string) || mat.unit || ''),
          sub_group: (mat.sub_group as string) ?? null,
          group_name: (mat.group_name as string) ?? null,
        })
      }
      if ((data ?? []).length < 1000) break
    }
    return out
  },

  /** Tên NCC (đang hoạt động hay không — lịch sử cần cả NCC đã ngừng). */
  async tenNcc(): Promise<
    { id: string; code: string | null; name: string; can_order: boolean }[]
  > {
    const { data, error } = await db()
      .from('supply_suppliers')
      .select('id, code, name, can_order')
      .order('name')
      .limit(2000)
    if (error) throw new Error(error.message)
    return (data ?? []).map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      can_order: s.can_order !== false,
    }))
  },

  /** Khối lượng một ĐVT mua: kg/đv khai sẵn, hoặc kg/m × dài cây. */
  async kgMoiDv(materialIds: string[]): Promise<Map<string, number | null>> {
    const out = new Map<string, number | null>()
    for (let i = 0; i < materialIds.length; i += 200) {
      const { data, error } = await db()
        .from('warehouse_materials')
        .select('id, kg_per_unit, kg_per_m, default_bar_length_m')
        .in('id', materialIds.slice(i, i + 200))
      if (error) throw new Error(error.message)
      for (const m of data ?? []) {
        const perUnit = m.kg_per_unit != null ? Number(m.kg_per_unit) : null
        const perM = m.kg_per_m != null ? Number(m.kg_per_m) : null
        const bar = m.default_bar_length_m != null ? Number(m.default_bar_length_m) : null
        out.set(m.id, perUnit && perUnit > 0 ? perUnit : perM && bar ? perM * bar : null)
      }
    }
    return out
  },

  async chonCuaLenh(lsxId: string): Promise<ChonNccRow[]> {
    const { data, error } = await db()
      .from('supply_lsx_sourcing')
      .select(
        'material_id, supplier_id, price, price_basis, note, updated_at, updated_by',
      )
      .eq('production_order_id', lsxId)
      .limit(2000)
    if (error) throw new Error(error.message)
    return (data ?? []).map((r) => ({
      material_id: r.material_id,
      supplier_id: r.supplier_id,
      price: r.price == null ? null : Number(r.price),
      price_basis: r.price_basis === 'kg' ? 'kg' : 'unit',
      note: r.note,
      updated_at: r.updated_at,
      updated_by: r.updated_by,
    }))
  },

  async upsertChon(
    lsxId: string,
    rows: {
      material_id: string
      supplier_id: string
      price: number | null
      price_basis: 'unit' | 'kg'
      note: string | null
    }[],
    userId: string,
  ): Promise<void> {
    if (rows.length === 0) return
    const { error } = await db()
      .from('supply_lsx_sourcing')
      .upsert(
        rows.map((r) => ({
          production_order_id: lsxId,
          ...r,
          created_by: userId,
          updated_by: userId,
        })),
        { onConflict: 'production_order_id,material_id', ignoreDuplicates: false },
      )
    if (error) throw new Error(error.message)
  },

  async xoaChon(lsxId: string, materialIds: string[]): Promise<void> {
    if (materialIds.length === 0) return
    const { error } = await db()
      .from('supply_lsx_sourcing')
      .delete()
      .eq('production_order_id', lsxId)
      .in('material_id', materialIds)
    if (error) throw new Error(error.message)
  },
}
