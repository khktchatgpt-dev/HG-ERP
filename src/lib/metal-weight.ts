/**
 * BAREM kg/m CHO SẮT · INOX · NHÔM — suy từ quy cách nằm trong TÊN vật tư.
 *
 * BẢN GỐC DUY NHẤT. `scripts/metal-weight.mjs` import thẳng file này (Node 24
 * chạy được .ts nhờ type-stripping) — đừng chép lại công thức sang chỗ khác,
 * hai bản lệch nhau nghĩa là barem trên đơn khác barem đã backfill vào danh mục.
 *
 * Vì sao cần: mẫu đơn `metal_kg` tính tiền = (SL × kg/đơn-vị) × giá/kg, mẫu
 * `aluminium` = (kg/m × dài cây × số cây) × giá/kg. Không có barem thì mỗi dòng
 * đơn phải tra sổ tay rồi gõ lại — mà số gõ tay thì không ai kiểm.
 *
 * Công thức và tỷ trọng lấy đúng của xưởng — sheet `WeightList` trong
 * `Data/QC BÀN 150 NAN POLYWOOD.xlsx`:
 *
 *   ống/hộp/vuông rỗng : (chu vi trung bình × dày) × tỷ trọng
 *   la (thanh đặc)      : (rộng × dày) × tỷ trọng
 *   tròn đặc            : (π r²) × tỷ trọng
 *   tròn rỗng           : π × (R² − r²) × tỷ trọng
 *
 * CHỈ TÍNH KHI ĐỌC ĐƯỢC ĐỦ SỐ. Tên thiếu độ dày ("Sắt hộp 20x40") thì trả null
 * kèm lý do — đoán độ dày là ra sai số tiền, mà đây là số đi thẳng vào đơn đặt.
 */

/**
 * kg/m³ dùng để tính.
 *
 * SẮT = 7968 chứ KHÔNG phải 7850 như ô "tỷ trọng" ghi trong sheet WeightList:
 * suy ngược từ chính BAREM xưởng đang dùng trong file QC thì ra 7968, khớp tuyệt
 * đối cả ba mẫu thử —
 *   vuông 30×30×0.8 → 93,44 mm² → 0,7445 kg/m  (file ghi 0,7445)
 *   vuông 25×25×0.8 → 77,44 mm² → 0,6170       (file ghi 0,6170)
 *   la 40×1         → 40,00 mm² → 0,3187       (file ghi 0,3187)
 * Lấy 7850 thì mọi dòng thấp hơn xưởng 1,5% — đặt hàng theo kg là thiếu hàng.
 */
export const RHO = { sat: 7968, inox: 7930, nhom: 2750 } as const

export type MetalKind = keyof typeof RHO

export type KgPerMResult = {
  /** kg/m tính được, hoặc null khi không đủ dữ kiện. */
  kg: number | null
  /** Vì sao bỏ qua — hiện thẳng cho người dùng, không nuốt. */
  reason?: string
}

function nod(s: string | null | undefined): string {
  return (
    String(s ?? '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/gi, 'd')
      .toLowerCase()
      // DẤU PHẨY THẬP PHÂN trước đã: "50x100x1,8li" mà đổi phẩy thành khoảng trắng
      // thì độ dày đọc ra 8 thay vì 1,8 — sai gần 7 lần khối lượng.
      .replace(/(\d),(\d)/g, '$1.$2')
      .replace(/[,;]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  )
}

/**
 * Hàng TẤM / CUỘN / LƯỚI bán theo tấm hoặc theo kg, KHÔNG theo mét dài — barem
 * kg/m vô nghĩa. Tên còn hay mang mã mác thép ("Tole 3li - Inox 304") mà 304 bị
 * đọc nhầm thành chiều rộng 304mm → 7,3 kg/m cho một tấm tole.
 */
function isSheet(s: string): boolean {
  return /\btam\b|\bton\b|\btole\b|\bcuon\b|\bluoi\b|kho \d/.test(s)
}

/** Như trên, nhận tên nguyên văn (còn dấu) — dùng khi chỉ cần phân loại. */
export function isSheetLike(name: string): boolean {
  return isSheet(nod(name))
}

function num(v: string): number | null {
  const n = parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/**
 * Chọn tỷ trọng theo TÊN trước, nhóm sau.
 *
 * Danh mục có mã xếp sai nhóm (đã gặp "Sắt la 5x20" nằm nhóm Nhôm). Tên nói vật
 * liệu gì thì tin tên: tính nhôm bằng tỷ trọng sắt là sai gần 3 lần.
 */
export function rhoFor(name: string, groupName?: string | null): number {
  const s = nod(name)
  if (/\bnhom\b|aluminium/.test(s)) return RHO.nhom
  if (/\binox\b|\bssus\b|\bsus\b/.test(s)) return RHO.inox
  const g = nod(groupName)
  if (g === 'nhom') return RHO.nhom
  if (g === 'inox') return RHO.inox
  return RHO.sat
}

/**
 * Đọc quy cách từ tên → kg/m.
 * Trả `kg: null` khi không đủ dữ kiện; `reason` để biết vì sao bỏ qua.
 */
export function kgPerM(name: string, rho: number): KgPerMResult {
  const s = nod(name)
    .replace(/[x×*]/g, 'x')
    .replace(/\bphi\b|ø|\bf(?=\d)/g, 'phi')
  // Bỏ phần đuôi mô tả (màu, mạ kẽm, tên hàng) để số không lẫn.
  const nums = (s.match(/\d+(?:\.\d+)?/g) ?? []).map(Number)

  if (isSheet(s)) return { kg: null, reason: 'hàng tấm/cuộn — không tính theo mét' }

  const isTron = /\bphi\b|\btron\b|\bong\b/.test(s) && !/hop|vuong/.test(s)
  const isLa = /\bla\b/.test(s)
  const isHopVuong = /\bhop\b|\bvuong\b/.test(s)

  // Độ dày viết kiểu "dày 1.2", "1.2li", "x1.2" ở cuối, hoặc "T1.2".
  const dayHit =
    s.match(/day\s*(\d+(?:\.\d+)?)/) ??
    s.match(/(\d+(?:\.\d+)?)\s*(?:li|ly)\b/) ??
    s.match(/\bt\s*(\d+(?:\.\d+)?)\b/)
  const day = dayHit ? num(dayHit[1]) : null

  const mm2ToKgM = (mm2: number) => +((mm2 / 1e6) * rho).toFixed(4)

  if (isHopVuong) {
    // "hộp 20x40x1" · "vuông 25x25x0.8" · "hộp 20x40 dày 1li" · "vuông 60x1.2li"
    const dims = nums.filter((n) => n >= 5 && n <= 400)
    // "Vuông 60x1.2" = 60×60 dày 1.2 — vuông chỉ ghi MỘT cạnh là chuyện thường.
    if (dims.length === 1 && /vuong/.test(s)) dims.push(dims[0])
    if (dims.length < 2) return { kg: null, reason: 'thiếu tiết diện' }
    const [a, b] = dims
    // Độ dày = số nhỏ (<5mm) còn lại sau khi lấy hai cạnh — "Hộp 25x50x1" không
    // ghi "li" nhưng số 1 vẫn là độ dày, bỏ qua thì mất gần nửa danh mục.
    const rest = nums.filter((n) => n > 0 && n < 5)
    const t = day ?? rest[rest.length - 1] ?? null
    if (!t) return { kg: null, reason: 'thiếu độ dày' }
    // Chu vi trung bình của ống chữ nhật rỗng: 2(a+b) − 4t
    return { kg: mm2ToKgM((2 * (a + b) - 4 * t) * t) }
  }
  if (isTron) {
    const d = nums.find((n) => n >= 4 && n <= 300)
    if (!d) return { kg: null, reason: 'thiếu đường kính' }
    if (/dac\b/.test(s)) return { kg: mm2ToKgM(Math.PI * (d / 2) ** 2) }
    // "Phi 25x1" — số nhỏ đi sau đường kính là độ dày dù không ghi "li".
    const t = day ?? nums.filter((n) => n > 0 && n < 5).pop() ?? null
    if (!t) return { kg: null, reason: 'thiếu độ dày' }
    const r = d / 2
    return { kg: mm2ToKgM(Math.PI * (r ** 2 - (r - t) ** 2)) }
  }
  if (isLa) {
    // "la 40x3" · "sắt la 20x2li" · "tole 1.2x131"
    const dims = nums.filter((n) => n > 0 && n <= 400)
    if (dims.length < 2) return { kg: null, reason: 'thiếu tiết diện' }
    const t = day ?? Math.min(...dims.slice(0, 2))
    const w = Math.max(...dims.slice(0, 2))
    if (!t || !w || t >= w) return { kg: null, reason: 'không rõ dày/rộng' }
    return { kg: mm2ToKgM(w * t) }
  }
  return { kg: null, reason: 'không nhận ra hình dạng' }
}

/**
 * kg cho MỘT ĐƠN VỊ ĐẶT (mẫu `metal_kg` nhân số này với SL).
 *
 * `kg_per_m` là barem theo MÉT DÀI, còn đơn đặt theo CÂY/THANH — hai số khác
 * nhau: inox Kim Vĩnh Phú là 9,325 kg/cây, tức ~1,55 kg/m cho cây 6 m. Điền
 * thẳng kg/m vào ô kg/đơn-vị là đơn hụt 6 lần.
 *
 * Vì thế CHỈ suy khi biết chắc:
 *   · ĐVT là mét  → kg/đơn-vị = kg/m
 *   · ĐVT là cây/thanh VÀ vật tư đã khai dài cây → kg/m × dài cây
 * Không khai dài cây thì trả null — mặc định 6 m là đoán, mà đoán ở đây ra sai
 * số tiền đi thẳng bàn duyệt.
 */
export function kgPerOrderUnit(
  kgPerMetre: number | null | undefined,
  unit: string | null | undefined,
  barLengthM: number | null | undefined,
): number | null {
  const kg = Number(kgPerMetre)
  if (!Number.isFinite(kg) || kg <= 0) return null
  const u = nod(unit)
  if (u === 'm' || u === 'met' || u === 'met dai') return +kg.toFixed(4)
  const len = Number(barLengthM)
  if (!Number.isFinite(len) || len <= 0) return null
  return +(kg * len).toFixed(4)
}
