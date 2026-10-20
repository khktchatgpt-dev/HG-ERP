import { parsePriceText, type DecimalSep } from './price-paste'

/**
 * GIÁ THÀNH KẾ HOẠCH THEO SẢN PHẨM — lõi thuần, đọc đúng khuôn bảng tính giá
 * của Sale (đo 4 file 02/10/2026: Halston · MERXX nhôm gỗ · YOTRIO 01.26 ·
 * BOM-HG Rosco). Mọi file cùng một dạng:
 *
 *     trực tiếp     = nhôm/sắt + khoán công + đóng+kiểm + xuất hàng + bao bì
 *                     + vật tư + sơn + gỗ + vải/nệm
 *     chi phí chung = trực tiếp × a%                 (a: 10–20%, theo SP)
 *     lợi nhuận     = (trực tiếp + chi phí chung) × b%   (b: 5–14%, theo SP)
 *     Total         = giá FOB
 *
 * a%, b% KHÔNG cố định nên hệ thống lưu BỐN SỐ TUYỆT ĐỐI; % chỉ là số suy ra.
 */

export type PlanCost = {
  direct: number
  overhead: number
  profit: number
  price: number
}

export type BreakdownItem = { label: string; amount: number }

/** Lệch quá chừng này so với số đang có thì cảnh báo (không chặn). */
export const PLAN_WARN_PCT = 30

/**
 * Dung sai khi kiểm "trực tiếp + chi phí chung + lợi nhuận = FOB": file Sale
 * làm tròn từng dòng 2 lẻ nên tổng lệch vài cent là bình thường; USD cho 0,05,
 * VND cho 1 đồng (không ai ghi lẻ dưới 1 đồng).
 */
export function planTolerance(currency: string): number {
  return currency === 'VND' ? 1 : 0.05
}

/** Tổng ba khoản có khớp giá FOB không. `diff` = FOB − tổng (dương là FOB cao hơn). */
export function planCheck(p: PlanCost, currency = 'USD'): { ok: boolean; diff: number } {
  const diff = r2(p.price - (p.direct + p.overhead + p.profit))
  return { ok: Math.abs(diff) <= planTolerance(currency), diff }
}

/** a% (chi phí chung trên trực tiếp) và b% (lợi nhuận trên trực tiếp + chung). */
export function planPct(p: Pick<PlanCost, 'direct' | 'overhead' | 'profit'>): {
  a: number | null
  b: number | null
} {
  const a = p.direct > 0 ? Math.round((p.overhead / p.direct) * 1000) / 10 : null
  const base = p.direct + p.overhead
  const b = base > 0 ? Math.round((p.profit / base) * 1000) / 10 : null
  return { a, b }
}

/** Độ lệch % của FOB mới so với FOB đang có. null khi chưa có số cũ. */
export function planDeviationPct(next: number, prev: number | null): number | null {
  if (prev == null || !(prev > 0)) return null
  return Math.round(((next - prev) / prev) * 1000) / 10
}

// ── Dán bảng nhiều SP: mã · trực tiếp · chi phí chung · lợi nhuận · FOB ───────

export type PlanPasteRow = {
  line: number
  code: string
  /** Trực tiếp có thể để trống trong file → suy = FOB − chung − lợi nhuận. */
  plan: PlanCost
  derived_direct: boolean
}

export type PlanPasteResult = {
  rows: PlanPasteRow[]
  errors: { line: number; reason: string }[]
}

/**
 * Đọc khối dán 5 cột (tab hoặc chấm phẩy). Cột trực tiếp để trống được. Dòng
 * tiêu đề (không có số nào) bị bỏ qua lặng lẽ; dòng thiếu số thì báo lỗi theo
 * số dòng để người dán sửa đúng chỗ.
 */
export function parsePlanPaste(text: string, sep: DecimalSep): PlanPasteResult {
  const rows: PlanPasteRow[] = []
  const errors: PlanPasteResult['errors'] = []
  const lines = text.replace(/\r/g, '').split('\n')
  lines.forEach((raw, i) => {
    const line = i + 1
    if (!raw.trim()) return
    const cells = raw.split(/\t|;/).map((c) => c.trim())
    const code = cells[0] ?? ''
    if (!code) {
      errors.push({ line, reason: 'Thiếu mã ở cột đầu' })
      return
    }
    const nums = cells.slice(1, 5).map((c) => (c === '' ? null : parsePriceText(c, sep)))
    const hasAny = nums.some((n) => n != null)
    if (!hasAny) return // tiêu đề hoặc dòng chữ — bỏ qua
    const [direct, overhead, profit, price] = nums
    if (overhead == null || profit == null || price == null) {
      errors.push({ line, reason: 'Cần đủ chi phí chung · lợi nhuận · giá FOB' })
      return
    }
    if (cells.length < 5) {
      errors.push({
        line,
        reason: 'Cần 5 cột: mã · trực tiếp · chi phí chung · lợi nhuận · FOB',
      })
      return
    }
    const d = direct ?? r2(price - overhead - profit)
    if (d < 0 || overhead < 0 || price < 0) {
      errors.push({ line, reason: 'Số âm' })
      return
    }
    rows.push({
      line,
      code,
      plan: { direct: d, overhead, profit, price },
      derived_direct: direct == null,
    })
  })
  return { rows, errors }
}

// ── Dán KHỐI chi phí của một SP (đúng như cột trong file báo giá) ─────────────

export type PlanBlock = {
  plan: PlanCost
  breakdown: BreakdownItem[]
  /** Dòng "Giá cũ" nếu file có — chỉ để bày, không lưu. */
  old_price: number | null
}

const OVERHEAD_RE = /chi\s*ph[ií]\s*chung/i
const PROFIT_RE = /l[ợo]i\s*nhu[ậa]n/i
const TOTAL_RE = /^\s*total\b|^\s*t[ổo]ng\s*(c[ộo]ng)?\s*$|gi[áa]\s*fob/i
const OLD_RE = /gi[áa]\s*c[ũu]/i
const PCT_RE = /^\s*[\d.,]+\s*%\s*$/

/**
 * Đọc khối "nhãn \t $số" chép từ một cột chi phí của bảng tính (nhôm, tiền
 * công, …, chi phí chung, Lợi nhuận, Total). Mọi dòng trước "chi phí chung" là
 * TRỰC TIẾP và được giữ nguyên nhãn vào `breakdown`. Trả null khi thiếu Total.
 */
export function parsePlanBlock(text: string, sep: DecimalSep): PlanBlock | null {
  const breakdown: BreakdownItem[] = []
  let overhead: number | null = null
  let profit: number | null = null
  let price: number | null = null
  let old: number | null = null
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    if (!raw.trim() || PCT_RE.test(raw)) continue
    const cells = raw.split(/\t|;/).map((c) => c.trim())
    // Nhãn = ô chữ đầu tiên; số = ô cuối có số (file hay có cột trống ở giữa).
    const label = cells.find((c) => c && parsePriceText(c, sep) == null) ?? ''
    const numCell = [...cells].reverse().find((c) => c && parsePriceText(c, sep) != null)
    if (!label || numCell == null) continue
    const amount = parsePriceText(numCell, sep)!
    if (OLD_RE.test(label)) old = amount
    else if (OVERHEAD_RE.test(label)) overhead = amount
    else if (PROFIT_RE.test(label)) profit = amount
    else if (TOTAL_RE.test(label)) price = amount
    else breakdown.push({ label, amount })
  }
  if (price == null || overhead == null || profit == null) return null
  const direct = r2(breakdown.reduce((a, b) => a + b.amount, 0))
  return { plan: { direct, overhead, profit, price }, breakdown, old_price: old }
}

// ── Khớp dòng dán về SP thật ──────────────────────────────────────────────────

export type PlanTarget = {
  product_id: string
  /** Mã HG — mã của MÌNH, thắng khi trùng với mã khách của SP khác. */
  code: string
  customer_code: string | null
}

export type PlanMatchResult<T extends { code: string; line: number }> = {
  matched: { target: PlanTarget; row: T }[]
  unmatched: T[]
  /** Một mã khách gắn với nhiều SP HG — không đoán, bắt người dán ghi mã HG. */
  ambiguous: { row: T; codes: string[] }[]
}

/**
 * Mã HG trước, mã khách sau — thứ tự cố định, cùng luật với `price-paste`:
 * một chuỗi vừa là mã HG của SP này vừa là mã khách của SP khác thì mã của
 * mình thắng. So không phân biệt hoa/thường, bỏ khoảng trắng hai đầu.
 */
export function matchPlanRows<T extends { code: string; line: number }>(
  targets: readonly PlanTarget[],
  rows: readonly T[],
): PlanMatchResult<T> {
  const key = (s: string) => s.trim().toLowerCase()
  const byCode = new Map<string, PlanTarget>()
  const byCustomer = new Map<string, PlanTarget[]>()
  for (const t of targets) {
    byCode.set(key(t.code), t)
    if (t.customer_code) {
      const k = key(t.customer_code)
      byCustomer.set(k, [...(byCustomer.get(k) ?? []), t])
    }
  }
  const out: PlanMatchResult<T> = { matched: [], unmatched: [], ambiguous: [] }
  for (const row of rows) {
    const k = key(row.code)
    const hg = byCode.get(k)
    if (hg) {
      out.matched.push({ target: hg, row })
      continue
    }
    const cs = byCustomer.get(k) ?? []
    if (cs.length === 1) out.matched.push({ target: cs[0], row })
    else if (cs.length === 0) out.unmatched.push(row)
    else out.ambiguous.push({ row, codes: cs.map((c) => c.code).sort() })
  }
  return out
}

const r2 = (n: number) => Math.round(n * 100) / 100
