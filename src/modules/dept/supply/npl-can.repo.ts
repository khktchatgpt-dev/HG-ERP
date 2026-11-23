import { db } from '@/server/db'
import {
  KIND_THEO_DINH_MUC,
  type CanDongLenh,
  type CanMat,
  type CanPart,
  type CanSp,
} from '@/lib/npl-con-phai-dat'
import { hetTrang, lo, type Row } from './npl-theo-lenh.repo'

/**
 * SỐ CẦN THEO ĐỊNH MỨC cho tab "Còn phải đặt" (màn NPL theo lệnh) — thuần truy
 * vấn, gom một lượt cho mọi lệnh đang chạy (không gọi `lsxBomNeeds` từng lệnh:
 * 17 lệnh × 4 truy vấn). Tính số ở `lib/npl-con-phai-dat`.
 */
export type NplCanRaw = {
  dongLenh: CanDongLenh[]
  sps: CanSp[]
  parts: CanPart[]
  mats: CanMat[]
  /** SP có ít nhất một dòng định mức (mọi loại) — để nói vì sao lệnh không so được. */
  spCoDinhMuc: Set<string>
}

const num = (v: unknown) => (v == null ? null : Number(v))

export async function nplCanRaw(lenhIds: string[]): Promise<NplCanRaw> {
  const dongLenh: CanDongLenh[] = []
  for (const part of lo(lenhIds)) {
    const rows = await hetTrang((from, to) =>
      db()
        .from('production_order_lines')
        .select('production_order_id, product_id, qty')
        .in('production_order_id', part)
        .not('product_id', 'is', null)
        .range(from, to),
    )
    for (const r of rows)
      dongLenh.push({
        lsx_id: String(r.production_order_id),
        product_id: String(r.product_id),
        qty: Number(r.qty) || 0,
      })
  }
  const spIds = [...new Set(dongLenh.map((d) => d.product_id))]

  const sps: CanSp[] = []
  const parts: CanPart[] = []
  const spCoDinhMuc = new Set<string>()
  await Promise.all(
    lo(spIds).map(async (part) => {
      const [{ data: spRows, error: e1 }, partRows, coRows] = await Promise.all([
        db()
          .from('technical_products')
          .select('id, code, bom_checked_at, locked_at')
          .in('id', part),
        hetTrang((from, to) =>
          db()
            .from('technical_product_parts')
            .select(
              'product_id, material_code, part_name, group_code, qty, unit, total_length_m, weight_kg, paint_area_m2, volume_m3, bar_length_m, waste_pct',
            )
            .in('product_id', part)
            .in('group_code', [...KIND_THEO_DINH_MUC])
            .range(from, to),
        ),
        hetTrang((from, to) =>
          db()
            .from('technical_product_parts')
            .select('product_id')
            .in('product_id', part)
            .range(from, to),
        ),
      ])
      if (e1) throw new Error(e1.message)
      for (const r of (spRows ?? []) as Row[])
        sps.push({
          id: String(r.id),
          code: String(r.code ?? ''),
          xac_nhan: r.bom_checked_at != null || r.locked_at != null,
        })
      for (const r of partRows)
        parts.push({
          product_id: String(r.product_id),
          material_code: (r.material_code as string) ?? null,
          part_name: (r.part_name as string) ?? null,
          group_code: (r.group_code as string) ?? null,
          qty: num(r.qty),
          unit: (r.unit as string) ?? null,
          total_length_m: num(r.total_length_m),
          weight_kg: num(r.weight_kg),
          paint_area_m2: num(r.paint_area_m2),
          volume_m3: num(r.volume_m3),
          bar_length_m: num(r.bar_length_m),
          waste_pct: num(r.waste_pct),
        })
      for (const r of coRows) spCoDinhMuc.add(String(r.product_id))
    }),
  )

  // Định mức nối vật tư bằng MÃ TEXT (0096) — tra một lượt.
  const codes = [
    ...new Set(parts.map((p) => p.material_code?.trim()).filter((c): c is string => !!c)),
  ]
  const mats: CanMat[] = []
  for (const part of lo(codes)) {
    const { data, error } = await db()
      .from('warehouse_materials')
      .select('id, code, name, unit, group_name, default_bar_length_m')
      .in('code', part)
    if (error) throw new Error(error.message)
    for (const r of (data ?? []) as Row[])
      mats.push({
        id: String(r.id),
        code: String(r.code),
        name: String(r.name ?? ''),
        unit: String(r.unit ?? ''),
        group_name: (r.group_name as string) ?? null,
        default_bar_length_m: num(r.default_bar_length_m),
      })
  }
  return { dongLenh, sps, parts, mats, spCoDinhMuc }
}
