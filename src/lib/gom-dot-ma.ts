/**
 * GOM ĐỢT THEO MÃ HÀNG ở Bảng chi tiết (bản vẽ 15/11/2026
 * https://claude.ai/artifact/SNZSog1EeA4TTyU8V4wggp, Q2). Thuần, có test.
 *
 * Một mã hàng ở nhiều đợt = nhiều dòng lệnh, mỗi dòng một bộ production_component.
 * Lệnh 01 LAURA: 26 mã thành 87 nhóm, CH0212HG-IR lặp 5 đợt → thống kê gõ cùng
 * một bộ chi tiết 5 lần. Gom: các dòng lệnh cùng mã có bộ chi tiết GIỐNG HỆT nhau
 * (kể cả cùng trống) bày MỘT nhóm — dòng đầu làm đại diện; lưu thì chép bộ của đại
 * diện sang mọi đợt. Đợt nào đã khác nhau (sửa tay riêng) thì KHÔNG gom.
 */

/**
 * Đại diện → các dòng lệnh đi theo. Chỉ có mặt khi mã có ≥ 2 dòng lệnh và mọi
 * dòng có cùng chữ ký bộ chi tiết (theo thứ tự).
 */
export function nhomGomTheoMa<R>(
  lines: readonly { id: string; product_code: string }[],
  rowsOf: (lineId: string) => readonly R[],
  chuKy: (r: R) => string,
): Map<string, string[]> {
  const byMa = new Map<string, string[]>()
  for (const l of lines)
    byMa.set(l.product_code, [...(byMa.get(l.product_code) ?? []), l.id])
  const out = new Map<string, string[]>()
  for (const ids of byMa.values()) {
    if (ids.length < 2) continue
    const sig = (id: string) => rowsOf(id).map(chuKy).join('\n')
    const s0 = sig(ids[0])
    if (ids.every((id) => sig(id) === s0)) out.set(ids[0], ids.slice(1))
  }
  return out
}

/** Bộ dòng ĐEM LƯU: bỏ dòng của các đợt đi theo, chép dòng của đại diện sang chúng. */
export function nhanTheoDot<R extends { production_order_line_id: string }>(
  rows: readonly R[],
  gom: ReadonlyMap<string, readonly string[]>,
): R[] {
  const theo = new Set([...gom.values()].flat())
  const giu = rows.filter((r) => !theo.has(r.production_order_line_id))
  const them: R[] = []
  for (const [daiDien, cacDot] of gom) {
    const goc = giu.filter((r) => r.production_order_line_id === daiDien)
    for (const dot of cacDot)
      for (const r of goc) them.push({ ...r, production_order_line_id: dot })
  }
  return [...giu, ...them]
}
