import { db } from '@/server/db'

/**
 * NHU CẦU THEO ĐỊNH MỨC, TÁCH THEO SẢN PHẨM và kèm trạng thái XÁC NHẬN BOM
 * (user chốt 05/09/2026: "chỉ định mức BOM đã xác nhận mới được dùng, tránh sai
 * sót").
 *
 * Vì sao không dùng `v_lsx_material_status` như trước: view đó gộp sẵn theo vật
 * tư nên mất dấu "số này đến từ SP nào", mà xác nhận BOM lại là thuộc tính của
 * SP. Không tách được thì không lọc được, và cũng không nói được cho người mua
 * biết mã nào đang dựa trên bản nháp.
 *
 * "Đã xác nhận" = hồ sơ SP có `bom_checked_at` (Kỹ thuật đánh dấu BOM đã qua
 * kiểm tra, 0140) HOẶC `locked_at` (hồ sơ đã khoá — khoá thì đương nhiên chốt).
 * KHÔNG dùng `bom_status` ('done'): đó là nhãn tiến độ vẽ, ai sửa cũng được.
 *
 * Đọc từ `production_order_lines` chứ không từ đơn hàng: một lệnh gộp nhiều đơn
 * (0113) và số lượng phải làm nằm trên dòng LỆNH.
 */
export type BomNeedLine = {
  product_id: string
  product_code: string
  product_name: string
  /** SL sản phẩm phải làm của lệnh (cộng dồn nếu SP có ở nhiều dòng lệnh). */
  product_qty: number
  bom_confirmed: boolean
  material_id: string
  material_code: string
  material_name: string
  unit: string
  group_name: string | null
  /** Định mức trên 1 sản phẩm. */
  qty_per_unit: number
  /** = qty_per_unit × product_qty. */
  qty_needed: number
}

export type LsxBomNeeds = {
  lines: BomNeedLine[]
  /** SP của lệnh, để nói rõ ai chưa chốt định mức. */
  products: {
    id: string
    code: string
    name: string
    qty: number
    bom_confirmed: boolean
    /** Số dòng định mức có mã vật tư — 0 = chưa có định mức dùng được. */
    coded_parts: number
  }[]
}

export async function lsxBomNeeds(productionOrderId: string): Promise<LsxBomNeeds> {
  const { data: lineRows } = await db()
    .from('production_order_lines')
    .select('product_id, product_code, name_vi, qty')
    .eq('production_order_id', productionOrderId)
    .limit(2000)
  type PL = {
    product_id: string | null
    product_code: string | null
    name_vi: string | null
    qty: unknown
  }
  const qtyByProduct = new Map<string, { code: string; name: string; qty: number }>()
  for (const l of (lineRows ?? []) as PL[]) {
    if (!l.product_id) continue
    const cur = qtyByProduct.get(l.product_id)
    const qty = Number(l.qty) || 0
    if (cur) cur.qty += qty
    else
      qtyByProduct.set(l.product_id, {
        code: l.product_code ?? '',
        name: l.name_vi ?? '',
        qty,
      })
  }
  const productIds = [...qtyByProduct.keys()]
  if (productIds.length === 0) return { lines: [], products: [] }

  const [{ data: prodRows }, { data: partRows }] = await Promise.all([
    db()
      .from('technical_products')
      .select('id, code, name, bom_checked_at, locked_at')
      .in('id', productIds),
    db()
      .from('technical_product_parts')
      .select('product_id, material_code, qty')
      .in('product_id', productIds)
      .not('material_code', 'is', null)
      .limit(20000),
  ])
  type P = {
    id: string
    code: string | null
    name: string | null
    bom_checked_at: string | null
    locked_at: string | null
  }
  const confirmedById = new Map<string, boolean>()
  const infoById = new Map<string, { code: string; name: string }>()
  for (const p of (prodRows ?? []) as P[]) {
    confirmedById.set(p.id, p.bom_checked_at != null || p.locked_at != null)
    infoById.set(p.id, { code: p.code ?? '', name: p.name ?? '' })
  }

  type Part = { product_id: string; material_code: string; qty: unknown }
  const parts = (partRows ?? []) as Part[]
  // Định mức nối vật tư bằng MÃ TEXT (xem 0096) — tra một lượt, chuẩn hoá hoa/thường.
  const codes = [...new Set(parts.map((p) => p.material_code.trim()).filter(Boolean))]
  const matByCode = new Map<
    string,
    { id: string; code: string; name: string; unit: string; group_name: string | null }
  >()
  if (codes.length > 0) {
    const { data: mats } = await db()
      .from('warehouse_materials')
      .select('id, code, name, unit, group_name')
      .in('code', codes.slice(0, 2000))
    for (const m of (mats ?? []) as {
      id: string
      code: string
      name: string
      unit: string
      group_name: string | null
    }[]) {
      matByCode.set(m.code.trim().toUpperCase(), m)
    }
  }

  // Cộng dồn định mức cùng (SP, vật tư): hồ sơ hay tách nhiều dòng chi tiết
  // dùng chung một mã.
  const acc = new Map<string, BomNeedLine>()
  const codedByProduct = new Map<string, number>()
  for (const part of parts) {
    const mat = matByCode.get(part.material_code.trim().toUpperCase())
    if (!mat) continue
    const prod = qtyByProduct.get(part.product_id)
    if (!prod) continue
    codedByProduct.set(part.product_id, (codedByProduct.get(part.product_id) ?? 0) + 1)
    const per = Number(part.qty) || 0
    if (per <= 0) continue
    const key = `${part.product_id}|${mat.id}`
    const cur = acc.get(key)
    if (cur) {
      cur.qty_per_unit += per
      cur.qty_needed = cur.qty_per_unit * prod.qty
      continue
    }
    const info = infoById.get(part.product_id)
    acc.set(key, {
      product_id: part.product_id,
      product_code: info?.code || prod.code,
      product_name: info?.name || prod.name,
      product_qty: prod.qty,
      bom_confirmed: confirmedById.get(part.product_id) ?? false,
      material_id: mat.id,
      material_code: mat.code,
      material_name: mat.name,
      unit: mat.unit,
      group_name: mat.group_name,
      qty_per_unit: per,
      qty_needed: per * prod.qty,
    })
  }

  return {
    lines: [...acc.values()],
    products: productIds.map((id) => {
      const p = qtyByProduct.get(id)!
      const info = infoById.get(id)
      return {
        id,
        code: info?.code || p.code,
        name: info?.name || p.name,
        qty: p.qty,
        bom_confirmed: confirmedById.get(id) ?? false,
        coded_parts: codedByProduct.get(id) ?? 0,
      }
    }),
  }
}
