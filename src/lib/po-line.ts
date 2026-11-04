/**
 * Tính tiền dòng đơn đặt vật tư — CÔNG THỨC DUY NHẤT cho cả server (tổng chi
 * NCC, phiếu in) lẫn client (form tạo/sửa PO, chi tiết). Logic thuần, testable.
 *
 * Giá đơn vị kép (0053 — mô hình SAP Order Price Unit thu gọn):
 *   price_basis = 'unit'  → thành tiền = SL đặt (ĐVT mua)  × đơn giá
 *   price_basis = 'unit2' → thành tiền = qty2 (tổng kg/m²) × đơn giá
 * unit2 mà thiếu qty2 (dữ liệu dở dang) → coi như 0, không âm thầm rơi về unit
 * để tránh in ra tổng sai với hoá đơn NCC.
 */

export type PriceBasis = 'unit' | 'unit2'

/**
 * TIỀN TỆ CỦA ĐƠN MUA — một danh sách cho cả form soạn đơn lẫn hồ sơ NCC.
 * VND đứng đầu vì là mặc định; các mã sau theo NCC thật (gỗ báo giá USD/m³,
 * kính đặt Trung Quốc, NCC khai EUR/JPY trong hồ sơ).
 */
export const PO_CURRENCIES = ['VND', 'USD', 'EUR', 'CNY', 'JPY'] as const

/**
 * Số lẻ của tiền theo currency: VND (và JPY) không có đơn vị lẻ; còn lại 2 số
 * lẻ (cent). Đơn gỗ thật chốt $700.21 — làm tròn về $700 là lệch với NCC.
 */
export function currencyDecimals(currency?: string | null): number {
  const c = (currency ?? 'VND').toUpperCase()
  return c === 'VND' || c === 'JPY' ? 0 : 2
}

/** Làm tròn tiền theo currency — VND về đồng, USD/EUR/CNY về cent. */
export function roundMoney(n: number, currency?: string | null): number {
  const f = 10 ** currencyDecimals(currency)
  return Math.round(n * f) / f
}

/**
 * Hiện tiền theo currency: VND "1.234.567", USD "1.234,56" (đủ 2 số lẻ để cột
 * tiền thẳng hàng và không ai tưởng $3,1 là $3,10 gõ thiếu). Chỉ format CON SỐ —
 * nhãn tiền tệ do chỗ gọi tự đặt cạnh (cột riêng / hậu tố), như UI hiện hành.
 */
export function fmtMoney(n: number, currency?: string | null): string {
  const d = currencyDecimals(currency)
  return n.toLocaleString('vi-VN', {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })
}

export type PoLineAmountInput = {
  qty_ordered: number
  unit_price: number | null
  price_basis?: PriceBasis | null
  qty2?: number | null
}

export function poLineAmount(l: PoLineAmountInput): number {
  const price = l.unit_price ?? 0
  if ((l.price_basis ?? 'unit') === 'unit2') return (l.qty2 ?? 0) * price
  return l.qty_ordered * price
}

/**
 * QUY ĐỔI ĐÓNG GÓI MUA — dùng chung form soạn đơn và phiếu in/xuất Excel (0128).
 *
 * SL đặt luôn theo ĐVT gốc; hai hàm này chỉ phục vụ dòng chữ "≈ 27,2 bì" và nút
 * gợi ý làm tròn lên nguyên bao — đúng phép chia nhân viên vẫn tự bấm trong
 * Excel (13.596 con ÷ 500 → 28 bì = 14.000 con). Không đụng vào tiền.
 */
export function packCount(qty: number, packSize: number | null): number | null {
  if (!packSize || packSize <= 0 || !(qty > 0)) return null
  return Math.round((qty / packSize) * 100) / 100
}

/** SL làm tròn LÊN nguyên bao — 0/không đóng gói thì trả nguyên số. */
export function roundUpToPack(qty: number, packSize: number | null): number {
  if (!packSize || packSize <= 0 || !(qty > 0)) return qty
  return Math.ceil(qty / packSize - 1e-9) * packSize
}

export type PoQtyTotal = { label: string; value: number }

/**
 * DÒNG PHÍ / DỊCH VỤ XUỐNG CUỐI (0234) — phiếu in và Excel gửi NCC bày hàng hoá
 * trước, khoản phí (công dán, phí in bản…) sau; giữ nguyên thứ tự trong từng nhóm.
 */
export function feeLast<T extends { line_kind?: string | null }>(
  lines: readonly T[],
): T[] {
  return [
    ...lines.filter((l) => l.line_kind !== 'phi'),
    ...lines.filter((l) => l.line_kind === 'phi'),
  ]
}

/**
 * Dòng "Tổng số …" ngay dưới bảng hàng của phiếu in / file xuất.
 *
 * Mẫu tính tiền theo kg (nhôm, inox/sắt) cộng cột tổng kg → đúng một dòng.
 * Mẫu còn lại cộng SL đặt nhưng TÁCH THEO ĐVT: cộng "10 cây + 5 thùng" ra 15 là
 * số rác. Bản trước xử lý bằng cách BỎ HẲN dòng tổng khi đơn trộn đơn vị — im
 * lặng, và rơi đúng vào mẫu phụ kiện vốn gần như luôn trộn Con/Cái/Bộ/Mét. Giờ
 * in mỗi ĐVT một dòng, thứ tự theo lần xuất hiện đầu tiên trong đơn.
 */
export function qtyTotals(
  kgBased: boolean,
  lines: readonly {
    material_unit: string
    qty_ordered: number
    qty2?: number | null
    /** 0234 — dòng phí / dịch vụ không cộng vào "Tổng số …" (Lần, Chuyến không phải hàng). */
    line_kind?: string | null
  }[],
): PoQtyTotal[] {
  if (kgBased) {
    // Dòng ĐVT Kg không có qty2 (không barem) — SL đặt chính là số kg.
    const kg = lines.reduce((s, l) => s + (l.qty2 ?? (laDvtKg(l.material_unit) ? Number(l.qty_ordered) || 0 : 0)), 0) // prettier-ignore
    return kg > 0 ? [{ label: 'Tổng số KG', value: kg }] : []
  }
  const byUnit = new Map<string, number>()
  const hang = lines.filter((l) => l.line_kind !== 'phi')
  for (const l of hang) {
    const u = (l.material_unit ?? '').trim()
    byUnit.set(u, (byUnit.get(u) ?? 0) + (Number(l.qty_ordered) || 0))
  }
  return [...byUnit]
    .filter(([, v]) => v > 0)
    .map(([u, v]) => ({ label: u ? `Tổng số ${u.toUpperCase()}` : 'Tổng số', value: v }))
}

/** Nhãn đơn giá cho UI/in: "Đơn giá/kg" khi tính theo đv2, "Đơn giá" khi thường. */
export function priceUnitLabel(
  basis: PriceBasis | null | undefined,
  unit2: string | null | undefined,
): string {
  return (basis ?? 'unit') === 'unit2' && unit2 ? `Đơn giá/${unit2}` : 'Đơn giá'
}

/**
 * TIỀN CỦA MỘT ĐƠN — chiết khấu, VAT, tổng thanh toán.
 *
 * Tách ra khỏi form soạn đơn (`po-draft.poTotals`) vì trang chi tiết cũng phải
 * nói ra đúng những con số đó. Trước khi có hàm này, chi tiết đơn chỉ dám hiện
 * "Tổng cộng = Σ dòng" — tức số TRƯỚC chiết khấu và VAT, lệch hẳn với con số
 * người ta vừa ký trên phiếu in.
 *
 * Làm tròn NGAY ở tiền hàng: tiền từng dòng lẻ vô hạn (kg × đơn giá), để trôi
 * xuống thì tổng in ra "44.477.168,4" — không ai ký được. Mốc làm tròn theo
 * TIỀN TỆ của đơn (currency): VND về đồng nguyên như trước, USD/EUR/CNY về cent
 * — đơn gỗ thật chốt $86.743,50 với NCC, tròn về đồng là lệch phiếu.
 */
export function poMoney(input: {
  /** Σ tiền từng dòng, chưa làm tròn. */
  subtotalRaw: number
  /** Chiết khấu SỐ TIỀN — dùng khi không có `discountPercent`. */
  discount?: number | null
  /**
   * Chiết khấu THEO % (0292, 04/11/2026). Có thì THẮNG `discount`: số tiền tính lại
   * từ % mỗi lần, để sửa dòng / VAT không làm chiết khấu đứng yên ở số cũ.
   */
  discountPercent?: number | null
  /**
   * Trừ SAU VAT — chiết khấu tính trên TỔNG THANH TOÁN và không làm giảm tiền VAT
   * (NCC ghi "chiết khấu 3% tiền vỏ lon" dưới dòng Cộng, PO-2026-0242). Mặc định
   * false = trừ vào tiền hàng TRƯỚC khi tính VAT như trước 04/11/2026.
   */
  discountAfterVat?: boolean | null
  vatRate?: number | null
  /** Đơn giá ĐÃ gồm VAT chưa — quyết định cộng thêm hay tách ngược ra. */
  priceIncludesVat?: boolean | null
  /** Tiền tệ của đơn — bỏ trống coi như VND (mọi chỗ gọi cũ giữ nguyên số). */
  currency?: string | null
}) {
  const r = (n: number) => roundMoney(n, input.currency)
  const subtotal = r(input.subtotalRaw)
  const vatRate = Number(input.vatRate ?? 0) || 0
  const pct = input.discountPercent == null ? null : Number(input.discountPercent) || 0
  const fixed = Number(input.discount ?? 0) || 0
  // Giá đã gồm VAT: tách ngược ra khỏi tiền hàng, KHÔNG cộng thêm lần nữa.
  const vatOf = (base: number) =>
    input.priceIncludesVat
      ? r((base * vatRate) / (100 + vatRate))
      : r((base * vatRate) / 100)

  if (input.discountAfterVat) {
    // Cộng đủ VAT trên tiền hàng trước, rồi mới trừ chiết khấu trên tổng.
    const vatAmount = vatOf(subtotal)
    const gross = input.priceIncludesVat ? subtotal : r(subtotal + vatAmount)
    const discountAmount = pct == null ? fixed : r((gross * pct) / 100)
    return {
      subtotal,
      discountAmount,
      vatAmount,
      grandTotal: Math.max(0, r(gross - discountAmount)),
      discountAfterVat: true,
    }
  }

  const discountAmount = pct == null ? fixed : r((subtotal * pct) / 100)
  const base = Math.max(0, subtotal - discountAmount)
  const vatAmount = vatOf(base)
  return {
    subtotal,
    discountAmount,
    vatAmount,
    grandTotal: input.priceIncludesVat ? base : r(base + vatAmount),
    discountAfterVat: false,
  }
}

/**
 * `poMoney` đọc thẳng từ ĐẦU ĐƠN — cho nơi đã cầm hàng `supply_purchase_orders`
 * (hộp ký, màn duyệt của Giám đốc). Không có lối tắt này thì mỗi nơi tự ghép
 * bốn cột, và nơi nào quên VAT là nơi đó hiện số TRƯỚC thuế như tổng chi —
 * đúng lỗi của màn duyệt trước 01/10/2026.
 */
export function poMoneyOf(
  po: {
    currency: string
    vat_rate: number | null
    price_includes_vat: boolean | null
    discount_amount: number | null
    /** 0292 — vắng (chỗ gọi cũ chưa đọc cột) = chiết khấu số tiền, trừ trước VAT. */
    discount_percent?: number | null
    discount_after_vat?: boolean | null
  },
  subtotalRaw: number,
) {
  return poMoney({
    subtotalRaw,
    discount: po.discount_amount,
    discountPercent: po.discount_percent,
    discountAfterVat: po.discount_after_vat,
    vatRate: po.vat_rate,
    priceIncludesVat: po.price_includes_vat,
    currency: po.currency,
  })
}
import { laDvtKg } from './dvt-kg'
