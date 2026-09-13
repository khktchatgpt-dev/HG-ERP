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

const round2 = (n: number) => Math.round(n * 100) / 100
