/**
 * QUY ĐỔI ĐỊNH MỨC SANG ĐƠN VỊ MUA — logic thuần, có test.
 *
 * VÌ SAO CẦN (đo 05/09/2026, dữ liệu thật): định mức của Kỹ thuật đếm theo CHI
 * TIẾT ("2 thanh diềm ngắn / sản phẩm"), còn Cung ứng mua theo ĐƠN VỊ BÁN của
 * vật tư ("cây" nhôm dài 5–6 m, "kg" long đền, "tấm" cemboard). Trước đây bảng
 * kê lấy thẳng số chi tiết làm số cây:
 *
 *   NH-0009 Nhôm hộp 20x40 — 2 thanh × 1,04 m = 2,08 m/SP
 *   → tính cũ: "2 CÂY/SP"; thật ra 2,08 m ÷ 6 m ≈ 0,35 cây/SP → thừa ~6 lần.
 *
 * Đo trên 15 lệnh đang chạy: 44 dòng định mức trỏ vào vật tư bán theo cây, chỉ
 * 5 dòng có đơn vị trùng — tức phần lớn đang sai. Mua thừa thì tốn tiền và đầy
 * kho; mua thiếu thì dừng chuyền. Cả hai đều không được đoán.
 *
 * NGUYÊN TẮC: quy đổi được thì quy đổi; KHÔNG quy đổi được thì trả `null` kèm
 * lý do, và bảng kê phải nói "chưa tính được" chứ không bịa một con số.
 */

/** Bỏ dấu + gọn khoảng trắng để so đơn vị người ta gõ mỗi nơi một kiểu. */
export function normUnit(u: string | null | undefined): string {
  return (u ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '')
    .replace(/[.]/g, '')
}

/**
 * Đơn vị ĐẾM CHIẾC — coi là tương đương nhau. "cái" và "con" là hai cách gọi
 * cùng một thứ trong sổ của xưởng (vít, tán, bulông); ép chúng khác nhau thì
 * 205/253 dòng định mức bị chặn oan.
 *
 * CỐ Ý không có "bộ": một bộ gồm nhiều cái, coi bằng nhau là sai số lượng.
 */
const COUNT_UNITS = new Set(['cai', 'con', 'chiec', 'pc', 'pcs', 'cay/cai'])

/** Đơn vị bán theo CÂY/THANH — cần chiều dài cây mới quy đổi từ mét được. */
const BAR_UNITS = new Set(['cay', 'thanh', 'ong', 'bar'])

/** Đơn vị theo CHIỀU DÀI. */
const LENGTH_UNITS = new Set(['m', 'met', 'md', 'mdai'])

const WEIGHT_UNITS = new Set(['kg', 'kilogam', 'kilogram'])

const AREA_UNITS = new Set(['m2', 'm²', 'metvuong'])

const VOLUME_UNITS = new Set(['m3', 'm³', 'khoi', 'metkhoi'])

export type PartQuantities = {
  /** Số chi tiết / 1 sản phẩm (cột `qty` của dòng định mức). */
  qty: number | null
  /** Đơn vị người khai định mức ghi trên dòng (có thể trống). */
  unit: string | null
  /** Tổng mét / 1 sản phẩm (đã gồm hao cắt) — `total_length_m`. */
  total_length_m?: number | null
  /** Kg / 1 sản phẩm — `weight_kg`. */
  weight_kg?: number | null
  /** m² / 1 sản phẩm. */
  paint_area_m2?: number | null
  /** m³ / 1 sản phẩm. */
  volume_m3?: number | null
  /** Chiều dài một cây, ưu tiên số khai trên dòng. */
  bar_length_m?: number | null
  /** Hao hụt % khai trên dòng — cộng thêm sau khi quy đổi. */
  waste_pct?: number | null
}

export type MaterialUnitInfo = {
  /** Đơn vị BÁN của vật tư (đơn vị đặt hàng). */
  unit: string
  /** Chiều dài mặc định một cây của vật tư. */
  default_bar_length_m?: number | null
}

export type UnitConversion =
  | {
      ok: true
      /** Số lượng theo ĐƠN VỊ MUA cho 1 sản phẩm. */
      qty_per_unit: number
      /** Cách ra con số đó — hiện trên bảng kê để người mua kiểm lại được. */
      basis: 'count' | 'length_to_bar' | 'length' | 'weight' | 'area' | 'volume'
      /** Câu giải thích ngắn, đúng số liệu của dòng. */
      explain: string
    }
  | {
      ok: false
      /** Vì sao chưa tính được — hiện thẳng trên dòng để ai đó đi bổ sung. */
      reason: string
    }

const pos = (n: number | null | undefined): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n > 0

const round4 = (n: number) => Math.round(n * 10_000) / 10_000

const fmt = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 3 })

/**
 * Đổi một dòng định mức sang đơn vị mua của vật tư, cho 1 SẢN PHẨM.
 *
 * Thứ tự xét đi từ chắc chắn nhất tới suy diễn nhất, và dừng ngay khi có cách
 * đúng: cùng đơn vị đếm → theo kg → theo mét (chia chiều dài cây) → m² → m³.
 */
export function convertPartNeed(
  part: PartQuantities,
  material: MaterialUnitInfo,
): UnitConversion {
  const uDm = normUnit(part.unit)
  const uVt = normUnit(material.unit)
  const waste = pos(part.waste_pct) ? 1 + part.waste_pct / 100 : 1
  const withWaste = (n: number, basis: string) =>
    waste === 1 ? n : Number(n) * waste || 0

  // 1. Cùng đơn vị, hoặc cả hai đều là đơn vị đếm chiếc → dùng thẳng số chi tiết.
  const sameCount =
    uDm !== '' && (uDm === uVt || (COUNT_UNITS.has(uDm) && COUNT_UNITS.has(uVt)))
  if (sameCount) {
    if (!pos(part.qty)) return { ok: false, reason: 'Định mức chưa điền số lượng' }
    const q = round4(withWaste(part.qty, 'count'))
    return {
      ok: true,
      qty_per_unit: q,
      basis: 'count',
      explain: `${fmt(part.qty)} ${material.unit}/SP theo định mức`,
    }
  }

  // 2. Vật tư bán theo KG — dùng khối lượng đã tính sẵn trên dòng.
  if (WEIGHT_UNITS.has(uVt)) {
    if (!pos(part.weight_kg)) {
      return {
        ok: false,
        reason: `Vật tư tính theo ${material.unit} nhưng định mức chưa có khối lượng`,
      }
    }
    const q = round4(withWaste(part.weight_kg, 'weight'))
    return {
      ok: true,
      qty_per_unit: q,
      basis: 'weight',
      explain: `${fmt(part.weight_kg)} kg/SP theo định mức`,
    }
  }

  // 3. Vật tư bán theo CÂY — số cây = tổng mét ÷ chiều dài một cây.
  if (BAR_UNITS.has(uVt)) {
    if (!pos(part.total_length_m)) {
      return {
        ok: false,
        reason: `Vật tư bán theo ${material.unit} nhưng định mức chưa có tổng chiều dài`,
      }
    }
    const bar = pos(part.bar_length_m)
      ? part.bar_length_m
      : pos(material.default_bar_length_m)
        ? material.default_bar_length_m
        : null
    if (bar == null) {
      return {
        ok: false,
        reason: `Chưa khai chiều dài một ${material.unit} của vật tư — không đổi ${fmt(part.total_length_m)} m ra số ${material.unit} được`,
      }
    }
    const q = round4(withWaste(part.total_length_m / bar, 'length_to_bar'))
    return {
      ok: true,
      qty_per_unit: q,
      basis: 'length_to_bar',
      explain: `${fmt(part.total_length_m)} m/SP ÷ ${fmt(bar)} m mỗi ${material.unit}`,
    }
  }

  // 4. Vật tư bán theo MÉT.
  if (LENGTH_UNITS.has(uVt)) {
    if (!pos(part.total_length_m)) {
      return { ok: false, reason: 'Định mức chưa có tổng chiều dài' }
    }
    const q = round4(withWaste(part.total_length_m, 'length'))
    return {
      ok: true,
      qty_per_unit: q,
      basis: 'length',
      explain: `${fmt(part.total_length_m)} m/SP theo định mức`,
    }
  }

  // 5. m² / m³ — dùng số đã tính sẵn, không suy từ kích thước ở đây.
  if (AREA_UNITS.has(uVt)) {
    if (!pos(part.paint_area_m2)) {
      return { ok: false, reason: 'Định mức chưa có diện tích' }
    }
    const q = round4(withWaste(part.paint_area_m2, 'area'))
    return {
      ok: true,
      qty_per_unit: q,
      basis: 'area',
      explain: `${fmt(part.paint_area_m2)} m²/SP`,
    }
  }
  if (VOLUME_UNITS.has(uVt)) {
    if (!pos(part.volume_m3)) {
      return { ok: false, reason: 'Định mức chưa có khối tích' }
    }
    const q = round4(withWaste(part.volume_m3, 'volume'))
    return {
      ok: true,
      qty_per_unit: q,
      basis: 'volume',
      explain: `${fmt(part.volume_m3)} m³/SP`,
    }
  }

  // 6. Đơn vị định mức trống mà vật tư đếm chiếc: coi số chi tiết là số cái —
  // đó là cách đọc duy nhất hợp lý của một dòng "qty = 4" cho con vít.
  if (uDm === '' && COUNT_UNITS.has(uVt)) {
    if (!pos(part.qty)) return { ok: false, reason: 'Định mức chưa điền số lượng' }
    const q = round4(withWaste(part.qty, 'count'))
    return {
      ok: true,
      qty_per_unit: q,
      basis: 'count',
      explain: `${fmt(part.qty)} ${material.unit}/SP (định mức không ghi đơn vị)`,
    }
  }

  return {
    ok: false,
    reason: `Không đổi được đơn vị định mức "${part.unit ?? 'trống'}" sang "${material.unit}"`,
  }
}
