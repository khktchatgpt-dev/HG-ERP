/**
 * Tính đại lượng dẫn xuất của một dòng định mức khung từ HÌNH HỌC.
 *
 * Trong file BOM gốc (biểu mẫu HG-QT-07/M02) các cột "Tổng chiều dài", "Trọng
 * lượng", "Diện tích sơn" là CÔNG THỨC Excel. Nhập trên app mà bắt kỹ thuật tự
 * bấm máy tính là bước lùi, nên tính lại ở đây.
 *
 * Đã đối chiếu 3.000 dòng khung đã nạp: tổng chiều dài khớp 95%, trọng lượng
 * 72%, diện tích sơn 74%. Phần lệch có lý do thật (profile gân, hợp kim khác,
 * hoặc lấy theo bảng cân của NCC) — nên kết quả ở đây là GỢI Ý MẶC ĐỊNH, người
 * dùng ghi đè được, và UI cảnh báo khi số nhập lệch nhiều so với hình học.
 */

/** Khối lượng riêng kg/m³. */
export const MATERIAL_DENSITY: Record<string, number> = {
  AL: 2700, // nhôm
  IR: 7850, // sắt / thép
  IN: 7930, // inox
}

/**
 * Dạng profile tính được tiết diện. OVAN cố ý KHÔNG có: coi ovan là hình chữ
 * nhật chỉ khớp 1/13 dòng thực tế, thà để trống còn hơn đưa số sai. Mã khuôn ép
 * (PF) có tiết diện tuỳ ý nên cũng không tính được.
 */
export const CALCULABLE_SHAPES = ['HOP', 'VUONG', 'TRON', 'TRONDAC', 'LA', 'TAM'] as const
export type CalcShape = (typeof CALCULABLE_SHAPES)[number]

export const isCalculable = (shape: string | null | undefined): shape is CalcShape =>
  !!shape && (CALCULABLE_SHAPES as readonly string[]).includes(shape)

/** Dạng profile: mã dùng trong DB + nhãn tiếng Việt để hiện và để dán vào. */
export const SHAPE_OPTIONS: { code: string; label: string }[] = [
  { code: 'HOP', label: 'Hộp' },
  { code: 'TRON', label: 'Tròn' },
  { code: 'TRONDAC', label: 'Tròn đặc' },
  { code: 'VUONG', label: 'Vuông' },
  { code: 'LA', label: 'La' },
  { code: 'OVAN', label: 'Ovan' },
  { code: 'TAM', label: 'Tấm' },
  { code: 'LUOI', label: 'Lưới' },
  { code: 'V', label: 'V' },
  { code: 'C', label: 'C' },
  { code: 'L', label: 'L' },
  { code: 'PF', label: 'Profile (mã khuôn)' },
]

const noAccent = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').trim().toLowerCase()

/**
 * Đọc dạng profile từ chữ người gõ / dán từ Excel: "Hộp", "hop", "TRÒN",
 * "Tole" → mã DB. Trả null nếu không nhận ra (để người dùng tự chọn).
 */
export function parseShape(text: string | null | undefined): string | null {
  const s = noAccent(String(text ?? '')).replace(/\s+/g, ' ')
  if (!s) return null
  if (/^ho?p$/.test(s)) return 'HOP'
  if (/^tron dac$/.test(s)) return 'TRONDAC'
  if (/^(tron( rong)?|phi|ong)$/.test(s)) return 'TRON'
  if (/^vuong$/.test(s)) return 'VUONG'
  if (/^la$/.test(s)) return 'LA'
  if (/^ov(a|al)n?$/.test(s)) return 'OVAN'
  // "Tole" và "… tấm" trong file BOM đều là thép/nhôm tấm.
  if (/^(tole|tol|tam)$/.test(s) || /\btam$/.test(s)) return 'TAM'
  if (/^luoi$/.test(s)) return 'LUOI'
  if (/^v( ?\d|$)/.test(s)) return 'V'
  if (/^c$/.test(s)) return 'C'
  if (/^l$/.test(s)) return 'L'
  return null
}

const pos = (v: number | null | undefined): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v > 0

/**
 * Tiết diện vật liệu (m²) — phần ĐẶC của mặt cắt, tức trừ lòng ống.
 * `a`,`b`,`wall` tính bằng mm. Thiếu dữ liệu → null.
 */
export function crossSectionM2(
  shape: string | null | undefined,
  a: number | null | undefined,
  b: number | null | undefined,
  wall: number | null | undefined,
): number | null {
  if (!isCalculable(shape)) return null
  const mm2ToM2 = (v: number) => v / 1e6

  if (shape === 'TRONDAC') return pos(a) ? mm2ToM2((Math.PI / 4) * a * a) : null

  if (shape === 'TRON') {
    if (!pos(a)) return null
    if (!pos(wall)) return mm2ToM2((Math.PI / 4) * a * a) // không khai thành = đặc
    const inner = Math.max(a - 2 * wall, 0)
    return mm2ToM2((Math.PI / 4) * (a * a - inner * inner))
  }

  if (shape === 'VUONG') {
    if (!pos(a)) return null
    if (!pos(wall)) return mm2ToM2(a * a)
    const inner = Math.max(a - 2 * wall, 0)
    return mm2ToM2(a * a - inner * inner)
  }

  if (shape === 'HOP') {
    if (!pos(a) || !pos(b)) return null
    if (!pos(wall)) return mm2ToM2(a * b)
    const x = Math.max(a - 2 * wall, 0)
    const y = Math.max(b - 2 * wall, 0)
    return mm2ToM2(a * b - x * y)
  }

  // La (thanh dẹt) và Tấm: đặc, tiết diện = dày × rộng. Biểu mẫu BOM mới lấy dày
  // từ cột "Dày vật liệu (δ)" chứ không phải cột "Dày" của quy cách tinh — dòng
  // tole 1.2 × 50 khai Dày=1.2 ở δ, còn cột Dày để trống. Ưu tiên δ, thiếu mới
  // rơi về cột Dày.
  const thick = pos(wall) ? wall : a
  return pos(thick) && pos(b) ? mm2ToM2(thick * b) : null
}

/** Chu vi mặt ngoài (m) — dùng tính diện tích sơn. */
export function perimeterM(
  shape: string | null | undefined,
  a: number | null | undefined,
  b: number | null | undefined,
): number | null {
  if (!isCalculable(shape)) return null
  if (shape === 'TRON' || shape === 'TRONDAC') return pos(a) ? (Math.PI * a) / 1000 : null
  if (shape === 'VUONG') return pos(a) ? (4 * a) / 1000 : null
  return pos(a) && pos(b) ? (2 * (a + b)) / 1000 : null
}

export type PartGeometry = {
  profile_shape?: string | null
  material_kind?: string | null
  dim_a_mm?: number | null
  dim_b_mm?: number | null
  wall_thickness_mm?: number | null
  cut_length_mm?: number | null
  /** "Phi hao chi tiết uốn" (mm) — chi tiết uốn cong tốn thêm phôi. */
  bend_waste_mm?: number | null
  /** "Mộng" (mm) của khối gỗ/nệm — cộng vào chiều dài khi tính DT và m³. */
  tenon_mm?: number | null
  /** Profile tra bảng kg/m (vd TD-HG04 = 0.260) — thắng phép tính hình học. */
  kg_per_m?: number | null
  qty?: number | null
}

export type PartDerived = {
  /** "Tổng chiều dài (m)" = (dài cắt + phi hao uốn) × SL / 1000. */
  total_length_m: number | null
  weight_kg: number | null
  /** DT bề mặt theo chu vi THẬT (ống tròn = π·Ø). Cột chính. */
  paint_area_m2: number | null
  /**
   * DT theo công thức của biểu mẫu — chu vi hình hộp `(Dày+Rộng)×2` áp cho MỌI
   * dạng, kể cả ống tròn. Giữ để đối chiếu với bảng kê giấy xưởng đang ký
   * (quyết định D2); ống Ø16 ra 64 mm thay vì 50,3 mm, dư 27%.
   */
  paint_area_box_m2: number | null
  /** "K. Lượng (m3)" của khối gỗ/nệm. */
  volume_m3: number | null
}

const round = (v: number, d: number) => {
  const f = 10 ** d
  return Math.round(v * f) / f
}

/**
 * Tính mọi đại lượng dẫn xuất. Trường nào không đủ dữ liệu thì để null.
 *
 * Hai chiều dài KHÁC NHAU, đúng như biểu mẫu:
 *   · `totalM` (dài + phi hao uốn) — dùng cho tổng chiều dài và khối lượng, vì
 *     phần phôi uốn hao vẫn phải mua.
 *   · `faceM`  (dài + mộng, KHÔNG có phi hao) — dùng cho diện tích và m³, vì bề
 *     mặt sơn tính trên chi tiết thành phẩm chứ không trên phôi.
 */
export function calcPartDerived(p: PartGeometry): PartDerived {
  const len = pos(p.cut_length_mm) ? p.cut_length_mm : null
  const qty = pos(p.qty) ? p.qty : null
  const bend = pos(p.bend_waste_mm) ? p.bend_waste_mm : 0
  const tenon = pos(p.tenon_mm) ? p.tenon_mm : 0

  const totalM = len != null && qty != null ? ((len + bend) / 1000) * qty : null
  const faceM = len != null && qty != null ? ((len + tenon) / 1000) * qty : null

  // Profile tra bảng kg/m (TD-HG04 = 0.260 kg/m) thắng phép tính hình học: đó là
  // thanh định hình có gân, tiết diện không suy ra từ 3 kích thước bao được.
  const area = crossSectionM2(
    p.profile_shape,
    p.dim_a_mm,
    p.dim_b_mm,
    p.wall_thickness_mm,
  )
  const rho = p.material_kind ? MATERIAL_DENSITY[p.material_kind] : undefined
  const weight = pos(p.kg_per_m)
    ? totalM != null
      ? p.kg_per_m * totalM
      : null
    : area != null && totalM != null && rho != null
      ? area * totalM * rho
      : null

  // Chu vi hình hộp — không cần biết dạng, nên tính được cho cả dòng gỗ/nệm (là
  // đúng: khối gỗ trong biểu mẫu không có cột "Loại").
  const boxPer =
    pos(p.dim_a_mm) && pos(p.dim_b_mm) ? (2 * (p.dim_a_mm + p.dim_b_mm)) / 1000 : null
  const paintBox = boxPer != null && faceM != null ? boxPer * faceM : null

  // Chu vi THẬT chỉ khác chu vi hộp ở profile tròn. Chi tiết KHÔNG khai dạng
  // (gỗ, nệm, vải — biểu mẫu không cho các khối đó cột "Loại") vốn là khối chữ
  // nhật, nên chu vi hộp CHÍNH LÀ chu vi thật. Trả null ở đây thì cột "Diện Tích
  // (m2)" của khối gỗ/nệm trống trơn dù biểu mẫu gốc có số.
  const per = perimeterM(p.profile_shape, p.dim_a_mm, p.dim_b_mm)
  const paint =
    per != null && faceM != null ? per * faceM : !p.profile_shape ? paintBox : null

  // m³ chỉ có nghĩa với chi tiết ĐẶC khai theo 3 kích thước (gỗ, nệm, vải) — các
  // dòng đó trong biểu mẫu không có cột "Loại", nên `profile_shape` rỗng là dấu
  // hiệu nhận biết. Dòng khung có dạng thì để null, tránh đẻ cột m³ thừa.
  const volume =
    !p.profile_shape && pos(p.dim_a_mm) && pos(p.dim_b_mm) && faceM != null
      ? ((p.dim_a_mm * p.dim_b_mm) / 1e6) * faceM
      : null

  return {
    total_length_m: totalM == null ? null : round(totalM, 4),
    weight_kg: weight == null ? null : round(weight, 6),
    paint_area_m2: paint == null ? null : round(paint, 6),
    paint_area_box_m2: paintBox == null ? null : round(paintBox, 6),
    volume_m3: volume == null ? null : round(volume, 8),
  }
}

/**
 * Độ lệch tương đối giữa số người nhập và số tính từ hình học (0.05 = lệch 5%).
 * null = không so được. UI dùng để cảnh báo "số nhập khác hình học".
 */
export function deviation(
  entered: number | null,
  computed: number | null,
): number | null {
  if (entered == null || computed == null) return null
  if (computed === 0) return entered === 0 ? 0 : null
  return Math.abs(entered - computed) / Math.abs(computed)
}
