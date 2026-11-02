import { db } from '@/server/db'
import type { Json } from '@/lib/database.types'
import type { MocSoat } from '@/lib/lenh-doi'

/**
 * LỆNH ĐỔI — CHỜ SOÁT — data access (0282 + định mức sống + dòng lệnh).
 * Thuần truy vấn; so sánh ở `lib/lenh-doi`, quyền ở service.
 */

export type MocSoatRow = {
  id: string
  production_order_id: string
  reviewed_by: string | null
  reviewed_by_name: string | null
  reviewed_at: string
  changes: number
  note: string | null
  snapshot: MocSoat
}

/** Một dòng định mức sống — đủ để tính số gốc và biết ai sửa lúc nào. */
export type DongDinhMucSong = {
  product_id: string
  material_code: string | null
  qty: number
  updated_at: string
  updated_by: string | null
}

const TRANG = 1000

async function tenNguoi(ids: (string | null)[]): Promise<Map<string, string>> {
  const uniq = [...new Set(ids.filter((x): x is string => !!x))]
  if (uniq.length === 0) return new Map()
  const { data, error } = await db()
    .from('users')
    .select('id, name, email')
    .in('id', uniq)
  if (error) throw new Error(error.message)
  return new Map((data ?? []).map((u) => [u.id, u.name || u.email]))
}

export const lenhDoiRepo = {
  /** Mọi lần soát của lệnh, mới nhất trước — phần tử đầu là mốc đang dùng. */
  async listByLsx(lsxId: string): Promise<MocSoatRow[]> {
    const { data, error } = await db()
      .from('supply_lsx_reviews')
      .select(
        'id, production_order_id, reviewed_by, reviewed_at, changes, note, snapshot',
      )
      .eq('production_order_id', lsxId)
      .order('reviewed_at', { ascending: false })
    if (error) throw new Error(error.message)
    const names = await tenNguoi((data ?? []).map((r) => r.reviewed_by))
    return (data ?? []).map((r) => ({
      ...r,
      reviewed_by_name: r.reviewed_by ? (names.get(r.reviewed_by) ?? null) : null,
      snapshot: r.snapshot as unknown as MocSoat,
    }))
  },

  async insert(row: {
    production_order_id: string
    reviewed_by: string
    changes: number
    note: string | null
    snapshot: MocSoat
  }): Promise<{ id: string; reviewed_at: string }> {
    const { data, error } = await db()
      .from('supply_lsx_reviews')
      .insert({ ...row, snapshot: row.snapshot as unknown as Json })
      .select('id, reviewed_at')
      .single()
    if (error) throw new Error(error.message)
    return data
  },

  /** Định mức sống của các SP (mọi dòng, kể cả chưa gắn mã) + người sửa cuối. */
  async dinhMucSong(
    productIds: string[],
  ): Promise<{ rows: DongDinhMucSong[]; names: Map<string, string> }> {
    if (productIds.length === 0) return { rows: [], names: new Map() }
    const rows: DongDinhMucSong[] = []
    for (let from = 0; ; from += TRANG) {
      const { data, error } = await db()
        .from('technical_product_parts')
        .select('product_id, material_code, qty, updated_at, updated_by')
        .in('product_id', productIds)
        .order('id')
        .range(from, from + TRANG - 1)
      if (error) throw new Error(error.message)
      for (const r of data ?? [])
        rows.push({ ...r, qty: Number(r.qty ?? 0), material_code: r.material_code?.trim() || null }) // prettier-ignore
      if ((data ?? []).length < TRANG) break
    }
    return { rows, names: await tenNguoi(rows.map((r) => r.updated_by)) }
  },

  /** Số dòng lệnh sửa sau một mốc (SL, SP, quy cách… trên phiếu lệnh). */
  async dongLenhSuaSau(lsxId: string, tu: string): Promise<number> {
    const { count, error } = await db()
      .from('production_order_lines')
      .select('id', { count: 'exact', head: true })
      .eq('production_order_id', lsxId)
      .gt('updated_at', tu)
    if (error) throw new Error(error.message)
    return count ?? 0
  },
}
