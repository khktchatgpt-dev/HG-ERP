/**
 * Công thức nhu cầu từ BẢNG CHI TIẾT của LSX (SRS sản xuất chi tiết
 * FR-PL-02/03, NFR-CC-03/QA-01) — thuần, dùng cả server (needs API) lẫn
 * client (cột derived trong grid nhập).
 *
 * Nguyên tắc: KHÔNG bao giờ ra NaN/Infinity kiểu #DIV/0! — thiếu dữ liệu
 * (ĐM kg, hệ số cây) trả null + cờ `missing` nêu lý do.
 */

export type ComponentCalcInput = {
  /** CT/SP — số chi tiết trên 1 sản phẩm. */
  qty_per_unit: number
  /** ĐM kg vật tư / 1 chi tiết (null = chưa có định mức). */
  dm_kg: number | null
  /** Hệ số quy đổi: số chi tiết cắt được từ 1 cây/thanh (null/0 = chưa có). */
  pcs_per_bar: number | null
}

export type ComponentCalc = {
  /** Tổng cần = CT/SP × SL sản phẩm của dòng đơn. */
  total_needed: number
  /** Kg cần = tổng cần × ĐM kg; null khi thiếu ĐM. */
  kg_needed: number | null
  /** Số cây cần = ceil(tổng cần / hệ số); null khi thiếu/0 hệ số. */
  bars_needed: number | null
  missing: ('DM_KG' | 'PCS_PER_BAR')[]
}

const round4 = (n: number) => Math.round(n * 10_000) / 10_000

export function calcComponent(c: ComponentCalcInput, orderQty: number): ComponentCalc {
  const total = round4(c.qty_per_unit * orderQty)
  const missing: ComponentCalc['missing'] = []

  let kg: number | null = null
  if (c.dm_kg != null) kg = round4(total * c.dm_kg)
  else missing.push('DM_KG')

  let bars: number | null = null
  if (c.pcs_per_bar != null && c.pcs_per_bar > 0) bars = Math.ceil(total / c.pcs_per_bar)
  else missing.push('PCS_PER_BAR')

  return { total_needed: total, kg_needed: kg, bars_needed: bars, missing }
}

export type MaterialNeed = {
  material_id: string
  /** Tổng số CHI TIẾT cần trên vật tư này (tham khảo). */
  total_components: number
  /** Tổng kg — cộng các dòng có ĐM; incomplete=true nếu có dòng thiếu. */
  kg_needed: number | null
  /** Tổng số cây — cộng các dòng có hệ số; incomplete=true nếu có dòng thiếu. */
  bars_needed: number | null
  /** true = có dòng thiếu ĐM/hệ số → kg/số cây chưa đủ tin để đặt trọn. */
  incomplete: boolean
}

/**
 * Gộp nhu cầu theo vật tư (nhiều chi tiết dùng chung 1 vật tư). Dòng chưa gắn
 * vật tư (material_id null) bị BỎ QUA — UI phải cảnh báo riêng.
 */
export function aggregateMaterialNeeds(
  rows: { material_id: string | null; calc: ComponentCalc }[],
): MaterialNeed[] {
  const byMat = new Map<string, MaterialNeed>()
  for (const r of rows) {
    if (!r.material_id) continue
    const cur = byMat.get(r.material_id) ?? {
      material_id: r.material_id,
      total_components: 0,
      kg_needed: null,
      bars_needed: null,
      incomplete: false,
    }
    cur.total_components = round4(cur.total_components + r.calc.total_needed)
    if (r.calc.kg_needed != null) {
      cur.kg_needed = round4((cur.kg_needed ?? 0) + r.calc.kg_needed)
    } else cur.incomplete = true
    if (r.calc.bars_needed != null) {
      cur.bars_needed = (cur.bars_needed ?? 0) + r.calc.bars_needed
    } else cur.incomplete = true
    byMat.set(r.material_id, cur)
  }
  return [...byMat.values()]
}
