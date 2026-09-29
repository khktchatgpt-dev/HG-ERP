/**
 * CHIA NHÓM VẬT TƯ (khu Mua hàng, 29/09/2026) — phần thuần, có test.
 *
 * Nhóm con không có bảng riêng: là chữ tự do ở `warehouse_materials.sub_group`
 * (0111). Gõ tự do thì đẻ nhãn trùng — đo 29/09 có đúng 2 cặp:
 * "Đèn - chiếu sáng" (4) cạnh "Đèn chiếu sáng" (112), "Ắc quy" (7) cạnh
 * "Ắc quy - pin" (30). Luật cũ "≤5 mã cạnh nhãn ≥50" bắt 12 nhãn, phần lớn
 * không trùng gì, và bỏ sót "Ắc quy" (7 mã).
 */

/** Khoá so nhãn: bỏ dấu, bỏ gạch, khoảng trắng, dấu câu. */
export function subKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/**
 * NHÃN ĐANG CÓ GẦN GIỐNG tên đang gõ — cùng khoá, hoặc khoá này nằm gọn trong
 * khoá kia ("Ắc quy" ⊂ "Ắc quy - pin"). Trùng y hệt chữ thì không tính (đó là
 * chọn lại nhãn cũ, không phải đẻ nhãn mới).
 */
export function similarSubs(name: string, subs: readonly string[]): string[] {
  const k = subKey(name)
  if (k.length < 3) return []
  return subs.filter((s) => {
    if (s === name.trim()) return false
    const o = subKey(s)
    return o === k || o.includes(k) || k.includes(o)
  })
}

type Pos = { group: string | null; sub: string | null }

/**
 * XEM TRƯỚC SAU KHI CHUYỂN — mỗi ô (nhóm, nhóm con) thay đổi bao nhiêu mã.
 *
 * `target` theo ĐÚNG luật server (`warehouse.service.regroup`): có nhóm mà không
 * nhóm con → nhóm con về trống; `sub: undefined` + không nhóm = giữ nhóm con.
 * `count(pos)` trả số mã ĐANG ở ô đó (từ overview của nhóm).
 */
export function regroupPreview(
  items: readonly Pos[],
  target: { group?: string; sub?: string | null },
  count: (p: Pos) => number,
): { group: string | null; sub: string | null; before: number; after: number }[] {
  const delta = new Map<string, { pos: Pos; d: number }>()
  const bump = (p: Pos, d: number) => {
    const k = `${p.group ?? ''}\u0000${p.sub ?? ''}`
    const cur = delta.get(k) ?? { pos: p, d: 0 }
    cur.d += d
    delta.set(k, cur)
  }
  for (const it of items) {
    const group = target.group ?? it.group
    const sub = target.sub !== undefined ? target.sub : target.group ? null : it.sub
    if (group === it.group && sub === it.sub) continue
    bump(it, -1)
    bump({ group, sub }, +1)
  }
  return [...delta.values()]
    .filter((x) => x.d !== 0)
    .map(({ pos, d }) => ({ ...pos, before: count(pos), after: count(pos) + d }))
    .sort((a, b) => b.after - b.before - (a.after - a.before))
}

/**
 * NHÃN NGHI TRÙNG TRONG MỘT NHÓM — nhãn ÍT mã hơn trỏ sang nhãn gần giống NHIỀU
 * mã hơn (gộp thì gộp nhỏ vào lớn). Nguồn cho chip tô vàng ở trang Nhóm vật tư.
 * Đo 29/09: đúng 2 cặp — Đèn - chiếu sáng (4) → Đèn chiếu sáng (112),
 * Ắc quy (7) → Ắc quy - pin (30).
 */
export function suspectSubs(
  subs: readonly { name: string; count: number }[],
): Map<string, string> {
  const out = new Map<string, string>()
  for (const s of subs) {
    const bigger = similarSubs(
      s.name,
      subs.map((x) => x.name),
    )
      .map((n) => subs.find((x) => x.name === n)!)
      .filter((x) => x.count > s.count || (x.count === s.count && x.name < s.name))
      .sort((a, b) => b.count - a.count)[0]
    if (bigger) out.set(s.name, bigger.name)
  }
  return out
}
