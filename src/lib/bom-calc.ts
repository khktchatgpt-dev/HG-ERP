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

  // La (thanh dẹt) và Tấm: đặc, tiết diện = dày × rộng.
  return pos(a) && pos(b) ? mm2ToM2(a * b) : null
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
  qty?: number | null
}

export type PartDerived = {
  /** Tổng chiều dài phôi (m) = dài cắt × số lượng. */
  total_length_m: number | null
  weight_kg: number | null
  paint_area_m2: number | null
}

const round = (v: number, d: number) => {
  const f = 10 ** d
  return Math.round(v * f) / f
}

/** Tính cả 3 đại lượng. Trường nào không đủ dữ liệu thì để null. */
export function calcPartDerived(p: PartGeometry): PartDerived {
  const len = pos(p.cut_length_mm) ? p.cut_length_mm : null
  const qty = pos(p.qty) ? p.qty : null
  const totalM = len != null && qty != null ? (len / 1000) * qty : null

  const area = crossSectionM2(
    p.profile_shape,
    p.dim_a_mm,
    p.dim_b_mm,
    p.wall_thickness_mm,
  )
  const rho = p.material_kind ? MATERIAL_DENSITY[p.material_kind] : undefined
  const weight =
    area != null && totalM != null && rho != null ? area * totalM * rho : null

  const per = perimeterM(p.profile_shape, p.dim_a_mm, p.dim_b_mm)
  const paint = per != null && totalM != null ? per * totalM : null

  return {
    total_length_m: totalM == null ? null : round(totalM, 4),
    weight_kg: weight == null ? null : round(weight, 6),
    paint_area_m2: paint == null ? null : round(paint, 6),
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
