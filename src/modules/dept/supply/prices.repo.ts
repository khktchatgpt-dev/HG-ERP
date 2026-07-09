import { db } from '@/server/db'

/**
 * Bảng giá chào NCC (G-1, FR-SUP-06) — supply_supplier_prices (0034).
 * Đổi giá = thêm bản ghi mới (valid_from), không xoá lịch sử.
 */

export type SupplierPrice = {
  id: string
  supplier_id: string
  material_id: string
  price: number
  currency: string
  valid_from: string
  note: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type SupplierPriceWithRefs = SupplierPrice & {
  supplier_name: string
  supplier_active: boolean
  material_code: string
  material_name: string
  material_unit: string
}

/** Giá mua gần nhất từ PO thật (lịch sử — không phải giá chào). */
export type LastPurchase = {
  material_id: string
  unit_price: number
  currency: string
  po_code: string
  supplier_name: string
  at: string
}

const COLS =
  'id, supplier_id, material_id, price, currency, valid_from, note, created_by, created_at, updated_at'
const COLS_REFS = `${COLS}, supplier:supply_suppliers(name, is_active), material:warehouse_materials(code, name, unit)`

type Raw = SupplierPrice & {
  supplier:
    { name: string; is_active: boolean } | { name: string; is_active: boolean }[] | null
  material:
    | { code: string; name: string; unit: string }
    | { code: string; name: string; unit: string }[]
    | null
}

function unwrap(rows: Raw[] | null): SupplierPriceWithRefs[] {
  return (rows ?? []).map((r) => {
    const s = Array.isArray(r.supplier) ? r.supplier[0] : r.supplier
    const m = Array.isArray(r.material) ? r.material[0] : r.material
    return {
      ...r,
      price: Number(r.price),
      supplier_name: s?.name ?? '?',
      supplier_active: s?.is_active ?? false,
      material_code: m?.code ?? '?',
      material_name: m?.name ?? '?',
      material_unit: m?.unit ?? '',
    }
  })
}

export const pricesRepo = {
  async list(filter: {
    supplier_id?: string
    material_id?: string
  }): Promise<SupplierPriceWithRefs[]> {
    let q = db()
      .from('supply_supplier_prices')
      .select(COLS_REFS)
      .order('material_id')
      .order('valid_from', { ascending: false })
      .limit(1000)
    if (filter.supplier_id) q = q.eq('supplier_id', filter.supplier_id)
    if (filter.material_id) q = q.eq('material_id', filter.material_id)
    const { data } = await q
    return unwrap(data as Raw[] | null)
  },

  async findById(id: string): Promise<SupplierPrice | null> {
    const { data } = await db()
      .from('supply_supplier_prices')
      .select(COLS)
      .eq('id', id)
      .maybeSingle()
    return (data as SupplierPrice | null) ?? null
  },

  async insert(
    row: Omit<SupplierPrice, 'id' | 'created_at' | 'updated_at'>,
  ): Promise<{ price: SupplierPrice | null; duplicate: boolean }> {
    const { data, error } = await db()
      .from('supply_supplier_prices')
      .insert(row)
      .select(COLS)
      .single()
    if (error) {
      if (error.code === '23505') return { price: null, duplicate: true }
      throw new Error(error.message)
    }
    return { price: data as SupplierPrice, duplicate: false }
  },

  async patch(
    id: string,
    patch: Partial<Pick<SupplierPrice, 'price' | 'currency' | 'valid_from' | 'note'>>,
  ): Promise<SupplierPrice> {
    const { data, error } = await db()
      .from('supply_supplier_prices')
      .update(patch)
      .eq('id', id)
      .select(COLS)
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Update price failed')
    return data as SupplierPrice
  },

  async remove(id: string): Promise<void> {
    const { error } = await db().from('supply_supplier_prices').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },

  /** Mọi bản ghi giá đã hiệu lực (valid_from ≤ onDate) — service chọn "hiện hành". */
  async listEffective(
    materialIds: string[],
    onDate: string,
  ): Promise<SupplierPriceWithRefs[]> {
    if (materialIds.length === 0) return []
    const { data } = await db()
      .from('supply_supplier_prices')
      .select(COLS_REFS)
      .in('material_id', materialIds)
      .lte('valid_from', onDate)
      .limit(2000)
    return unwrap(data as Raw[] | null)
  },

  /** Giá mua gần nhất per vật tư từ PO (bỏ PO huỷ / dòng không giá). */
  async lastPurchases(materialIds: string[]): Promise<LastPurchase[]> {
    if (materialIds.length === 0) return []
    const { data } = await db()
      .from('supply_purchase_order_lines')
      .select(
        'material_id, unit_price, po:supply_purchase_orders!inner(code, currency, status, created_at, supplier:supply_suppliers(name))',
      )
      .in('material_id', materialIds)
      .not('unit_price', 'is', null)
      .limit(1000)
    type RawLine = {
      material_id: string
      unit_price: number
      po: {
        code: string
        currency: string
        status: string
        created_at: string
        supplier: { name: string } | { name: string }[] | null
      }
    }
    const best = new Map<string, LastPurchase>()
    for (const r of (data ?? []) as unknown as RawLine[]) {
      if (!r.po || r.po.status === 'cancelled') continue
      const cur = best.get(r.material_id)
      if (cur && cur.at >= r.po.created_at) continue
      const s = Array.isArray(r.po.supplier) ? r.po.supplier[0] : r.po.supplier
      best.set(r.material_id, {
        material_id: r.material_id,
        unit_price: Number(r.unit_price),
        currency: r.po.currency,
        po_code: r.po.code,
        supplier_name: s?.name ?? '?',
        at: r.po.created_at,
      })
    }
    return [...best.values()]
  },
}
