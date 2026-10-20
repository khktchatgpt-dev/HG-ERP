/**
 * PHÂN TÍCH CHI MUA HÀNG (spend analysis).
 *
 * Ba câu hỏi mà mọi phòng mua hàng phải trả lời được, và ba câu HG-ERP chưa
 * trả lời được trước 11/09/2026:
 *
 *   1. **Tiền chảy vào NHÓM HÀNG nào?** — không biết thì không biết nên đàm
 *      phán ở đâu. Giảm 3% giá nhôm ăn đứt việc mặc cả từng con ốc.
 *   2. **Bao nhiêu phần chi rơi vào mấy nhà cung cấp đầu?** — quy luật Pareto:
 *      thường 20% NCC chiếm 80% tiền. Đó là danh sách cần ngồi lại đàm phán.
 *   3. **Mã nào chỉ có MỘT nguồn cung?** — rủi ro đứt gãy. NCC đó nghỉ, tăng
 *      giá, hay giao trễ thì không có đường lui.
 *
 * File thuần, có test. Tách theo TIỀN TỆ như mọi phép cộng tiền khác trong dự
 * án — gộp USD với VND là ngầm khai 1 USD = 1 VND.
 */

export type SpendLine = {
  /** Nhóm vật tư, NCC, hay bất kỳ trục nào muốn gộp. */
  key: string
  label: string
  currency: string
  amount: number
  /** Mã vật tư — để đếm "bao nhiêu mã" trong nhóm. */
  material_id?: string | null
}

export type SpendRow = {
  key: string
  label: string
  currency: string
  amount: number
  /** Tỉ lệ trong tổng của CHÍNH tiền tệ đó, 0–100. */
  share: number
  /** Luỹ kế từ trên xuống — đọc thẳng ra "mấy dòng đầu chiếm bao nhiêu %". */
  cumulative: number
  line_count: number
  material_count: number
}

const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * Gộp theo `key`, xếp giảm dần, kèm tỉ lệ và LUỸ KẾ — bảng Pareto.
 *
 * Luỹ kế là thứ làm bảng này khác một bảng tổng thường: nhìn cột đó là biết
 * ngay "sáu nhóm đầu đã chiếm 80% tiền", tức biết chỗ đáng bỏ công đàm phán.
 * Thiếu nó thì người đọc phải tự cộng dồn bằng mắt.
 *
 * Khoản amount ≤ 0 bị bỏ: dòng giá 0 (chưa khai giá) làm mẫu số sai, và một
 * nhóm 0 đồng đứng trong bảng chi tiêu không nói lên điều gì.
 */
export function pareto(lines: SpendLine[]): SpendRow[] {
  type Acc = {
    key: string
    label: string
    currency: string
    amount: number
    line_count: number
    mats: Set<string>
  }
  const by = new Map<string, Acc>()
  for (const l of lines) {
    if (!(l.amount > 0)) continue
    const k = `${l.currency}|${l.key}`
    const cur = by.get(k) ?? {
      key: l.key,
      label: l.label,
      currency: l.currency,
      amount: 0,
      line_count: 0,
      mats: new Set<string>(),
    }
    cur.amount += l.amount
    cur.line_count += 1
    if (l.material_id) cur.mats.add(l.material_id)
    by.set(k, cur)
  }

  const totalByCcy = new Map<string, number>()
  for (const a of by.values()) {
    totalByCcy.set(a.currency, (totalByCcy.get(a.currency) ?? 0) + a.amount)
  }

  const rows = [...by.values()].sort(
    (a, b) => a.currency.localeCompare(b.currency) || b.amount - a.amount,
  )
  const running = new Map<string, number>()
  return rows.map((a) => {
    const total = totalByCcy.get(a.currency) ?? 0
    const run = (running.get(a.currency) ?? 0) + a.amount
    running.set(a.currency, run)
    return {
      key: a.key,
      label: a.label,
      currency: a.currency,
      amount: r2(a.amount),
      share: total > 0 ? r2((a.amount / total) * 100) : 0,
      cumulative: total > 0 ? r2((run / total) * 100) : 0,
      line_count: a.line_count,
      material_count: a.mats.size,
    }
  })
}

/**
 * Bao nhiêu dòng đầu đã chiếm `pct`% tiền — câu tóm tắt của bảng Pareto.
 *
 * Trả `null` khi không có dữ liệu: "0 nhà cung cấp chiếm 80%" là câu vô nghĩa,
 * và người đọc sẽ hiểu thành "không ai chiếm gì".
 */
export function paretoCount(
  rows: SpendRow[],
  currency: string,
  pct = 80,
): { count: number; of: number } | null {
  const mine = rows.filter((r) => r.currency === currency)
  if (mine.length === 0) return null
  const idx = mine.findIndex((r) => r.cumulative >= pct)
  return { count: idx < 0 ? mine.length : idx + 1, of: mine.length }
}

export type SourceRisk = {
  material_id: string
  code: string
  name: string
  supplier_count: number
  supplier_names: string[]
  currency: string
  amount: number
}

/**
 * MÃ CHỈ CÓ MỘT NGUỒN CUNG — rủi ro đứt gãy.
 *
 * Xếp theo tiền giảm dần: một mã ốc vít 200.000đ chỉ có một nguồn thì không sao,
 * một mã nhôm 3 tỷ chỉ có một nguồn là chuyện khác hẳn. Bảng xếp theo số lần
 * xuất hiện sẽ đẩy đúng những mã vặt lên đầu.
 */
export function singleSource(
  buys: { material_id: string; code: string; name: string; supplier_id: string; supplier_name: string; currency: string; amount: number }[], // prettier-ignore
): SourceRisk[] {
  const by = new Map<string, SourceRisk & { sups: Map<string, string> }>()
  for (const b of buys) {
    if (!(b.amount > 0)) continue
    const cur = by.get(b.material_id) ?? {
      material_id: b.material_id,
      code: b.code,
      name: b.name,
      supplier_count: 0,
      supplier_names: [],
      currency: b.currency,
      amount: 0,
      sups: new Map<string, string>(),
    }
    cur.amount += b.amount
    cur.sups.set(b.supplier_id, b.supplier_name)
    by.set(b.material_id, cur)
  }
  return [...by.values()]
    .map(({ sups, ...r }) => ({
      ...r,
      amount: r2(r.amount),
      supplier_count: sups.size,
      supplier_names: [...sups.values()],
    }))
    .filter((r) => r.supplier_count === 1)
    .sort((a, b) => b.amount - a.amount)
}
