/**
 * TỶ GIÁ — quy ngoại tệ về VND.
 *
 * Tiền hạch toán của công ty là VND. Mọi con số "tổng cộng" trên báo cáo đều
 * phải quy về VND, nhưng **số gốc ngoại tệ không bao giờ bị thay thế** — màn
 * luôn bày cả hai, vì người đọc cần đối chiếu được với tờ chứng từ.
 *
 * ⭐ HAI LUẬT KHÔNG ĐƯỢC PHÁ:
 *
 * 1. **Chứng từ đã ghi sổ giữ NGUYÊN tỷ giá của nó.** Đọc `fx_rate` lưu cứng
 *    trên chứng từ, KHÔNG tra lại bảng tỷ giá. Tra lại nghĩa là mỗi ngày mở sổ
 *    ra một số khác, và báo cáo in tháng trước không đối chiếu được nữa.
 * 2. **Thiếu tỷ giá thì trả `null`, KHÔNG trả 0 và KHÔNG đoán.** Một khoản
 *    10.000 USD hiện thành "0 đ" đọc ra là "không nợ gì" — sai nguy hiểm hơn
 *    hẳn so với hiện "chưa quy đổi được".
 */

export type FxRate = { currency: string; rate_date: string; rate: number }

/** VND quy sang VND luôn là 1 — không tra bảng, không ai khai dòng này. */
export const BASE_CURRENCY = 'VND'

/**
 * Tỷ giá áp dụng cho một ngày: dòng MỚI NHẤT có `rate_date <= date`.
 *
 * Không lấy dòng gần nhất hai chiều: tỷ giá ngày mai chưa tồn tại lúc lập
 * chứng từ hôm nay, dùng nó là ghi sổ bằng thông tin của tương lai.
 * Chưa có dòng nào trước ngày đó → `null`, và chỗ gọi phải nói ra.
 */
export function rateFor(rates: FxRate[], currency: string, date: string): number | null {
  if (currency === BASE_CURRENCY) return 1
  let best: FxRate | null = null
  for (const r of rates) {
    if (r.currency !== currency) continue
    if (r.rate_date > date) continue
    if (!best || r.rate_date > best.rate_date) best = r
  }
  return best?.rate ?? null
}

/** Quy về VND. `null` = chưa có tỷ giá cho ngày đó — chỗ gọi PHẢI bày ra. */
export function toBase(
  amount: number,
  currency: string,
  rate: number | null,
): number | null {
  if (currency === BASE_CURRENCY) return round2(amount)
  if (rate == null || !(rate > 0)) return null
  return round2(amount * rate)
}

/**
 * Cộng nhiều khoản ĐA TIỀN TỆ về một con số VND.
 *
 * Trả kèm `missing`: các khoản KHÔNG quy đổi được. Tổng mà giấu phần thiếu đi
 * là con số không kiểm được — nguyên tắc 6 của sổ thiết kế. Màn phải nói
 * "tổng X đ, chưa gồm N khoản thiếu tỷ giá" chứ không chỉ nói "tổng X đ".
 */
export function sumToBase(
  items: { amount: number; currency: string; rate: number | null }[],
): { base: number; missing: { currency: string; amount: number }[] } {
  let base = 0
  const missing = new Map<string, number>()
  for (const it of items) {
    const v = toBase(it.amount, it.currency, it.rate)
    if (v == null) {
      missing.set(it.currency, round2((missing.get(it.currency) ?? 0) + it.amount))
      continue
    }
    base += v
  }
  return {
    base: round2(base),
    missing: [...missing].map(([currency, amount]) => ({ currency, amount })),
  }
}

/**
 * CHÊNH LỆCH TỶ GIÁ ĐÃ THỰC HIỆN, lúc trả tiền.
 *
 * Ghi nợ 10.000 USD ở tỷ giá 25.400 → 254.000.000 đ. Ba tháng sau trả ở 26.000
 * → chi 260.000.000 đ. Lỗ 6.000.000 đ, vào chi phí tài chính — tiền thật đã mất.
 *
 * Dương = LỖ (trả nhiều VND hơn lúc ghi nợ). Chứng từ VND trả về 0.
 */
export function realizedFxDiff(
  amount: number,
  currency: string,
  bookedRate: number | null,
  paidRate: number | null,
): number | null {
  if (currency === BASE_CURRENCY) return 0
  if (bookedRate == null || paidRate == null) return null
  return round2(amount * (paidRate - bookedRate))
}

/**
 * NGƯỠNG CẢNH BÁO khi nhập tỷ giá: lệch quá chừng này so với dòng gần nhất cùng
 * ngoại tệ thì màn hỏi lại ("thường là thiếu một số 0"), nhưng KHÔNG chặn —
 * Kế toán có thể đúng mà hệ thống sai (đổi loại tỷ giá). Chốt 02/10/2026.
 */
export const FX_WARN_PCT = 3

/**
 * Độ lệch % của tỷ giá mới so với tỷ giá trước: dương = cao hơn. `null` khi
 * chưa có dòng trước (dòng đầu tiên của ngoại tệ không có gì để so).
 */
export function fxDeviationPct(rate: number, prev: number | null): number | null {
  if (prev == null || !(prev > 0) || !(rate > 0)) return null
  return Math.round(((rate - prev) / prev) * 1000) / 10
}

/** Một chứng từ ngoại tệ đang THIẾU tỷ giá — đầu vào của phép gán. */
export type FxAssignDoc = {
  id: string
  kind: 'po' | 'so'
  code: string
  currency: string
  /** Ngày chốt của chứng từ: đơn mua = ngày duyệt, đơn bán = ngày xác nhận. */
  fx_date: string
  /** Tiền gốc theo ngoại tệ — để màn bày "quy VND sẽ ra bao nhiêu". */
  amount: number
}

export type FxAssignPlan = FxAssignDoc & {
  /** Tỷ giá sẽ gán. `null` = KHÔNG có dòng tỷ giá nào ≤ ngày chốt → không gán. */
  rate: number | null
  /** Ngày của dòng tỷ giá được chọn — để người đọc kiểm "lấy dòng nào". */
  rate_date: string | null
  base: number | null
}

/**
 * GÁN TỶ GIÁ CHO CHỨNG TỪ THIẾU — thuần, không ghi gì.
 *
 * Mỗi chứng từ lấy dòng tỷ giá MỚI NHẤT có `rate_date <= fx_date` (cùng luật
 * `rateFor`, không lấy tỷ giá tương lai). Không có dòng nào thì `rate: null` và
 * chứng từ đứng yên: màn phải nói "thêm dòng ≤ ngày đó rồi gán lại", không được
 * lấy dòng gần nhất SAU ngày cho xong — đó là ghi sổ bằng thông tin tương lai.
 */
export function planFxAssign(docs: FxAssignDoc[], rates: FxRate[]): FxAssignPlan[] {
  return docs.map((d) => {
    const row = rateRowFor(rates, d.currency, d.fx_date)
    return {
      ...d,
      rate: row?.rate ?? null,
      rate_date: row?.rate_date ?? null,
      base: row ? toBase(d.amount, d.currency, row.rate) : null,
    }
  })
}

/** Như `rateFor` nhưng trả cả DÒNG, để biết đã dùng tỷ giá ngày nào. */
export function rateRowFor(
  rates: FxRate[],
  currency: string,
  date: string,
): FxRate | null {
  if (currency === BASE_CURRENCY) return null
  let best: FxRate | null = null
  for (const r of rates) {
    if (r.currency !== currency) continue
    if (r.rate_date > date) continue
    if (!best || r.rate_date > best.rate_date) best = r
  }
  return best
}

const round2 = (n: number) => Math.round(n * 100) / 100
