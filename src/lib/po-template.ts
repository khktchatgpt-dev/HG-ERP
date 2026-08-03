/**
 * MẪU ĐƠN ĐẶT HÀNG THEO LOẠI HÀNG — nguồn sự thật DUY NHẤT cho cả server (service
 * dựng dòng, phiếu in) lẫn client (form soạn đơn). Logic thuần, testable.
 *
 * Vì sao có: phòng Cung ứng không dùng một mẫu đơn. Rà 8 file đơn thật (mỗi file
 * 1 LSX, mỗi sheet NCC là 1 đơn) ra 5 mẫu khác nhau cả bộ cột dòng hàng, công
 * thức thành tiền, VAT mặc định lẫn khối chữ ký. Nhồi chung một form thì dòng
 * nhôm phải mượn ô của dòng vít, và nhân viên phải tự bấm máy tính.
 *
 * ⭐ KHÔNG có trục tính tiền thứ hai. Mọi mẫu vẫn quy về `poLineAmount`:
 *   price_basis 'unit'  → SL đặt × đơn giá
 *   price_basis 'unit2' → qty2   × đơn giá   (qty2 = tổng kg / tổng m²)
 * `deriveLine()` chỉ dịch các ô nhập của mẫu thành (qty_ordered, qty2, unit2,
 * price_basis). Nhờ vậy đơn cũ (template 'simple') không đổi một đồng nào.
 */

export const PO_TEMPLATES = [
  'accessory',
  'aluminium',
  'metal_kg',
  'carton',
  'simple',
] as const
export type PoTemplate = (typeof PO_TEMPLATES)[number]

export type PoTerms = {
  quality: string
  delivery_place: string
  payment: string
  invoice: string
  lead_time: string
}

export type PoTemplateMeta = {
  key: PoTemplate
  label: string
  /** Một dòng giải thích cho người chọn mẫu — nêu loại hàng + NCC tiêu biểu. */
  hint: string
  /** Đơn vị của đơn giá: null = theo ĐVT mua; 'kg'/'m²' = giá theo đơn vị 2. */
  priceUnit: string | null
  vatRate: number | null
  /** Đơn giá đã gồm VAT chưa — nhôm ghi "chưa gồm", inox ghi "đã gồm". */
  priceIncludesVat: boolean
  /** Chỉ mẫu phụ kiện in dòng Chiết khấu trên phiếu. */
  hasDiscount: boolean
  signerRole: string
  terms: PoTerms
}

const DELIVERY_HG = 'Xưởng SX Cty TNHH Hoàng Gia - Cụm CN Cát Nhơn, Gia Lai'
const INVOICE_VAT = 'Hóa đơn GTGT'

/**
 * Mặc định lấy nguyên văn từ các đơn thật gần nhất của từng nhóm NCC. Người dùng
 * sửa được trên form; đây chỉ là điểm khởi đầu để không phải gõ lại mỗi lần.
 */
export const PO_TEMPLATE_META: Record<PoTemplate, PoTemplateMeta> = {
  accessory: {
    key: 'accessory',
    label: 'Phụ kiện / vật tư rời',
    hint: 'Vít, nút nhựa, pát, long đền, ty sắt, tem nhãn — TTL, MT, TN, TP, ATP, PQ',
    priceUnit: null,
    vatRate: 8,
    priceIncludesVat: false,
    hasDiscount: true,
    signerRole: 'TRƯỞNG PHÒNG CUNG ỨNG',
    terms: {
      quality: 'Hàng đúng mẫu, đúng chuẩn loại theo yêu cầu',
      delivery_place: DELIVERY_HG,
      payment: 'Thanh toán công nợ cuối tháng',
      invoice: INVOICE_VAT,
      lead_time: 'Từ 7 đến 10 ngày kể từ ngày xác nhận đơn',
    },
  },
  aluminium: {
    key: 'aluminium',
    label: 'Nhôm định hình',
    hint: 'Đặt theo cây, tính tiền theo kg — Việt ECO, Tiến Đạt, Cát Tường, Taiwan, Việt Ý',
    priceUnit: 'kg',
    vatRate: 10,
    priceIncludesVat: false,
    hasDiscount: false,
    signerRole: 'TRƯỞNG PHÒNG KẾ HOẠCH',
    terms: {
      quality:
        'Nhôm đã nhiệt luyện, bề mặt phẳng đẹp. Độ cứng và dung sai theo tiêu chuẩn đã thống nhất',
      delivery_place: DELIVERY_HG,
      payment: 'Cọc 30% đơn hàng, phần còn lại thanh toán khi giao đủ',
      invoice: INVOICE_VAT,
      lead_time: 'Theo kế hoạch Công ty Hoàng Gia',
    },
  },
  metal_kg: {
    key: 'metal_kg',
    label: 'Inox / sắt theo kg',
    hint: 'Cây, ống, tấm — cân theo kg/đơn vị. Kim Vĩnh Phú, Hào Tư Hùng, Thông Đạt',
    priceUnit: 'kg',
    vatRate: 10,
    priceIncludesVat: true,
    hasDiscount: false,
    signerRole: 'TRƯỞNG PHÒNG KẾ HOẠCH',
    terms: {
      quality: 'Bề mặt phẳng đẹp, đúng mác. Dung sai độ dày và quy cách +/- 5%',
      delivery_place: DELIVERY_HG,
      payment: 'Tạm ứng 50% sau khi đặt hàng, thanh toán phần còn lại khi giao đủ',
      invoice: INVOICE_VAT,
      lead_time: 'Theo kế hoạch Công ty Hoàng Gia',
    },
  },
  carton: {
    key: 'carton',
    label: 'Bao bì carton',
    hint: 'Thùng theo quy cách lọt lòng — giá theo thùng hoặc theo m², chọn từng dòng',
    priceUnit: null,
    vatRate: 8,
    priceIncludesVat: false,
    hasDiscount: false,
    signerRole: 'TRƯỞNG PHÒNG CUNG ỨNG',
    terms: {
      quality: 'Đúng định lượng, đúng quy cách, thùng không móp rách',
      delivery_place: DELIVERY_HG,
      payment: 'Công nợ cuối tháng',
      invoice: INVOICE_VAT,
      lead_time: 'Từ 5 đến 7 ngày kể từ ngày nhận đơn',
    },
  },
  simple: {
    key: 'simple',
    label: 'Đơn giản',
    hint: 'Số lượng × đơn giá — dùng khi hàng không thuộc nhóm nào ở trên',
    priceUnit: null,
    vatRate: 10,
    priceIncludesVat: true,
    hasDiscount: false,
    signerRole: 'TRƯỞNG PHÒNG CUNG ỨNG',
    terms: {
      quality: '',
      delivery_place: DELIVERY_HG,
      payment: '',
      invoice: INVOICE_VAT,
      lead_time: '',
    },
  },
}

export function isPoTemplate(v: unknown): v is PoTemplate {
  return typeof v === 'string' && (PO_TEMPLATES as readonly string[]).includes(v)
}

export function poTemplateMeta(t: PoTemplate | null | undefined): PoTemplateMeta {
  return PO_TEMPLATE_META[t && isPoTemplate(t) ? t : 'simple']
}

/** Các ô người dùng nhập trên dòng, gộp của mọi mẫu (mẫu nào dùng ô nấy). */
export type PoLineDraft = {
  /** SL đặt cuối cùng — luôn theo ĐVT mua (cây / con / tấm / thùng). */
  qty_ordered: number
  /** aluminium */
  weight_per_m?: number | null
  bar_length_m?: number | null
  /** metal_kg */
  weight_per_unit?: number | null
  /** carton */
  area_m2?: number | null
  carton_basis?: 'ctn' | 'm2' | null
}

export type PoLineDerived = {
  qty2: number | null
  unit2: string | null
  price_basis: 'unit' | 'unit2'
}

/** Làm tròn 4 số lẻ — kg/m² lẻ vô hạn (0.1+0.2) in ra phiếu trông như lỗi. */
function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}

/**
 * Dịch ô nhập của mẫu → (qty2, unit2, price_basis) cho `poLineAmount`.
 *
 * Thiếu thông số quy đổi (chưa khai kg/m, chưa nhập dài cây) thì trả 'unit' chứ
 * KHÔNG trả qty2 = 0: dòng sẽ tính theo SL × giá — sai rõ ràng và nhân viên thấy
 * ngay, hơn là im lặng ra thành tiền 0 rồi lọt qua duyệt.
 */
export function deriveLine(t: PoTemplate, l: PoLineDraft): PoLineDerived {
  const qty = Number(l.qty_ordered) || 0
  switch (t) {
    case 'aluminium': {
      const kgPerM = Number(l.weight_per_m) || 0
      const len = Number(l.bar_length_m) || 0
      if (kgPerM <= 0 || len <= 0) return { qty2: null, unit2: null, price_basis: 'unit' }
      return { qty2: round4(kgPerM * len * qty), unit2: 'kg', price_basis: 'unit2' }
    }
    case 'metal_kg': {
      const kg = Number(l.weight_per_unit) || 0
      if (kg <= 0) return { qty2: null, unit2: null, price_basis: 'unit' }
      return { qty2: round4(kg * qty), unit2: 'kg', price_basis: 'unit2' }
    }
    case 'carton': {
      const area = Number(l.area_m2) || 0
      if (l.carton_basis !== 'm2' || area <= 0) {
        return { qty2: null, unit2: null, price_basis: 'unit' }
      }
      return { qty2: round4(area * qty), unit2: 'm²', price_basis: 'unit2' }
    }
    default:
      return { qty2: null, unit2: null, price_basis: 'unit' }
  }
}

/**
 * Diện tích carton (m²/thùng) từ quy cách LỌT LÒNG — công thức lấy đúng từ file
 * bao bì, khác nhau theo cách mở nắp:
 *   AD (nắp âm dương): (D+2C)×(R+2C) + (D+2C+20)×(R+2C+20)
 *   MR (một mảnh):     (D+2C)×(R+2C−10) × 2
 * Cách mở khác / thiếu kích thước → null, nhân viên nhập m² tay theo NCC chào.
 */
export function cartonAreaM2(
  openStyle: string | null | undefined,
  l: number | null | undefined,
  w: number | null | undefined,
  h: number | null | undefined,
): number | null {
  const D = Number(l) || 0
  const R = Number(w) || 0
  const C = Number(h) || 0
  if (D <= 0 || R <= 0 || C <= 0) return null
  const style = (openStyle ?? '').trim().toUpperCase()
  if (style === 'AD') {
    return round4(((D + 2 * C) * (R + 2 * C) + (D + 2 * C + 20) * (R + 2 * C + 20)) / 1e6)
  }
  if (style === 'MR') return round4(((D + 2 * C) * (R + 2 * C - 10) * 2) / 1e6)
  return null
}

/**
 * SL cần đặt gợi ý = nhu cầu − tồn, LÀM TRÒN LÊN. Tồn ≥ nhu cầu → 0 (khỏi đặt).
 *
 * KHÔNG cộng hao hụt (bỏ theo yêu cầu phòng Cung ứng). Trước đây nhân thêm 3%
 * mặc định, nhưng đó là con số áp cứng cho mọi mặt hàng trong khi hao hụt thật
 * khác nhau theo loại — cộng ngầm chỉ làm số gợi ý lệch khỏi thứ người mua tự
 * tính, rồi họ gõ đè, thành ra vô ích.
 *
 * Vẫn chỉ là GỢI Ý, form cho ghi đè tự do: file thật có dòng lệch hẳn công thức
 * vì quy đổi đơn vị lúc đặt (LĐ chẻ lỗ cần 1400 đặt 1000 vì mua theo bó; Vít
 * 4x25 cần 700 đặt 540 vì mua theo bộ).
 */
export function suggestOrderQty(
  demand: number | null | undefined,
  onHand: number | null | undefined,
): number {
  const short = (Number(demand) || 0) - (Number(onHand) || 0)
  if (short <= 0) return 0
  return Math.ceil(short)
}
