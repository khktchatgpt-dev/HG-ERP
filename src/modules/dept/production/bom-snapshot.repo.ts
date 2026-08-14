import { db } from '@/server/db'

/**
 * ẢNH CHỤP ĐỊNH MỨC THEO LỆNH (0142).
 *
 * Nhu cầu vật tư của lệnh trước đây đọc `technical_product_parts` SỐNG, nên Kỹ
 * thuật sửa BOM hôm nay là lệnh phát tháng trước tính lại theo định mức mới.
 * Từ 0142, lúc PHÁT LỆNH ta chụp định mức một đơn vị SP vào
 * `production_order_boms`; view `v_lsx_material_status` đọc ảnh chụp trước, chỉ
 * rơi về định mức sống cho SP nào chưa có ảnh.
 *
 * Chụp là THÊM CHỨ KHÔNG ĐÈ: `ensureForOrder` chỉ điền cho SP còn thiếu ảnh.
 * Đã chốt rồi thì không tự chốt lại — muốn cập nhật theo BOM mới phải gọi
 * `resnapProducts` (chủ đích, có người bấm).
 */

export type BomSnapshotRow = {
  production_order_id: string
  product_id: string
  material_code: string
  qty_per_unit: number
  product_rev: number | null
  snapped_at: string
}

/** Định mức sống của một tập SP, đã gộp theo mã vật tư (đúng thứ view cần). */
async function livePartsByProduct(
  productIds: string[],
): Promise<Map<string, Map<string, number>>> {
  const out = new Map<string, Map<string, number>>()
  if (!productIds.length) return out
  const { data, error } = await db()
    .from('technical_product_parts')
    .select('product_id, material_code, qty')
    .in('product_id', productIds)
    .not('material_code', 'is', null)
  if (error) throw new Error(error.message)
  for (const r of data ?? []) {
    const code = (r.material_code ?? '').trim()
    if (!code) continue
    const byCode = out.get(r.product_id) ?? new Map<string, number>()
    byCode.set(code, (byCode.get(code) ?? 0) + Number(r.qty ?? 0))
    out.set(r.product_id, byCode)
  }
  return out
}

export const bomSnapshotRepo = {
  async listByOrder(orderId: string): Promise<BomSnapshotRow[]> {
    const { data, error } = await db()
      .from('production_order_boms')
      .select(
        'production_order_id, product_id, material_code, qty_per_unit, product_rev, snapped_at',
      )
      .eq('production_order_id', orderId)
    if (error) throw new Error(error.message)
    return (data ?? []) as BomSnapshotRow[]
  },

  /** Các SP của lệnh ĐÃ có ảnh chụp. */
  async snappedProductIds(orderId: string): Promise<Set<string>> {
    const { data, error } = await db()
      .from('production_order_boms')
      .select('product_id')
      .eq('production_order_id', orderId)
    if (error) throw new Error(error.message)
    return new Set((data ?? []).map((r) => r.product_id))
  },

  /**
   * Chụp bù định mức cho MỌI SP của lệnh chưa có ảnh. Trả số SP vừa chụp.
   *
   * Gọi lúc duyệt lệnh và mỗi lần lưu dòng của lệnh ĐÃ PHÁT — SP gộp thêm vào
   * sau (0113) hoặc dòng vừa được gán SP cũng phải đứng yên như phần còn lại.
   * SP không có dòng định mức nào thì không sinh dòng ảnh chụp: để nó tiếp tục
   * rơi về nhánh sống, sau này Kỹ thuật bóc tách xong là lệnh thấy ngay.
   */
  async ensureForOrder(orderId: string, userId: string | null): Promise<number> {
    const { data: lines, error } = await db()
      .from('production_order_lines')
      .select('product_id')
      .eq('production_order_id', orderId)
      .not('product_id', 'is', null)
    if (error) throw new Error(error.message)

    const wanted = [...new Set((lines ?? []).map((l) => l.product_id).filter(Boolean))]
    if (!wanted.length) return 0
    const already = await bomSnapshotRepo.snappedProductIds(orderId)
    const missing = (wanted as string[]).filter((id) => !already.has(id))
    if (!missing.length) return 0

    return bomSnapshotRepo.snapProducts(orderId, missing, userId)
  },

  /**
   * Chụp (hoặc chụp LẠI) định mức của đúng một tập SP trong lệnh. `upsert` nên
   * gọi lại là ghi đè bằng định mức hiện hành — dùng cho nút "chốt lại định mức"
   * khi Kỹ thuật vừa sửa BOM và lệnh muốn theo bản mới.
   */
  async snapProducts(
    orderId: string,
    productIds: string[],
    userId: string | null,
  ): Promise<number> {
    if (!productIds.length) return 0
    const [parts, revs] = await Promise.all([
      livePartsByProduct(productIds),
      db().from('technical_products').select('id, bom_rev').in('id', productIds),
    ])
    if (revs.error) throw new Error(revs.error.message)
    const revById = new Map((revs.data ?? []).map((r) => [r.id, r.bom_rev]))

    const rows = productIds.flatMap((pid) =>
      [...(parts.get(pid)?.entries() ?? [])].map(([material_code, qty_per_unit]) => ({
        production_order_id: orderId,
        product_id: pid,
        material_code,
        qty_per_unit,
        product_rev: revById.get(pid) ?? null,
        snapped_at: new Date().toISOString(),
        snapped_by: userId,
      })),
    )
    if (!rows.length) return 0

    const { error } = await db()
      .from('production_order_boms')
      .upsert(rows, { onConflict: 'production_order_id,product_id,material_code' })
    if (error) throw new Error(error.message)
    // Dòng định mức bị XOÁ khỏi hồ sơ giữa hai lần chụp thì upsert không dọn —
    // xoá phần thừa của đúng các SP vừa chụp lại.
    const keep = new Set(rows.map((r) => `${r.product_id}|${r.material_code}`))
    const stale = (await bomSnapshotRepo.listByOrder(orderId)).filter(
      (r) =>
        productIds.includes(r.product_id) &&
        !keep.has(`${r.product_id}|${r.material_code}`),
    )
    for (const r of stale) {
      await db()
        .from('production_order_boms')
        .delete()
        .eq('production_order_id', orderId)
        .eq('product_id', r.product_id)
        .eq('material_code', r.material_code)
    }
    return new Set(rows.map((r) => r.product_id)).size
  },
}
