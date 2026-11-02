import { db } from '@/server/db'
import type { Json } from '@/lib/database.types'
import type { MocSoat } from '@/lib/lenh-doi'
import { docAnh, type BanGhiNhatKy } from '@/lib/nhat-ky-dinh-muc'
import { poOwner } from '@/lib/supply-scope'
import { SUPPLY_DEPT_NAMES } from './suppliers.service'

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

  /**
   * NHẬT KÝ DÒNG ĐỊNH MỨC (0284) của các SP, ghi SAU một mốc — mọi lần thêm /
   * sửa / xoá, cũ → mới. Gộp thành thay đổi ròng ở `lib/nhat-ky-dinh-muc`.
   */
  async nhatKyDinhMuc(
    productIds: string[],
    tu: string,
  ): Promise<{ rows: BanGhiNhatKy[]; names: Map<string, string> }> {
    if (productIds.length === 0) return { rows: [], names: new Map() }
    const rows: BanGhiNhatKy[] = []
    for (let from = 0; ; from += TRANG) {
      const { data, error } = await db()
        .from('technical_product_part_changes')
        .select('product_id, part_id, action, before, after, changed_by, changed_at')
        .in('product_id', productIds)
        .gt('changed_at', tu)
        .order('changed_at')
        .order('id')
        .range(from, from + TRANG - 1)
      if (error) throw new Error(error.message)
      for (const r of data ?? [])
        rows.push({
          product_id: r.product_id,
          part_id: r.part_id,
          action: r.action as BanGhiNhatKy['action'],
          before: docAnh(r.before),
          after: docAnh(r.after),
          changed_by: r.changed_by,
          changed_at: r.changed_at,
        })
      if ((data ?? []).length < TRANG) break
    }
    return { rows, names: await tenNguoi(rows.map((r) => r.changed_by)) }
  },

  /**
   * "Phiên bản" của bảng mốc soát: số dòng + lần soát mới nhất. Một truy vấn
   * nhẹ — bộ nhớ tạm của số đếm so cái này để biết vừa có ai soát / xoá mốc,
   * kể cả khi việc đó chạy ở một tiến trình máy chủ khác.
   */
  async phienBan(): Promise<string> {
    const { data, count, error } = await db()
      .from('supply_lsx_reviews')
      .select('reviewed_at', { count: 'exact' })
      .order('reviewed_at', { ascending: false })
      .limit(1)
    if (error) throw new Error(error.message)
    return `${count ?? 0}|${data?.[0]?.reviewed_at ?? ''}`
  },

  /** Lệnh ĐANG CHẠY (đã duyệt / đang sản xuất) có SP này — cùng tập `listActive`. */
  async lenhDangChayCuaSp(productId: string): Promise<string[]> {
    const { data: dong, error } = await db()
      .from('production_order_lines')
      .select('production_order_id')
      .eq('product_id', productId)
    if (error) throw new Error(error.message)
    const ids = [...new Set((dong ?? []).map((d) => d.production_order_id))]
    if (ids.length === 0) return []
    const { data: lenh, error: e2 } = await db()
      .from('production_orders')
      .select('id')
      .in('id', ids)
      .in('status', ['approved', 'in_progress'])
    if (e2) throw new Error(e2.message)
    return (lenh ?? []).map((l) => l.id)
  },

  /**
   * Người nhận tin chờ soát: trưởng các phòng Cung ứng (`head_user_id`) + người
   * đang cầm các đơn mua chưa huỷ của từng lệnh (`poOwner`, kể cả đơn mua chung
   * qua bảng lệnh phụ) + tập người còn làm (đang hoạt động, chưa xoá).
   */
  async nguoiNhan(lsxIds: string[]): Promise<{
    truongPhong: string[]
    phuTrach: Map<string, string[]>
    dangLam: Set<string>
  }> {
    const [
      { data: phong, error: e1 },
      { data: chinh, error: e2 },
      { data: phu, error: e3 },
    ] = await Promise.all([
      db()
        .from('departments')
        .select('head_user_id')
        .in('name', [...SUPPLY_DEPT_NAMES]),
      db()
        .from('supply_purchase_orders')
        .select('id, production_order_id, assigned_to, created_by, status')
        .in('production_order_id', lsxIds)
        .neq('status', 'cancelled'),
      db()
        .from('supply_po_extra_lsx')
        .select('po_id, production_order_id')
        .in('production_order_id', lsxIds),
    ])
    if (e1 || e2 || e3) throw new Error((e1 ?? e2 ?? e3)!.message)
    const extraIds = [...new Set((phu ?? []).map((x) => x.po_id))]
    const { data: donPhu, error: e4 } = extraIds.length
      ? await db()
          .from('supply_purchase_orders')
          .select('id, assigned_to, created_by, status')
          .in('id', extraIds)
          .neq('status', 'cancelled')
      : { data: [], error: null }
    if (e4) throw new Error(e4.message)
    const phuTrach = new Map<string, string[]>()
    const them = (lsx: string, ai: string | null) => {
      if (!ai) return
      const ds = phuTrach.get(lsx) ?? []
      if (!ds.includes(ai)) ds.push(ai)
      phuTrach.set(lsx, ds)
    }
    for (const d of chinh ?? []) them(d.production_order_id!, poOwner(d))
    const donPhuById = new Map((donPhu ?? []).map((d) => [d.id, d]))
    for (const x of phu ?? []) {
      const d = donPhuById.get(x.po_id)
      if (d) them(x.production_order_id, poOwner(d))
    }
    const truongPhong = (phong ?? []).map((p) => p.head_user_id).filter((x): x is string => !!x) // prettier-ignore
    const ung = [...new Set([...truongPhong, ...[...phuTrach.values()].flat()])]
    const { data: con, error: e5 } = ung.length
      ? await db()
          .from('users')
          .select('id')
          .in('id', ung)
          .eq('is_active', true)
          .is('deleted_at', null)
      : { data: [], error: null }
    if (e5) throw new Error(e5.message)
    return { truongPhong, phuTrach, dangLam: new Set((con ?? []).map((u) => u.id)) }
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
