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
  'rattan',
  'paint',
  'chemical',
  'foam',
  'glass',
  'wood',
  'outsourcing',
  'mro',
  'simple',
] as const
export type PoTemplate = (typeof PO_TEMPLATES)[number]

/**
 * Mẫu được dùng DÒNG TỰ DO (0134) — dòng không gắn vật tư kho, tên/ĐVT tự gõ.
 * Đơn gỗ và gia công thật đặt theo MÃ SẢN PHẨM (bàn/ghế), không phải vật tư;
 * các mẫu khác vẫn bắt buộc chọn từ danh mục để tồn kho/giá có chỗ bám.
 */
export const FREE_LINE_TEMPLATES: readonly PoTemplate[] = ['wood', 'outsourcing']

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
    // Cát Tường KHÔNG nằm đây: đơn thật của họ là nhôm TẤM (SL tấm × kg/tấm,
    // LSX 03/26-27) — đúng công thức mẫu "theo kg", không phải kg/m × dài cây.
    hint: 'Đặt theo cây, tính tiền theo kg — Việt ECO, Tiến Đạt, Ngô Sơn, Taiwan, Việt Ý',
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
    label: 'Inox / sắt / tấm theo kg',
    hint: 'Cây, ống, tấm (kể cả nhôm tấm) — cân theo kg/đơn vị. Kim Vĩnh Phú, Hào Tư Hùng, Thông Đạt, Cát Tường',
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
  /*
   * 3 mẫu bổ sung 08/08/2026 — rà thư mục "Hợp đồng mua hàng" trên Drive Cung
   * ứng: mây (7 đơn Vipora/Huy Khánh/Bàn Tay Việt…), sơn (6 đơn Green
   * Coatings/Dosa…), mút-xốp (4 đơn Hà Bắc/Thanh Liên…). Cả ba đều tính
   * SL × đơn giá (không quy đổi) — khác nhau ở BỘ ĐIỀU KHOẢN + cột phụ,
   * trước đây phải gõ tay mỗi lần vì mẫu Đơn giản để trống điều khoản.
   */
  rattan: {
    key: 'rattan',
    label: 'Dây mây / rope',
    hint: 'Đặt theo kg, kèm định mức g/5m — Vipora, Huy Khánh, Bàn Tay Việt, Tân Bình Dương',
    priceUnit: null,
    vatRate: 10,
    priceIncludesVat: false,
    hasDiscount: false,
    signerRole: 'TRƯỞNG PHÒNG KẾ HOẠCH',
    terms: {
      quality: 'Dây đúng mẫu đã duyệt — bảo hành 24 tháng, UV 1.500h',
      delivery_place: DELIVERY_HG,
      payment: 'Đơn giá chưa gồm vận chuyển',
      invoice: INVOICE_VAT,
      // Câu lặp ở HK/BTV/TLH — không phải "theo kế hoạch HG" chung chung.
      lead_time: 'Giao theo kế hoạch — thông báo qua điện thoại hoặc Zalo',
    },
  },
  paint: {
    key: 'paint',
    label: 'Sơn tĩnh điện',
    hint: 'Đặt theo kg, mã màu NCC — Việt Sapa, Green Coatings, Dosa, Đắc Vinh, Tân Nam Phát',
    priceUnit: null,
    vatRate: 8,
    priceIncludesVat: false,
    hasDiscount: false,
    signerRole: 'TRƯỞNG PHÒNG KẾ HOẠCH',
    terms: {
      quality: 'Đúng mã màu, đạt chuẩn ngoài trời theo mẫu đã duyệt',
      delivery_place: DELIVERY_HG,
      // Đơn thật (Dosa, Tân Nam Phát, Nguyễn Hùng) đều TRẢ TRƯỚC; công nợ 30
      // ngày chỉ là riêng Green Coatings — sửa ở form khi đặt NCC đó.
      payment: 'Thanh toán trước khi nhận hàng',
      invoice: INVOICE_VAT,
      // Câu lặp ở Việt Sapa / Đắc Vinh / Tân Nam Phát.
      lead_time: 'Chạy sơn theo kế hoạch — báo trước 5-7 ngày',
    },
  },
  // Hoá chất xử lý (Kiệm Tâm) — CÙNG kg × giá với sơn nhưng khác hẳn điều
  // khoản: công nợ chuyển khoản 30 ngày sau nhận hàng + hoá đơn (sơn trả
  // trước), vận chuyển bên bán / dỡ hàng bên mua tách bạch, giao 2-3 ngày.
  chemical: {
    key: 'chemical',
    label: 'Hoá chất xử lý',
    hint: 'Tẩy dầu, phosphat, cromate — đặt theo kg (can/bao). Kiệm Tâm',
    priceUnit: null,
    vatRate: 8,
    priceIncludesVat: false,
    hasDiscount: false,
    signerRole: 'TRƯỞNG PHÒNG KẾ HOẠCH',
    terms: {
      quality: 'Đúng chủng loại, quy cách can/bao như đơn',
      delivery_place: DELIVERY_HG,
      payment:
        'Chuyển khoản trong vòng 30 ngày kể từ ngày nhận được hàng và hoá đơn GTGT',
      invoice: INVOICE_VAT,
      lead_time:
        'Trong vòng 2-3 ngày kể từ ngày xác nhận đơn — vận chuyển bên bán chịu, dỡ hàng bên mua chịu',
    },
  },
  foam: {
    key: 'foam',
    label: 'Mút / xốp / ván ép',
    // Xốp TẤM tính theo KHỐI (0134 — DDH Tân Hoàng Long "Xốp Casual"): quy cách
    // D×R×Dày → m³, đơn giá/m³, chọn "Tính theo m³" từng dòng. Mút cuộn/ván ép
    // vẫn SL × giá như cũ.
    hint: 'Mút dai, xốp nổ, foam, ván ép — theo cuộn/tấm, xốp tấm tính theo m³. Hà Bắc, Mynh, Thanh Liên, Tân Hoàng Long',
    priceUnit: null,
    vatRate: 10,
    priceIncludesVat: false,
    hasDiscount: false,
    signerRole: 'TRƯỞNG PHÒNG KẾ HOẠCH',
    terms: {
      quality: 'Đúng quy cách, màu sắc theo mẫu đã duyệt',
      delivery_place: DELIVERY_HG,
      payment: 'Công nợ 14 ngày — giá bốc tại kho NCC, chưa gồm vận chuyển',
      invoice: INVOICE_VAT,
      lead_time: 'Từ 3 đến 5 ngày kể từ ngày nhận đơn',
    },
  },
  /*
   * 3 mẫu bổ sung 12/08/2026 — rà bàn giao "A NHÂN" của phòng Cung ứng
   * (docs/phan-tich-cung-ung-tien-te-va-mau-don-a-nhan.md). Điều khoản chép
   * nguyên văn từ đơn thật gần nhất của từng nhóm.
   */
  glass: {
    key: 'glass',
    // DDH KÍNH MAI TRANG: đặt theo TẤM với quy cách mm + m²/tấm, giá theo tấm
    // (có chân phiếu ghi giá gốc /m²) — cùng trục unit2 với bao bì.
    label: 'Kính',
    hint: 'Đặt theo tấm, quy cách mm + m²/tấm — Mai Trang, Nghi Đạt, Vĩnh Khang; giá theo tấm hoặc m²',
    priceUnit: null,
    vatRate: 10,
    priceIncludesVat: true,
    hasDiscount: false,
    signerRole: 'TRƯỞNG PHÒNG KẾ HOẠCH',
    terms: {
      quality: 'Làm đúng mẫu đã duyệt — bo góc, mài cạnh theo yêu cầu trên đơn',
      delivery_place: DELIVERY_HG,
      payment: 'Công nợ 30 ngày kể từ ngày xuất hóa đơn',
      invoice: INVOICE_VAT,
      lead_time: 'Từ 5 đến 7 ngày kể từ ngày đặt hàng',
    },
  },
  wood: {
    key: 'wood',
    // ĐH gỗ Minh Đạt/Thành Đạt/Đức Toàn: dòng là MÃ SẢN PHẨM (dòng tự do),
    // tiền = (m³/SP × SL) × đơn giá/m³ tinh — thường chốt bằng USD. Chọn NCC
    // có tiền tệ USD là ô tiền tệ của form tự chuyển.
    label: 'Gỗ chi tiết theo m³',
    hint: 'Đặt gỗ theo SP — m³/SP × đơn giá/m³ tinh (thường USD) — Minh Đạt, Thành Đạt, Đức Toàn, Tâm Phú',
    priceUnit: 'm³',
    vatRate: 10,
    priceIncludesVat: false,
    hasDiscount: false,
    signerRole: 'TRƯỞNG PHÒNG KẾ HOẠCH',
    terms: {
      quality: 'Bề mặt gỗ không trám trít, không nứt nẻ',
      delivery_place: DELIVERY_HG,
      payment: '',
      invoice: INVOICE_VAT,
      // Đơn thật ghi kế hoạch giao THEO TỪNG DÒNG (cột "Kế hoạch giao hàng").
      lead_time: 'Theo kế hoạch giao hàng ghi ở từng mã trên đơn',
    },
  },
  outsourcing: {
    key: 'outsourcing',
    // "ĐƠN ĐẶT HÀNG GIA CÔNG" — hai biến thể trên đơn thật: công theo SP
    // (đan mây New ISO: 170.000đ/ghế) và công theo kg (hàn sắt Tiến Phước:
    // ĐM 18,91 kg/bộ × 28.000đ/kg). Chọn "Tính theo SP / kg" từng dòng.
    label: 'Gia công ngoài',
    hint: 'Đan mây, hàn/mài sắt-nhôm — công theo SP hoặc theo kg (ĐM kg/SP). New ISO, Tiến Phước, A Dung',
    priceUnit: null,
    vatRate: 10,
    priceIncludesVat: false,
    hasDiscount: false,
    signerRole: 'TRƯỞNG PHÒNG KẾ HOẠCH',
    terms: {
      quality:
        'Gia công đúng mẫu đã duyệt — vật tư do Công ty cung cấp; hàng lỗi yêu cầu chỉnh sửa hoặc gia công lại',
      delivery_place: DELIVERY_HG,
      payment: 'Thanh toán 10-15 ngày kể từ thời điểm nghiệm thu',
      invoice: INVOICE_VAT,
      lead_time: 'Theo kế hoạch Công ty Hoàng Gia',
    },
  },
  /*
   * MRO — PHỤ TÙNG / BẢO TRÌ / BẢO HỘ (10/08/2026). Rà cả danh mục 13.168 mã:
   * 6.892 mã (52%) rơi vào mẫu "Đơn giản", và bóc ra thì hơn 4.300 trong số đó
   * là một HỌ RIÊNG chứ không phải hàng hỗn tạp — dụng cụ/máy/mài 1.320, điện
   * 979, ống-van-khí nén 856, cơ khí-vòng bi-khuôn 667, văn phòng-bảo hộ 468.
   *
   * Trục nghiệp vụ khác hẳn vật tư sản xuất: mua LẺ ngoài LSX, không có định
   * mức/sp nên hai cột "SL đơn hàng · Tồn kho" vô nghĩa. Thứ NCC cần để giao
   * đúng là MODEL/mã hãng, còn thứ phòng cần để đối chiếu về sau là "dùng cho
   * máy nào" và "bảo hành bao lâu" — ba thứ mẫu Đơn giản không có chỗ để ghi.
   *
   * ĐIỀU KHOẢN BÊN DƯỚI LÀ BẢN NHÁP TRUNG TÍNH. Tám mẫu kia chép nguyên văn từ
   * đơn thật; MRO chưa có đơn nào trong thư mục "Hợp đồng mua hàng" để chép,
   * nên đây là câu chữ an toàn để phòng sửa dần — đừng coi là đã chốt.
   */
  mro: {
    key: 'mro',
    label: 'Phụ tùng / bảo trì / bảo hộ',
    hint: 'Dụng cụ, điện, khí nén, vòng bi, bảo hộ — mua lẻ ngoài LSX, không định mức',
    priceUnit: null,
    vatRate: 10,
    priceIncludesVat: false,
    hasDiscount: false,
    signerRole: 'TRƯỞNG PHÒNG CUNG ỨNG',
    terms: {
      quality: 'Hàng mới 100%, đúng model / mã hãng đã chào',
      delivery_place: DELIVERY_HG,
      payment: 'Chuyển khoản sau khi nhận đủ hàng và hoá đơn',
      invoice: INVOICE_VAT,
      lead_time: 'Theo thời gian NCC xác nhận trên báo giá',
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
  /** metal_kg · outsourcing (ĐM kg/SP) · wood (m³/SP — mượn cùng ô). */
  weight_per_unit?: number | null
  /** carton · glass (m²/tấm) */
  area_m2?: number | null
  /** foam tính theo m³: quy cách D×R×Dày (mm) — dùng chung bộ ô lọt lòng. */
  inner_l_mm?: number | null
  inner_w_mm?: number | null
  inner_h_mm?: number | null
  /** Cơ sở tính tiền dòng: thùng/SP/tấm · m² · m³ (xốp) · kg (gia công). */
  carton_basis?: 'ctn' | 'm2' | 'm3' | 'kg' | null
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
    case 'carton':
    // Kính đi cùng công thức bao bì: giá theo TẤM (unit) hoặc theo m²/tấm × SL.
    case 'glass': {
      const area = Number(l.area_m2) || 0
      if (l.carton_basis !== 'm2' || area <= 0) {
        return { qty2: null, unit2: null, price_basis: 'unit' }
      }
      return { qty2: round4(area * qty), unit2: 'm²', price_basis: 'unit2' }
    }
    case 'wood': {
      // weight_per_unit mượn làm m³/SP ("Khối lượng Gỗ" trên đơn thật) —
      // tiền = (m³/SP × SL) × đơn giá/m³ tinh.
      const m3 = Number(l.weight_per_unit) || 0
      if (m3 <= 0) return { qty2: null, unit2: null, price_basis: 'unit' }
      return { qty2: round4(m3 * qty), unit2: 'm³', price_basis: 'unit2' }
    }
    case 'outsourcing': {
      // Hai biến thể: công theo SP (mặc định, SL × đơn giá) và công theo kg
      // (ĐM kg/SP × SL × đơn giá/kg) — người soạn chốt từng dòng bằng ô basis.
      const kg = Number(l.weight_per_unit) || 0
      if (l.carton_basis !== 'kg' || kg <= 0) {
        return { qty2: null, unit2: null, price_basis: 'unit' }
      }
      return { qty2: round4(kg * qty), unit2: 'kg', price_basis: 'unit2' }
    }
    case 'foam': {
      // Xốp tấm theo KHỐI: D×R×Dày (mm) → m³/tấm × SL tấm × đơn giá/m³.
      // Tròn 6 lẻ chứ không 4: một tấm xốp mỏng chỉ ~0,014 m³ — tròn 4 lẻ là
      // đổi 0,013984 thành 0,014, lệch 9đ/tấm × nghìn tấm thành số thấy được.
      if (l.carton_basis !== 'm3') return { qty2: null, unit2: null, price_basis: 'unit' }
      const m3 = foamM3PerSheet(l.inner_l_mm, l.inner_w_mm, l.inner_h_mm)
      if (m3 == null) return { qty2: null, unit2: null, price_basis: 'unit' }
      return {
        qty2: Math.round(m3 * qty * 1e6) / 1e6,
        unit2: 'm³',
        price_basis: 'unit2',
      }
    }
    default:
      return { qty2: null, unit2: null, price_basis: 'unit' }
  }
}

/**
 * m³ của MỘT TẤM xốp từ quy cách D×R×Dày (mm) — đơn thật (Tân Hoàng Long) ghi
 * "Quy cách(mm) Dài/Rộng/Dày → TỔNG SỐ KHỐI". Thiếu số nào trả null để dòng rơi
 * về SL × giá (sai thấy ngay) chứ không im lặng ra 0 khối.
 */
export function foamM3PerSheet(
  l: number | null | undefined,
  w: number | null | undefined,
  t: number | null | undefined,
): number | null {
  const D = Number(l) || 0
  const R = Number(w) || 0
  const T = Number(t) || 0
  if (D <= 0 || R <= 0 || T <= 0) return null
  // round6 chứ không round4: tấm xốp mỏng ~0,004 m³ — 4 số lẻ là mất sạch số.
  return Math.round(((D * R * T) / 1e9) * 1e6) / 1e6
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
