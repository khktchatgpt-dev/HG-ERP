/**
 * ĐẶT THEO MỘT ĐƠN VỊ, TRẢ TIỀN THEO ĐƠN VỊ KHÁC — logic thuần cho form khai
 * vật tư (`MaterialCoreFields`).
 *
 * Vì sao tách ra: quyết định "có hỏi hệ số quy đổi không" trước đây nằm trong
 * hook React và đi theo `guessTemplate`, tức đọc TÊN vật tư. Tên phải có tiết
 * diện dạng "25x50" hay "phi 25" thì máy mới nhận ra là hàng kim loại; "Cuộn
 * inox 304/2B" hay "Inox 22122-011" thì không, nên form không hỏi câu nào — dù
 * ĐVT đã nói rõ đây là hàng đếm theo cuộn/tấm và NCC chào theo cân.
 *
 * Hậu quả đo được trên danh mục thật: 961 mã ĐVT tấm/cuộn mà chỉ 4 mã khai được
 * kg/đơn-vị. Chỗ duy nhất hỏi con số đó lại gác cửa bằng cách đọc tên.
 */

/** ĐVT về dạng so được: thường hoá + bỏ dấu ("Tấm" → "tam", "Cuộn" → "cuon"). */
export function nodUnit(s: string | null | undefined): string {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .trim()
}

/** ĐVT ĐẾM ĐƯỢC — mua theo món, khác ĐVT đo lường (kg, mét, lít, m²). */
const COUNTABLE = /^(cay|thanh|tam|cuon|bo|ong|soi|khuc|mieng|to|la)$/

/** Tên/nhóm có nói tới kim loại không — hàng hay được chào theo cân. */
const METALISH = /s[aă]t|th[eé]p|inox|nh[oô]m|t[oô]n|k[eẽ]m/i

export type WeightPricing = {
  /** ĐVT mua là đơn vị đếm được (cây, tấm, cuộn…). */
  countableUnit: boolean
  /** NCC chào theo kg trong khi mình đặt theo món → cần hệ số quy đổi. */
  pricedByWeight: boolean
  /** Nhiều khả năng là hàng giá-theo-kg mà chưa ai khai — nhắc một câu. */
  likely: boolean
  /** Đã khai giá theo kg nhưng bỏ trống hệ số → đơn sau sẽ bị chặn. */
  missingFactor: boolean
}

export function weightPricing(input: {
  name?: string | null
  group_name?: string | null
  unit?: string | null
  price_unit?: string | null
  unit2_factor?: string | number | null
}): WeightPricing {
  const unit = nodUnit(input.unit)
  const priceUnit = nodUnit(input.price_unit)
  const countableUnit = COUNTABLE.test(unit)
  const metalish = METALISH.test(`${input.name ?? ''} ${input.group_name ?? ''}`)
  const pricedByWeight = priceUnit === 'kg' && unit !== 'kg'
  const hasFactor = String(input.unit2_factor ?? '').trim() !== ''
  return {
    countableUnit,
    pricedByWeight,
    likely: countableUnit && metalish && priceUnit === '',
    missingFactor: pricedByWeight && !hasFactor,
  }
}
