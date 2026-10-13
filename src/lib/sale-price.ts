/**
 * Năm tên giá của Bán hàng — chốt 13/10/2026 sau khi phát hiện cột "Giá thành"
 * trên báo giá thực ra bày giá FOB kế hoạch (ĐÃ cộng lợi nhuận), nên cột "Lãi"
 * báo 0% khi Sale chào đúng giá đã tính, và báo lỗ khi họ hạ giá mà vẫn còn lãi.
 *
 *   Giá vốn KH  = trực tiếp + chi phí chung        (nội bộ, không in)
 *   Lãi KH      = lợi nhuận Sale đặt cho SP          (nội bộ, không in)
 *   Giá bán KH  = giá vốn KH + lãi KH = FOB tính ra  (nội bộ, không in)
 *   Giá chào    = giá trên báo giá, sau chiết khấu   (gửi khách)
 *   Đơn giá     = giá đã chốt trên đơn = doanh thu   (gửi khách)
 *
 * Mọi màn có giá đọc tên từ đây — một số mang ba tên ("Giá thành" · "FOB KH" ·
 * "Giá FOB") là nguồn nhầm của đợt sửa này.
 */
export const PRICE_NAME = {
  cost: 'Giá vốn KH',
  profit: 'Lãi KH',
  plan: 'Giá bán KH',
  quote: 'Giá chào',
  order: 'Đơn giá',
} as const

/** Giá kế hoạch của một SP (0220). `cost` null = SP mới có Giá bán KH, chưa bóc tách. */
export type PlanPrice = {
  cost: number | null
  price: number
  currency: string
}

const r2 = (n: number) => Math.round(n * 100) / 100
const r1 = (n: number) => Math.round(n * 10) / 10

/**
 * Giá vốn KH = trực tiếp + chi phí chung. Bảng 0220 lưu hoặc đủ bốn số, hoặc
 * chỉ FOB (`lib/plan-cost-draft`) — thiếu một trong hai vế là chưa bóc tách,
 * KHÔNG suy ngược từ FOB (không biết lãi bao nhiêu thì không biết vốn).
 */
export function planCostOf(
  direct: number | null | undefined,
  overhead: number | null | undefined,
): number | null {
  if (direct == null || overhead == null) return null
  return r2(Number(direct) + Number(overhead))
}

export type PriceCheck = {
  /** Lãi thực % = (giá − giá vốn KH) / giá. null khi chưa có giá vốn / khác tiền tệ / giá 0. */
  lai_pct: number | null
  /** ± so Giá bán KH % = (giá − giá bán KH) / giá bán KH. Âm = đang chào thấp hơn mức đã tính. */
  vs_plan_pct: number | null
  /** Giá dưới GIÁ VỐN — bán lỗ thật. */
  below_cost: boolean
  /** Giá dưới GIÁ BÁN KH — đang nhường bớt lãi, chưa chắc lỗ. */
  below_plan: boolean
  /** Có giá kế hoạch nhưng khác tiền tệ với chứng từ → không so được. */
  currency_mismatch: boolean
}

const NONE: PriceCheck = {
  lai_pct: null,
  vs_plan_pct: null,
  below_cost: false,
  below_plan: false,
  currency_mismatch: false,
}

/**
 * So một giá (giá chào sau CK / đơn giá) với giá kế hoạch của SP. Chỉ so khi
 * CÙNG tiền tệ — giá vốn USD đem trừ vào giá chào EUR là ra một con số vô nghĩa.
 */
export function checkPrice(
  price: number,
  currency: string,
  plan: PlanPrice | null | undefined,
): PriceCheck {
  if (!plan || !(price > 0)) return NONE
  if (plan.currency !== currency) return { ...NONE, currency_mismatch: true }
  const lai = plan.cost != null ? r1(((price - plan.cost) / price) * 100) : null
  const vs = plan.price > 0 ? r1(((price - plan.price) / plan.price) * 100) : null
  return {
    lai_pct: lai,
    vs_plan_pct: vs,
    below_cost: plan.cost != null && price < plan.cost,
    below_plan: price < plan.price,
    currency_mismatch: false,
  }
}

/**
 * Lãi thực bình quân của cả tờ, GIA QUYỀN theo trị giá: Σ(giá − vốn)·SL / Σ giá·SL.
 * Dòng không có SL tính SL = 1 (báo giá hay để trống SL). Chỉ gồm dòng có giá vốn
 * cùng tiền tệ — `n` cho biết bao nhiêu dòng góp vào số này.
 */
export function avgLai(
  rows: { price: number; qty: number | null; cost: number | null; comparable: boolean }[],
): { pct: number | null; n: number } {
  let rev = 0
  let gain = 0
  let n = 0
  for (const r of rows) {
    if (!r.comparable || r.cost == null || !(r.price > 0)) continue
    const q = r.qty && r.qty > 0 ? r.qty : 1
    rev += r.price * q
    gain += (r.price - r.cost) * q
    n++
  }
  return { pct: rev > 0 ? r1((gain / rev) * 100) : null, n }
}

/**
 * Cả tờ chào cao/thấp hơn Giá bán KH bao nhiêu: Σ giá·SL ÷ Σ giá bán KH·SL − 1.
 * CHỈ dòng có SL (khác `avgLai`): % này trả lời "tôi đã nhường bao nhiêu tiền",
 * dòng không SL không có tiền nào để nhường. Trả `n` = số dòng góp vào.
 */
export function vsPlanTotal(
  rows: { price: number; qty: number | null; plan: number | null; comparable: boolean }[],
): { pct: number | null; n: number } {
  let got = 0
  let planned = 0
  let n = 0
  for (const r of rows) {
    if (!r.comparable || r.plan == null || !(r.plan > 0) || !(r.price > 0)) continue
    if (!r.qty || r.qty <= 0) continue
    got += r.price * r.qty
    planned += r.plan * r.qty
    n++
  }
  return { pct: planned > 0 ? r1((got / planned - 1) * 100) : null, n }
}

/**
 * Giá bán KH này được SUY NGƯỢC từ giá đơn, không tính trước khi chào (Q3, chốt
 * 13/10/2026). Lúc nạp 0220 nhiều SP lấy lãi KH = đơn giá − giá vốn, nên 270/270
 * dòng đơn có Đơn giá đúng bằng Giá bán KH và cột "± Bán KH" mãi là 0. Chưa có
 * cột DB riêng: nhận theo câu ghi nguồn mà người nạp đã viết. Sale tính lại (nguồn
 * mới) thì nhãn tự mất.
 */
export function planFromOrder(source: string | null | undefined): boolean {
  if (!source) return false
  return /tính lại theo giá đơn|giá trên đơn|giá kế hoạch đơn/i.test(source)
}
