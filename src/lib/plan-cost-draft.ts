import { parsePriceText, type DecimalSep } from './price-paste'
import { planCheck, type BreakdownItem } from './plan-cost'

/**
 * Ô GÕ của bảng Giá thành kế hoạch → bốn số gửi lên server. Lõi thuần, có test.
 *
 * Luật ghép ô gõ với số ĐANG CÓ (08/10/2026, dựng lại màn):
 * - Ô để trống = GIỮ số đang có của SP, miễn là số đó cùng tiền tệ với lần
 *   lưu này. Sửa mỗi ô FOB của một SP đã đủ bốn số thì ba số kia vẫn còn, và
 *   phép kiểm tổng sẽ bắt ngay nếu FOB mới không khớp — đúng ý: đổi FOB thì
 *   phải đổi cả bảng tính.
 * - Không có số nào ngoài FOB → "chỉ FOB" (khách chỉ có bảng giá chốt).
 * - Có chung + lợi nhuận mà thiếu trực tiếp → suy trực tiếp = FOB − chung −
 *   lợi nhuận (cùng luật hộp dán).
 * - Có 1–2 trong 3 số → dở dang, không lưu.
 */
export type PlanDraft = {
  direct: string
  overhead: string
  profit: string
  price: string
  /** Khối chi phí chép từ bảng tính (kiểu dán khối) — đi kèm lần lưu. */
  breakdown?: BreakdownItem[]
  /** Dòng nào trong khối dán bảng — để bày "khối dán · dòng N". */
  from_line?: number
}

export const EMPTY_PLAN_DRAFT: PlanDraft = { direct: '', overhead: '', profit: '', price: '' }

export const planDraftDirty = (d: PlanDraft | undefined): d is PlanDraft =>
  !!d && (d.direct !== '' || d.overhead !== '' || d.profit !== '' || d.price !== '')

export type PlanSaved = {
  direct: number | null
  overhead: number | null
  profit: number | null
  price: number | null
  currency: string | null
}

export type PlanResolved =
  | {
      ok: true
      direct: number | null
      overhead: number | null
      profit: number | null
      price: number
      fob_only: boolean
      derived_direct: boolean
    }
  | { ok: false; reason: string }

const r2 = (n: number) => Math.round(n * 100) / 100

export function resolvePlanDraft(
  d: PlanDraft,
  saved: PlanSaved,
  sep: DecimalSep,
  currency: string,
): PlanResolved {
  // Số đang có chỉ được "mượn" khi cùng tiền tệ — USD đang có + VND đang gõ là hai bảng khác nhau.
  const keep = saved.currency == null || saved.currency === currency
  const typed = (s: string): number | null | 'bad' => {
    if (s.trim() === '') return null
    const n = parsePriceText(s, sep)
    return n == null ? 'bad' : n
  }
  const t = {
    direct: typed(d.direct),
    overhead: typed(d.overhead),
    profit: typed(d.profit),
    price: typed(d.price),
  }
  if (Object.values(t).includes('bad')) return { ok: false, reason: 'ô không phải số' }
  const eff = (k: keyof typeof t): number | null => {
    const v = t[k] as number | null
    return v ?? (keep ? saved[k] : null)
  }
  const price = eff('price')
  if (price == null) return { ok: false, reason: 'thiếu giá FOB' }
  if (price < 0) return { ok: false, reason: 'số âm' }
  const overhead = eff('overhead')
  const profit = eff('profit')
  const directRaw = eff('direct')
  if (overhead == null && profit == null && directRaw == null)
    return { ok: true, direct: null, overhead: null, profit: null, price, fob_only: true, derived_direct: false } // prettier-ignore
  if (overhead == null || profit == null)
    return {
      ok: false,
      reason: 'ghi đủ trực tiếp · chung · lợi nhuận, hoặc chỉ FOB',
    }
  const direct = directRaw ?? r2(price - overhead - profit)
  if (direct < 0 || overhead < 0) return { ok: false, reason: 'số âm' }
  const chk = planCheck({ direct, overhead, profit, price }, currency)
  if (!chk.ok)
    return { ok: false, reason: `trực tiếp + chung + lợi nhuận ≠ FOB (lệch ${chk.diff})` }
  return {
    ok: true,
    direct,
    overhead,
    profit,
    price,
    fob_only: false,
    derived_direct: directRaw == null,
  }
}
