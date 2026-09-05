import { db } from '@/server/db'
import { convertPartNeed } from '@/lib/bom-unit'

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
  /** Định mức trên 1 sản phẩm, ĐÃ QUY ĐỔI sang đơn vị mua của vật tư. */
  qty_per_unit: number
  /** = qty_per_unit × product_qty. */
  qty_needed: number
  /** Cách ra con số (đếm / mét ÷ cây / kg…) — để người mua kiểm lại được. */
  basis: string
  /** Một câu giải thích phép quy đổi của dòng. */
  explain: string
  /** Số dòng chi tiết của SP cùng dùng mã này. */
  part_count: number
}

/** Dòng định mức KHÔNG quy đổi được sang đơn vị mua — phải nói ra, không lặng lẽ bỏ. */
export type BomNeedBlocked = {
  product_id: string
  product_code: string
  material_id: string
  material_code: string
  material_name: string
  /** Đơn vị mua của vật tư. */
  unit: string
  part_name: string
  reason: string
}

export type LsxBomNeeds = {
  lines: BomNeedLine[]
  /** Dòng chưa quy đổi được đơn vị — bảng kê hiện riêng để đi bổ sung dữ liệu. */
  blocked: BomNeedBlocked[]
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
  if (productIds.length === 0) return { lines: [], blocked: [], products: [] }

  const [{ data: prodRows }, { data: partRows }] = await Promise.all([
    db()
      .from('technical_products')
      .select('id, code, name, bom_checked_at, locked_at')
      .in('id', productIds),
    db()
      .from('technical_product_parts')
      .select(
        'product_id, material_code, part_name, qty, unit, total_length_m, weight_kg, paint_area_m2, volume_m3, bar_length_m, waste_pct',
      )
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

  type Part = {
    product_id: string
    material_code: string
    part_name: string | null
    qty: unknown
    unit: string | null
    total_length_m: unknown
    weight_kg: unknown
    paint_area_m2: unknown
    volume_m3: unknown
    bar_length_m: unknown
    waste_pct: unknown
  }
  const parts = (partRows ?? []) as Part[]
  // Định mức nối vật tư bằng MÃ TEXT (xem 0096) — tra một lượt, chuẩn hoá hoa/thường.
  const codes = [...new Set(parts.map((p) => p.material_code.trim()).filter(Boolean))]
  const matByCode = new Map<
    string,
    {
      id: string
      code: string
      name: string
      unit: string
      group_name: string | null
      default_bar_length_m: number | null
    }
  >()
  if (codes.length > 0) {
    const { data: mats } = await db()
      .from('warehouse_materials')
      .select('id, code, name, unit, group_name, default_bar_length_m')
      .in('code', codes.slice(0, 2000))
    for (const m of (mats ?? []) as {
      id: string
      code: string
      name: string
      unit: string
      group_name: string | null
      default_bar_length_m: number | null
    }[]) {
      matByCode.set(m.code.trim().toUpperCase(), m)
    }
  }

  // Cộng dồn định mức cùng (SP, vật tư): hồ sơ hay tách nhiều dòng chi tiết
  // dùng chung một mã.
  const acc = new Map<string, BomNeedLine>()
  const blocked: BomNeedBlocked[] = []
  const codedByProduct = new Map<string, number>()
  const num = (v: unknown) => (v == null ? null : Number(v))
  // Số lẻ nhị phân (287.80800000000005) làm bảng kê và file Excel trông như số
  // rác — chốt 4 chữ số thập phân, thừa đủ cho mọi đơn vị mua.
  const r4 = (n: number) => Math.round(n * 10_000) / 10_000
  for (const part of parts) {
    const mat = matByCode.get(part.material_code.trim().toUpperCase())
    if (!mat) continue
    const prod = qtyByProduct.get(part.product_id)
    if (!prod) continue
    codedByProduct.set(part.product_id, (codedByProduct.get(part.product_id) ?? 0) + 1)
    const info = infoById.get(part.product_id)
    // QUY ĐỔI sang đơn vị MUA. Định mức đếm chi tiết ("2 thanh"), vật tư bán
    // theo cây/kg/tấm — lấy thẳng số chi tiết là sai số lượng (xem lib/bom-unit).
    const conv = convertPartNeed(
      {
        qty: num(part.qty),
        unit: part.unit,
        total_length_m: num(part.total_length_m),
        weight_kg: num(part.weight_kg),
        paint_area_m2: num(part.paint_area_m2),
        volume_m3: num(part.volume_m3),
        bar_length_m: num(part.bar_length_m),
        waste_pct: num(part.waste_pct),
      },
      { unit: mat.unit, default_bar_length_m: mat.default_bar_length_m },
    )
    if (!conv.ok) {
      blocked.push({
        product_id: part.product_id,
        product_code: info?.code || prod.code,
        material_id: mat.id,
        material_code: mat.code,
        material_name: mat.name,
        unit: mat.unit,
        part_name: part.part_name ?? '',
        reason: conv.reason,
      })
      continue
    }
    const per = conv.qty_per_unit
    if (per <= 0) continue
    const key = `${part.product_id}|${mat.id}`
    const cur = acc.get(key)
    if (cur) {
      // Cùng SP dùng mã này ở NHIỀU chi tiết (viền dài, viền ngắn, giằng…):
      // cộng dồn, và đổi lời giải thích cho khớp — giữ câu của chi tiết đầu
      // tiên thì con số tổng không ra được từ câu đó, người đọc tưởng sai.
      cur.qty_per_unit = r4(cur.qty_per_unit + per)
      cur.qty_needed = r4(cur.qty_per_unit * prod.qty)
      cur.part_count += 1
      cur.explain = `gộp ${cur.part_count} chi tiết = ${cur.qty_per_unit.toLocaleString('vi-VN', { maximumFractionDigits: 3 })} ${mat.unit}/SP`
      continue
    }
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
      qty_needed: r4(per * prod.qty),
      basis: conv.basis,
      explain: conv.explain,
      part_count: 1,
    })
  }

  return {
    lines: [...acc.values()],
    blocked,
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
