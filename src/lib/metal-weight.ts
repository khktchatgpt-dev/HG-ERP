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
  // `\btam\b` KHÔNG được ăn "tam giác": bỏ dấu xong "tấm" và "tam" trùng nhau,
  // nên "Pát tam giác inox 304" bị xếp thành hàng tấm (thấy trên form đặt hàng
  // 10/08/2026 — ô kg/đơn-vị báo "hàng tấm/cuộn" cho một cái pát).
  //
  // Vẫn khớp theo dạng KHÔNG DẤU chứ không đổi sang khớp có dấu: danh mục có mã
  // gõ thiếu dấu ("inox tam 304"), mà bỏ sót một tấm thật thì `kgPerM` đi tính
  // như thanh đặc và đọc "304" thành chiều rộng — ra 7,3 kg/m cho một tấm tole.
  // Sót thì chỉ mất gợi ý; nhận nhầm thì ra số tiền sai.
  return /\btam\b(?!\s*giac)|\bton\b|\btole\b|\bcuon\b|\bluoi\b|kho \d/.test(s)
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
 * TIẾT DIỆN phải đọc từ CẶP "AxB", không phải "hai số đầu tiên trong tên".
 *
 * "Hộp inox sus 304 25x50x1.2": số đầu tiên là MÁC THÉP. Lấy hai số đầu ra
 * (304, 25) → 6,216 kg/m thay vì 1,38 — sai 4,5 lần, và đây là số nhân với đơn
 * giá/kg rồi lên bàn duyệt. Bắt lỗi được nhờ nút tra barem trên form đặt hàng
 * (10/08/2026); trước đó script backfill danh mục cũng ăn đúng lỗi này.
 *
 * Nhận cặp đầu tiên mà CẢ HAI số nằm trong khoảng cạnh hợp lệ — "60x1.2li" thì
 * 1.2 là độ dày nên cặp bị loại, rơi xuống nhánh vuông-một-cạnh.
 */
function sectionDims(s: string, nums: number[], min = 5): number[] {
  const inRange = (n: number) => n >= min && n <= 400
  for (const m of s.matchAll(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/g)) {
    const a = num(m[1])
    const b = num(m[2])
    if (a != null && b != null && inRange(a) && inRange(b)) return [a, b]
  }
  const loose = nums.filter(inRange)
  return loose.length === 1 ? loose : []
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
    const inRange = (n: number) => n >= 5 && n <= 400
    const dims = sectionDims(s, nums)
    // "Vuông 60x1.2" = 60×60 dày 1.2 — vuông chỉ ghi MỘT cạnh là chuyện thường.
    if (dims.length === 1 && /vuong/.test(s)) dims.push(dims[0])
    if (dims.length < 2) {
      const loose = nums.filter(inRange)
      // Có nhiều số hợp lệ mà không số nào đi theo cặp "AxB" → không đoán.
      return {
        kg: null,
        reason: loose.length > 1 ? 'không rõ tiết diện' : 'thiếu tiết diện',
      }
    }
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
    // Đường kính là số ĐI NGAY SAU "phi" khi có — "Inox 201 phi 25x1" mà quét
    // số đầu tiên trong khoảng thì ăn phải mác thép 201.
    const afterPhi = s.match(/phi\s*(\d+(?:\.\d+)?)/)
    const d = (afterPhi ? num(afterPhi[1]) : null) ?? nums.find((n) => n >= 4 && n <= 300)
    if (!d) return { kg: null, reason: 'thiếu đường kính' }
    if (/dac\b/.test(s)) return { kg: mm2ToKgM(Math.PI * (d / 2) ** 2) }
    // "Phi 25x1" — số nhỏ đi sau đường kính là độ dày dù không ghi "li".
    const t = day ?? nums.filter((n) => n > 0 && n < 5).pop() ?? null
    if (!t) return { kg: null, reason: 'thiếu độ dày' }
    const r = d / 2
    return { kg: mm2ToKgM(Math.PI * (r ** 2 - (r - t) ** 2)) }
  }
  if (isLa) {
    // "la 40x3" · "sắt la 20x2li" — cặp "AxB", không phải hai số đầu tên: "La
    // inox 304 40x3" mà quét thoáng thì ra bản rộng 304 dày 40.
    const dims = sectionDims(s, [], 0.01)
    if (dims.length < 2) return { kg: null, reason: 'thiếu tiết diện' }
    const t = day ?? Math.min(...dims)
    const w = Math.max(...dims)
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
 *   · ĐVT là KG   → 1 (SL đặt đã là kg rồi, không nhân gì nữa)
 *   · ĐVT là mét  → kg/đơn-vị = kg/m
 *   · ĐVT là cây/thanh VÀ vật tư đã khai dài cây → kg/m × dài cây
 * Không khai dài cây thì trả null — mặc định 6 m là đoán, mà đoán ở đây ra sai
 * số tiền đi thẳng bàn duyệt.
 *
 * ĐVT KG là ca dễ trượt nhất. Trước 10/08/2026 nhánh này rơi thẳng xuống
 * "kg/m × dài cây": "Nhôm la 5x50" bán theo KG mà vẫn khai kg/m 0,6773 và dài
 * cây 6 m, nên ô kg/đơn-vị tự điền 4,0638 → đặt 100 kg thành tiền tính trên
 * 406 kg, gấp hơn 4 lần. Danh mục có 3 mã như vậy (nhôm la NHO0127/0128/0129).
 */
/** Nguồn của con số kg/đơn-vị — hiện thẳng để người mua biết đang tin cái gì. */
export type KgPerUnitSource = 'cân thật' | 'danh mục (giá/kg)' | 'barem'

/**
 * CHỌN kg/ĐƠN-VỊ-ĐẶT CHO MỘT VẬT TƯ — một chỗ quyết, ba nguồn xếp theo độ tin.
 *
 *   1. `kg_per_unit`  — số CÂN THẬT khai ở danh mục (kg/tấm, kg/cuộn, kg/cây).
 *   2. `unit2_factor` khi `price_unit = 'kg'` — giá đơn vị kép của danh mục
 *      (0053): "giá theo kg, 1 ĐVT = 23,94 kg". Vẫn là số người khai, và đối
 *      chiếu 110 mã có đủ cả hai thì nó thường THẤP hơn barem 7-14% — đúng dung
 *      sai âm của thép Việt Nam, tức nó là số cân thật NCC chào.
 *   3. Suy từ barem `kg/m × dài cây` — chỉ dùng khi hai nguồn trên trống.
 *
 * Trước 10/08/2026 form đặt hàng bỏ qua hẳn nguồn 2, nên 82 mã có khai đủ ở
 * danh mục vẫn ra ô trống và người mua phải gõ lại.
 *
 * `barem` trả kèm để form đối chiếu: lệch nhiều thường là dài cây khai sai —
 * "Sắt hộp 40x80x1li x4m30" khai dài cây 6 m, factor 8,24 mới đúng cây 4,3 m.
 */
export function kgPerUnitOf(m: {
  kg_per_unit?: number | null
  price_unit?: string | null
  unit2_factor?: number | null
  kg_per_m?: number | null
  unit?: string | null
  default_bar_length_m?: number | null
}): { kg: number | null; source: KgPerUnitSource | null; barem: number | null } {
  const barem = kgPerOrderUnit(m.kg_per_m, m.unit, m.default_bar_length_m)
  const canThat = Number(m.kg_per_unit)
  if (Number.isFinite(canThat) && canThat > 0) {
    return { kg: canThat, source: 'cân thật', barem }
  }
  const factor = Number(m.unit2_factor)
  if (nod(m.price_unit) === 'kg' && Number.isFinite(factor) && factor > 0) {
    return { kg: factor, source: 'danh mục (giá/kg)', barem }
  }
  return { kg: barem, source: barem == null ? null : 'barem', barem }
}

export function kgPerOrderUnit(
  kgPerMetre: number | null | undefined,
  unit: string | null | undefined,
  barLengthM: number | null | undefined,
): number | null {
  const kg = Number(kgPerMetre)
  if (!Number.isFinite(kg) || kg <= 0) return null
  const u = nod(unit)
  // Đặt theo cân: một đơn vị đặt = 1 kg. Không phụ thuộc barem.
  if (u === 'kg' || u === 'kilogram' || u === 'ky') return 1
  if (u === 'm' || u === 'met' || u === 'met dai') return +kg.toFixed(4)
  const len = Number(barLengthM)
  if (!Number.isFinite(len) || len <= 0) return null
  return +(kg * len).toFixed(4)
}
