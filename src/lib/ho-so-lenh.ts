/**
 * HỒ SƠ LỆNH — luật bày của tab Tiến độ (bản vẽ gọn 12/11/2026,
 * https://claude.ai/artifact/T2otDmrhZce8LZSmow3itu, duyệt Q1–Q7).
 *
 * Thuần, không chạm DB — màn dùng, có test. Số trong ô vẫn lấy từ dossier
 * (cùng hàm với Ghi sản lượng và Giao nhận); file này chỉ quyết định BÀY dòng
 * nào, gom ra sao, và cộng % theo mảnh cho dòng tóm.
 */

export type RowLike = {
  tier: 'finish' | 'cluster' | 'part'
  name: string
  cluster: string | null
  parent_id: string | null
  route: string[]
  total_needed: number
  cells: Record<string, { done: number }>
}

/**
 * Hàng mua (bu lông, tán rút, nhựa đỡ…) — chi tiết không qua công đoạn nào nên
 * không có tiến độ sản xuất. Q2: bỏ khỏi màn (lệnh GIGA: 328/537 dòng).
 */
export const laHangMua = (r: RowLike) => r.tier === 'part' && r.route.length === 0

/** Tên cụm để bày: bỏ đuôi "(mặc nhiên)" (Q5 — chữ đó vào tooltip). */
export const tenCum = (name: string) => name.replace(/\s*\(mặc nhiên\)\s*$/i, '').trim()

/**
 * Tiến độ THEO MẢNH ở một công đoạn qua nhiều dòng: Σ min(đạt, cần) ÷ Σ cần —
 * làm dư một dòng không bù cho dòng thiếu. Không dòng nào đi qua → null (ô "–").
 */
export function tienDo(
  rows: Pick<RowLike, 'cells' | 'total_needed'>[],
  stage: string,
): { done: number; need: number } | null {
  let need = 0
  let done = 0
  let has = false
  for (const r of rows) {
    const c = r.cells[stage]
    if (!c) continue
    has = true
    need += r.total_needed
    done += Math.min(c.done, r.total_needed)
  }
  return has ? { done, need } : null
}

/** % làm tròn xuống ở 99 khi chưa đủ — "100%" chỉ khi đủ thật. */
export function pctText(done: number, need: number): string {
  if (!(need > 0)) return '—'
  const p = Math.round((done / need) * 100)
  return `${p === 100 && done < need ? 99 : p}%`
}

export type Dot<L> = {
  id: string
  title: string
  ship_date: string | null
  lines: L[]
  qty: number
  synced: number
}

/**
 * Gom dòng mã hàng theo ĐỢT (Q1), giữ thứ tự đợt như lúc soạn lệnh. Dòng mang
 * đợt lạ (dữ liệu cũ) dồn vào nhóm "Khác" ở cuối — không bao giờ mất dòng.
 */
export function gomTheoDot<
  L extends { group_id: string; qty: number; synced_sets: number },
>(
  groups: { id: string; title: string; ship_date: string | null }[],
  lines: L[],
): Dot<L>[] {
  const known = new Set(groups.map((g) => g.id))
  const out: Dot<L>[] = groups.map((g) => ({ ...g, lines: [], qty: 0, synced: 0 }))
  const khac: Dot<L> = {
    id: '',
    title: 'Khác',
    ship_date: null,
    lines: [],
    qty: 0,
    synced: 0,
  }
  const byId = new Map(out.map((d) => [d.id, d]))
  for (const l of lines) {
    const d = known.has(l.group_id) ? byId.get(l.group_id)! : khac
    d.lines.push(l)
    d.qty += l.qty
    d.synced += l.synced_sets
  }
  return [...out, khac].filter((d) => d.lines.length > 0)
}

/** Bỏ dấu tiếng Việt + thường hoá — gõ "giang chan" vẫn ra "Giằng chân". */
export function boDau(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
}

/**
 * Ô tìm: khớp mã hàng, tên hàng, tên cụm hoặc tên chi tiết (không tính hàng
 * mua). Trả thêm `trongDong` = khớp ở cụm/chi tiết → màn mở sẵn mã hàng đó.
 */
export function khopTim(
  line: { product_code: string; product_name: string; rows: RowLike[] },
  q: string,
): { khop: boolean; trongDong: boolean } {
  const k = boDau(q.trim())
  if (!k) return { khop: true, trongDong: false }
  if (boDau(line.product_code).includes(k) || boDau(line.product_name).includes(k))
    return { khop: true, trongDong: false }
  const trong = line.rows.some(
    (r) =>
      !laHangMua(r) &&
      (boDau(r.name).includes(k) || (r.cluster != null && boDau(r.cluster).includes(k))),
  )
  return { khop: trong, trongDong: trong }
}

/**
 * Tên công đoạn NGẮN cho ô hẹp (tiêu đề cột 74px, dải 9 ô): bỏ phần trong
 * ngoặc và phần sau "&" — "May (nệm/bọc)" → "May", "Bao bì & tem nhãn" →
 * "Bao bì". Tên đủ luôn nằm ở tooltip.
 */
export const tenNgan = (label: string) =>
  label
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .replace(/\s*&.*$/, '')
    .trim()
