import { aggregateMaterialNeeds, calcComponent } from './component-needs'

/**
 * Tồn ĐẶT TRƯỚC (reserved) theo vật tư — bước 2 định hướng lại Kho.
 *
 * reserved(vật tư) = Σ nhu cầu CÒN LẠI của các LSX đã cam kết (approved |
 * in_progress), mỗi LSX tính đúng như `smartLsxNeeds`:
 *   - LSX có bảng chi tiết: cần = số cây ?? kg ?? số chi tiết (ưu tiên theo
 *     thứ tự đó, xem stock.service) − đã xuất theo LSX, chặn dưới 0.
 *   - LSX chưa nhập bảng: dùng qty_remaining từ view BOM (đã trừ đã xuất).
 *
 * Thuần — nhận dữ liệu đã query sẵn (3 nguồn), không chạm DB. Service gom
 * bằng 3-4 truy vấn hàng loạt thay vì lặp N lần theo LSX.
 */

/** 1 dòng bảng chi tiết (kèm SL sản phẩm của dòng đơn) của LSX cam kết. */
export type ReserveComponentRow = {
  production_order_id: string
  material_id: string | null
  qty_per_unit: number
  dm_kg: number | null
  pcs_per_bar: number | null
  /** SL sản phẩm của dòng đơn gắn với chi tiết (join sales_order_lines.qty). */
  order_qty: number
}

/** Đã xuất kho theo (LSX, vật tư) — movements direction='out'. */
export type ReserveIssuedRow = {
  production_order_id: string
  material_id: string
  qty: number
}

/** Nhu cầu còn lại theo BOM (view v_lsx_material_status) — cho LSX chưa có bảng chi tiết. */
export type ReserveBomRow = {
  production_order_id: string
  material_id: string
  qty_remaining: number
}

/** Gộp reserved theo vật tư. bomRows của LSX ĐÃ có bảng chi tiết bị bỏ qua (tránh đếm đôi). */
export function computeReservedByMaterial(
  componentRows: ReserveComponentRow[],
  issuedRows: ReserveIssuedRow[],
  bomRows: ReserveBomRow[],
): Map<string, number> {
  const issued = new Map<string, number>()
  for (const r of issuedRows) {
    const k = `${r.production_order_id}:${r.material_id}`
    issued.set(k, (issued.get(k) ?? 0) + r.qty)
  }

  const out = new Map<string, number>()
  const add = (materialId: string, v: number) => {
    if (v > 0) out.set(materialId, (out.get(materialId) ?? 0) + v)
  }

  // Nhóm bảng chi tiết theo LSX → gộp nhu cầu per vật tư (như smartLsxNeeds).
  const byLsx = new Map<string, ReserveComponentRow[]>()
  for (const r of componentRows) {
    const arr = byLsx.get(r.production_order_id)
    if (arr) arr.push(r)
    else byLsx.set(r.production_order_id, [r])
  }
  for (const [lsxId, rows] of byLsx) {
    const agg = aggregateMaterialNeeds(
      rows.map((r) => ({
        material_id: r.material_id,
        calc: calcComponent(
          { qty_per_unit: r.qty_per_unit, dm_kg: r.dm_kg, pcs_per_bar: r.pcs_per_bar },
          r.order_qty,
        ),
      })),
    )
    for (const a of agg) {
      const needed = a.bars_needed ?? a.kg_needed ?? a.total_components
      const done = issued.get(`${lsxId}:${a.material_id}`) ?? 0
      add(a.material_id, needed - done)
    }
  }

  // LSX chưa nhập bảng chi tiết → BOM view (qty_remaining đã trừ đã xuất).
  for (const r of bomRows) {
    if (byLsx.has(r.production_order_id)) continue // đã tính theo bảng chi tiết
    add(r.material_id, r.qty_remaining)
  }
  return out
}
