import { db } from '@/server/db'
import { productionRepo } from '@/modules/dept/production/production.repo'

export type BangKeLsxRow = {
  id: string
  code: string
  customer_name: string
  order_codes: string[]
  ship_date: string | null
  materials_due_at: string | null
  /** Số SP trên lệnh. */
  products: number
  /** Tổng dòng định mức của các SP. */
  bom_lines: number
  /** Dòng định mức đã gắn mã vật tư — chỉ dòng này mới thành số cần. */
  coded_lines: number
  /** SP được Kỹ thuật đánh dấu BOM đã kiểm (hoặc đã khoá). */
  confirmed_products: number
}

/**
 * DANH SÁCH LỆNH CHO TRANG BẢNG KÊ (08/10/2026) — trả lời "lệnh nào đã có định
 * mức gắn mã để tính được bảng kê". Cố ý KHÔNG gọi `loadLsxBangKe` cho từng
 * lệnh: hàm đó chạy ~10 truy vấn mỗi lệnh, 14 lệnh là hàng chục giây. Ba truy
 * vấn phẳng (lệnh → dòng SP → dòng định mức) là đủ để xếp lệnh nào mở được.
 */
export async function listLsxForBangKe(): Promise<BangKeLsxRow[]> {
  const lsxs = await productionRepo.listActive()
  if (lsxs.length === 0) return []
  const ids = lsxs.map((l) => l.id)
  const { data: lines, error: e1 } = await db()
    .from('production_order_lines')
    .select('production_order_id, product_id')
    .in('production_order_id', ids)
  if (e1) throw new Error(`production_order_lines: ${e1.message}`)
  type L = { production_order_id: string; product_id: string | null }
  const pidsByLsx = new Map<string, Set<string>>()
  for (const l of (lines ?? []) as L[]) {
    if (!l.product_id) continue
    const s = pidsByLsx.get(l.production_order_id) ?? new Set<string>()
    s.add(l.product_id)
    pidsByLsx.set(l.production_order_id, s)
  }
  const pids = [...new Set([...pidsByLsx.values()].flatMap((s) => [...s]))]
  type P = { product_id: string; material_code: string | null }
  type SP = { id: string; bom_checked_at: string | null; locked_at: string | null }
  const [{ data: parts, error: e2 }, { data: sps, error: e3 }] =
    pids.length > 0
      ? await Promise.all([
          db()
            .from('technical_product_parts')
            .select('product_id, material_code')
            .in('product_id', pids),
          db()
            .from('technical_products')
            .select('id, bom_checked_at, locked_at')
            .in('id', pids),
        ])
      : [
          { data: [] as P[], error: null },
          { data: [] as SP[], error: null },
        ]
  if (e2) throw new Error(`technical_product_parts: ${e2.message}`)
  if (e3) throw new Error(`technical_products: ${e3.message}`)
  const dem = new Map<string, { tong: number; coMa: number }>()
  for (const p of (parts ?? []) as P[]) {
    const c = dem.get(p.product_id) ?? { tong: 0, coMa: 0 }
    c.tong++
    if (p.material_code && p.material_code.trim()) c.coMa++
    dem.set(p.product_id, c)
  }
  const kiem = new Set(
    ((sps ?? []) as SP[]).filter((s) => s.bom_checked_at || s.locked_at).map((s) => s.id),
  )
  return lsxs.map((l) => {
    const ps = [...(pidsByLsx.get(l.id) ?? [])]
    let bom = 0
    let coded = 0
    for (const pid of ps) {
      const c = dem.get(pid)
      if (!c) continue
      bom += c.tong
      coded += c.coMa
    }
    return {
      id: l.id,
      code: l.code,
      customer_name: l.customer_name,
      order_codes: l.order_codes,
      ship_date: l.ship_date,
      materials_due_at: l.materials_due_at,
      products: ps.length,
      bom_lines: bom,
      coded_lines: coded,
      confirmed_products: ps.filter((pid) => kiem.has(pid)).length,
    }
  })
}
