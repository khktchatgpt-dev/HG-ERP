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
  }[],
): PoQtyTotal[] {
  if (kgBased) {
    const kg = lines.reduce((s, l) => s + (l.qty2 ?? 0), 0)
    return kg > 0 ? [{ label: 'Tổng số KG', value: kg }] : []
  }
  const byUnit = new Map<string, number>()
  for (const l of lines) {
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
  discount?: number | null
  vatRate?: number | null
  /** Đơn giá ĐÃ gồm VAT chưa — quyết định cộng thêm hay tách ngược ra. */
  priceIncludesVat?: boolean | null
  /** Tiền tệ của đơn — bỏ trống coi như VND (mọi chỗ gọi cũ giữ nguyên số). */
  currency?: string | null
}) {
  const r = (n: number) => roundMoney(n, input.currency)
  const subtotal = r(input.subtotalRaw)
  const discountAmount = Number(input.discount ?? 0) || 0
  const base = Math.max(0, subtotal - discountAmount)
  const vatRate = Number(input.vatRate ?? 0) || 0
  // Giá đã gồm VAT: tách ngược ra khỏi tiền hàng, KHÔNG cộng thêm lần nữa.
  const vatAmount = input.priceIncludesVat
    ? r((base * vatRate) / (100 + vatRate))
    : r((base * vatRate) / 100)
  return {
    subtotal,
    discountAmount,
    vatAmount,
    grandTotal: input.priceIncludesVat ? base : r(base + vatAmount),
  }
}
