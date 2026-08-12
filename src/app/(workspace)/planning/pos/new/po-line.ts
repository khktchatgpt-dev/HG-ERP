import { poLineAmount } from '@/lib/po-line'
import { cartonAreaM2, deriveLine, type PoTemplate } from '@/lib/po-template'
import { kgPerM, kgPerOrderUnit, kgPerUnitOf, rhoFor } from '@/lib/metal-weight'
import type { PoField } from '@/lib/po-fields'
import type { PoMaterial } from '@/components/supply/MaterialPicker'

/**
 * Dòng đang soạn trên form. Là HỢP các ô của 5 mẫu đơn — mẫu nào hiện cột nấy,
 * ô của mẫu khác vẫn nằm trong state để đổi mẫu qua lại không mất số đã gõ.
 *
 * Ô số dùng `number | ''` chứ không phải `number | null`: input type=number khi
 * xoá trắng trả '' , ép về 0 sẽ biến ô trống thành số 0 thật và nhân viên không
 * phân biệt được "chưa nhập" với "nhập 0".
 */
export type Num = number | ''

export type Line = {
  /**
   * DÒNG TỰ DO (0134): `is_free` = true thì material_id chỉ là KHÓA CỤC BỘ của
   * form (`free-…`), payload gửi material_id null + line_name/line_unit. Đơn
   * gỗ/gia công đặt theo MÃ SP — tên và ĐVT gõ thẳng trên dòng.
   */
  is_free?: boolean
  material_id: string
  code: string
  name: string
  unit: string
  /** Tồn hiện tại — NULL = chưa có sổ kho, hiện "kho ?" thay vì tồn 0 giả. */
  on_hand: number | null
  spec: string
  note: string
  /** SL đặt cuối cùng — luôn theo ĐVT mua. Cột duy nhất mọi mẫu đều có. */
  qty: Num
  price: Num
  // accessory / chung
  material_grade: string
  dm_per_sp: Num
  qty_demand: Num
  qty_on_hand: Num
  // aluminium
  die_code: string
  weight_per_m: Num
  bar_length_m: Num
  // metal_kg
  dimension_text: string
  finish: string
  weight_per_unit: Num
  // carton
  open_style: string
  pcs_per_ctn: Num
  inner_l_mm: Num
  inner_w_mm: Num
  inner_h_mm: Num
  area_m2: Num
  /** Bao bì (0134): giá NCC chào theo m² + phí bản in — nuôi gợi ý giá/thùng. */
  price_per_m2: Num
  print_fee: Num
  /** Cơ sở tính tiền dòng: thùng/SP/tấm · m² · m³ (xốp) · kg (gia công). */
  carton_basis: 'ctn' | 'm2' | 'm3' | 'kg'
  /**
   * Đóng gói mua từ danh mục (0124): 1 pack_unit = pack_size ĐVT. Chỉ để hiện
   * quy đổi + làm tròn gợi ý ngay dưới ô SL đặt — không đi vào payload (SL đặt
   * vẫn luôn theo ĐVT gốc). Mở đơn cũ không có (null) thì đơn giản là không
   * hiện quy đổi, mọi số đã lưu không đổi.
   */
  pack_size: number | null
  pack_unit: string
  /**
   * Số DANH MỤC đưa ra lúc chọn vật tư, để biết người mua đã gõ đè hay chưa —
   * gõ đè thì mời lưu ngược về danh mục (0128). null = mở từ đơn đã lưu, không
   * biết danh mục đang để gì nên cứ mời lưu khi ô có số.
   */
  catalog_kg_m: number | null
  catalog_kg_unit: number | null
}

/** Gợi ý từ nhu cầu BOM của LSX — chỉ để hiện, không tự ghi vào ô SL. */
export type LineSuggestion = { suggest: number | null }

const n = (v: Num): number | null => (v === '' ? null : Number(v))

/** Ô nhập của dòng → dạng `deriveLine` hiểu (kg/m, dài cây, kg/đv, m²…). */
export function draftOf(l: Line) {
  return {
    qty_ordered: Number(l.qty) || 0,
    weight_per_m: n(l.weight_per_m),
    bar_length_m: n(l.bar_length_m),
    weight_per_unit: n(l.weight_per_unit),
    area_m2: n(l.area_m2),
    // Xốp theo m³ (0134): D×R×Dày của mẫu foam đi cùng bộ ô lọt lòng.
    inner_l_mm: n(l.inner_l_mm),
    inner_w_mm: n(l.inner_w_mm),
    inner_h_mm: n(l.inner_h_mm),
    carton_basis: l.carton_basis,
  }
}

/** Tổng kg / tổng m² của dòng — cột tính sẵn, hiện read-only trên bảng. */
export function lineQty2(t: PoTemplate, l: Line): number | null {
  return deriveLine(t, draftOf(l)).qty2
}

/** Thành tiền dòng — đi đúng đường server dùng (deriveLine → poLineAmount). */
export function lineAmount(t: PoTemplate, l: Line): number {
  const d = deriveLine(t, draftOf(l))
  return poLineAmount({
    qty_ordered: Number(l.qty) || 0,
    unit_price: n(l.price),
    price_basis: d.price_basis,
    qty2: d.qty2,
  })
}

/**
 * Dòng đã đủ số để gửi duyệt chưa. Chỉ đòi SL và đơn giá — mọi cột khác đều là
 * thông tin dẫn xuất hoặc mô tả. Riêng mẫu nhôm phải có kg/m và dài cây, vì
 * thiếu thì tiền rơi về "SL × giá" (sai hẳn bậc: cây thay vì kg).
 */
export function lineReady(t: PoTemplate, l: Line): boolean {
  return lineProblem(t, l) == null
}

/** Lý do dòng chưa gửi được — hiện ngay cạnh nút, không bắt người dùng đoán. */
export function lineProblem(t: PoTemplate, l: Line): string | null {
  // Dòng tự do (0134): tên hàng là danh tính duy nhất — trống thì phiếu in rỗng.
  if (l.is_free && !l.name.trim()) return 'thiếu tên hàng'
  if (l.qty === '' || Number(l.qty) <= 0) return 'thiếu SL đặt'
  if (l.price === '') return 'thiếu đơn giá'
  if (t === 'aluminium' && !(Number(l.weight_per_m) > 0)) return 'thiếu kg/m'
  if (t === 'aluminium' && !(Number(l.bar_length_m) > 0)) return 'thiếu dài cây'
  if (t === 'metal_kg' && !(Number(l.weight_per_unit) > 0)) return 'thiếu kg/đơn vị'
  if (t === 'carton' && l.carton_basis === 'm2' && !(Number(l.area_m2) > 0)) {
    return 'thiếu m²/thùng'
  }
  // Kính giá theo m² phải có m²/tấm; gỗ luôn cần m³/SP (giá là giá/m³ tinh);
  // gia công theo kg cần ĐM kg/SP; xốp theo m³ cần đủ quy cách D×R×Dày —
  // thiếu thì tiền rơi về SL × giá, sai hẳn bậc mà không ai thấy.
  if (t === 'glass' && l.carton_basis === 'm2' && !(Number(l.area_m2) > 0)) {
    return 'thiếu m²/tấm'
  }
  if (t === 'wood' && !(Number(l.weight_per_unit) > 0)) return 'thiếu m³/SP'
  if (
    t === 'outsourcing' &&
    l.carton_basis === 'kg' &&
    !(Number(l.weight_per_unit) > 0)
  ) {
    return 'thiếu ĐM kg/SP'
  }
  if (
    t === 'foam' &&
    l.carton_basis === 'm3' &&
    !(Number(l.inner_l_mm) > 0 && Number(l.inner_w_mm) > 0 && Number(l.inner_h_mm) > 0)
  ) {
    return 'thiếu quy cách D×R×Dày'
  }
  return null
}

/**
 * GỢI Ý ĐƠN GIÁ/THÙNG của bao bì (0134): đơn thật báo giá/m² + "bản in + công"
 * rồi mới ra giá/thùng = m² × giá/m² + bản in (Hồng Đào Chu Lai: 3,591 × 18.770
 * + 3.278 = 70.681). Chỉ là gợi ý bấm-để-dùng dưới ô Đơn giá — tính tiền vẫn
 * SL × đơn giá.
 */
export function cartonPriceSuggest(t: PoTemplate, l: Line): number | null {
  if (t !== 'carton' || l.carton_basis !== 'ctn') return null
  const area = Number(l.area_m2) || 0
  const perM2 = Number(l.price_per_m2) || 0
  if (area <= 0 || perM2 <= 0) return null
  const fee = Number(l.print_fee) || 0
  return Math.round((area * perM2 + fee) * 100) / 100
}

/**
 * Đọc quy cách "900×605×115 mm" / "940*940*90" / "900x605x115" → [D, R, C].
 *
 * Bao bì trong danh mục ghi lọt lòng ngay trong ô Quy cách, còn mẫu carton lại
 * nhập theo BA Ô SỐ riêng — không tách ra thì người soạn phải nhìn quy cách gõ
 * lại từng số (phản hồi 08/08/2026). Chỉ nhận đúng dạng số×số×số; quy cách kiểu
 * "25×50×1li" (ống, li = độ dày) có chữ dính liền số thứ ba nên KHÔNG khớp — và
 * đúng ra là không được khớp, đó không phải lọt lòng thùng.
 */
export function parseInnerDims(
  spec: string | null | undefined,
): [number, number, number] | null {
  if (!spec) return null
  const m = spec.match(
    /(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+(?:[.,]\d+)?)(?![.,\d])/i,
  )
  if (!m) return null
  // "1li"/"5c"…: chữ DÍNH LIỀN số thứ ba nghĩa là đơn vị khác (li = độ dày) chứ
  // không phải mm lọt lòng — loại. "mm" dính liền, hoặc chữ đứng sau CÓ khoảng
  // trắng ("…105 thùng âm dương"), thì chỉ là đơn vị/mô tả — vẫn nhận.
  const after = spec.slice((m.index ?? 0) + m[0].length)
  if (/^[a-zà-ỹ]/i.test(after) && !/^mm\b/i.test(after)) return null
  const dims = [m[1], m[2], m[3]].map((s) => Number(s.replace(',', '.')))
  return dims.every((d) => Number.isFinite(d) && d > 0)
    ? (dims as [number, number, number])
    : null
}

/**
 * Dựng dòng mới từ vật tư vừa chọn. TỰ ĐIỀN mọi thứ suy được — quy cách, kg/m và
 * chiều dài cây mặc định của vật tư, giá mua lần trước, và các Ô MÔ TẢ của LẦN
 * ĐẶT GẦN NHẤT (Vật liệu, Màu/bề mặt, Cách mở, Pcs/thùng, Đm/sp — 08/08/2026).
 * Còn lại nhân viên chỉ gõ SL và đơn giá, đúng như yêu cầu.
 */
export function newLine(t: PoTemplate, m: PoMaterial): Line {
  /*
   * Quy cách danh mục TỰ BÓC vào ba ô số cho các mẫu tính theo kích thước —
   * người soạn không phải nhìn quy cách gõ lại từng số:
   *   carton: lọt lòng D×R×C ("900x605x115") — có cách mở là ra m² ngay.
   *   foam  : quy cách tấm D×R×Dày ("1520x920x10") — chọn "tính theo m³" là
   *           tổng khối tự nhảy (0134).
   *   glass : "605x539x5mm" — hai số đầu là kích thước tấm → m²/tấm = D×R/10⁶,
   *           đúng cột "m2/tấm" của đơn kính thật (0134).
   */
  const inner = t === 'carton' || t === 'foam' ? parseInnerDims(m.spec) : null
  const glassDims = t === 'glass' ? parseInnerDims(m.spec) : null
  const last = m.last_line
  const openStyle = t === 'carton' ? (last?.open_style ?? '') : ''
  // Vật liệu: lần đặt gần nhất là nguồn tươi nhất; vật tư CHƯA TỪNG lên đơn thì
  // lấy số khai ở danh mục (0124) — trước đây ô này trống và phải gõ tay.
  const grade = last?.material_grade ?? m.material_grade ?? ''
  const area =
    t === 'glass'
      ? glassDims
        ? Math.round(((glassDims[0] * glassDims[1]) / 1e6) * 10000) / 10000
        : null
      : inner && openStyle
        ? cartonAreaM2(openStyle, inner[0], inner[1], inner[2])
        : null
  return {
    material_id: m.id,
    code: m.code,
    name: m.name,
    unit: m.unit,
    on_hand: m.on_hand,
    spec: m.spec ?? '',
    note: '',
    qty: '',
    // Giá mua lần trước là GỢI Ý, điền sẵn để đơn lặp lại hàng tháng khỏi gõ lại.
    price: m.last_purchase_price ?? '',
    material_grade: grade,
    dm_per_sp: last?.dm_per_sp ?? '',
    qty_demand: '',
    // Chưa có sổ kho (null) → ô tồn ĐỂ TRỐNG, không chụp số 0 giả vào phiếu in.
    qty_on_hand: m.on_hand ?? '',
    die_code: '',
    weight_per_m: m.kg_per_m ?? '',
    bar_length_m: m.default_bar_length_m ?? '',
    // Quy cách danh mục là nguồn CHỐT; chưa khai thì lấy kích thước ghi ở đơn trước.
    dimension_text: m.spec ?? last?.dimension_text ?? '',
    finish: last?.finish ?? '',
    /*
     * kg/ĐƠN-VỊ-ĐẶT cho mẫu inox/sắt — ba nguồn xếp theo độ tin, xem
     * `kgPerUnitOf`. Ô này mà trống thì `lineReady` CHẶN gửi, người soạn kẹt và
     * gõ đại một số cho qua; số gõ đại đi thẳng vào (SL × kg/đv) × giá/kg rồi
     * lên bàn duyệt Giám đốc, không ai đối chiếu. Không suy được thì vẫn để
     * trống — nhân viên nhập theo phiếu cân NCC, không đoán hộ.
     */
    weight_per_unit: kgPerUnitOf(m).kg ?? '',
    open_style: openStyle,
    pcs_per_ctn: last?.pcs_per_ctn ?? '',
    inner_l_mm: inner?.[0] ?? '',
    inner_w_mm: inner?.[1] ?? '',
    inner_h_mm: inner?.[2] ?? '',
    area_m2: area ?? '',
    price_per_m2: '',
    print_fee: '',
    carton_basis: 'ctn',
    pack_size: m.pack_size ?? null,
    pack_unit: m.pack_unit ?? '',
    catalog_kg_m: m.kg_per_m ?? null,
    catalog_kg_unit: kgPerUnitOf(m).kg,
  }
}

/** Bản vật tư TỐI THIỂU mà modal "Sửa vật tư" trả về sau khi lưu. */
export type MaterialRefresh = {
  name: string
  unit: string
  spec: string | null
  kg_per_m: number | null
  kg_per_unit: number | null
  default_bar_length_m: number | null
  price_unit: string | null
  unit2_factor: number | null
  pack_size: number | null
  pack_unit: string | null
  material_grade: string | null
}

/**
 * SỬA VẬT TƯ NGAY TRÊN DÒNG ĐƠN → dòng hút lại số mới của danh mục.
 *
 * Luật cập nhật giữ đúng nguyên tắc "không đè số người dùng đã gõ":
 *   · LUÔN theo danh mục: tên, ĐVT, quy cách, đóng gói, catalog_* (mốc so lệch).
 *   · CHỈ KHI Ô TRỐNG: barem (kg/m, dài cây, kg/đơn-vị), vật liệu — người soạn
 *     đã gõ tay thì số đó thắng (có thể là phiếu cân NCC).
 *   · Kích thước bóc từ quy cách (carton/foam dims, glass m²/tấm) cũng chỉ khi
 *     đang trống — cùng đường parse với `newLine`.
 */
export function refreshLineFromMaterial(
  t: PoTemplate,
  l: Line,
  m: MaterialRefresh,
): Line {
  const kgUnit = kgPerUnitOf(m)
  const next: Line = {
    ...l,
    name: m.name,
    unit: m.unit,
    spec: m.spec ?? '',
    pack_size: m.pack_size ?? null,
    pack_unit: m.pack_unit ?? '',
    catalog_kg_m: m.kg_per_m ?? null,
    catalog_kg_unit: kgUnit.kg,
    weight_per_m: l.weight_per_m === '' ? (m.kg_per_m ?? '') : l.weight_per_m,
    bar_length_m: l.bar_length_m === '' ? (m.default_bar_length_m ?? '') : l.bar_length_m,
    weight_per_unit: l.weight_per_unit === '' ? (kgUnit.kg ?? '') : l.weight_per_unit,
    material_grade: l.material_grade === '' ? (m.material_grade ?? '') : l.material_grade,
  }

  // Kích thước từ quy cách — cùng luật với newLine, nhưng chỉ lấp ô trống.
  if ((t === 'carton' || t === 'foam') && next.inner_l_mm === '') {
    const dims = parseInnerDims(m.spec)
    if (dims) {
      next.inner_l_mm = dims[0]
      next.inner_w_mm = dims[1]
      next.inner_h_mm = dims[2]
      if (t === 'carton' && next.area_m2 === '') {
        next.area_m2 = recalcCartonArea(next)
      }
    }
  }
  if (t === 'glass' && next.area_m2 === '') {
    const dims = parseInnerDims(m.spec)
    if (dims) next.area_m2 = Math.round(((dims[0] * dims[1]) / 1e6) * 10000) / 10000
  }
  return next
}

/**
 * DÒNG TỰ DO cho mẫu gỗ/gia công (0134): không gắn vật tư kho — tên/ĐVT gõ ngay
 * trên dòng, material_id chỉ là khóa cục bộ để React/focus/xoá dòng hoạt động.
 */
export function newFreeLine(): Line {
  return {
    is_free: true,
    material_id: `free-${crypto.randomUUID()}`,
    code: '',
    name: '',
    unit: 'cái',
    on_hand: null,
    spec: '',
    note: '',
    qty: '',
    price: '',
    material_grade: '',
    dm_per_sp: '',
    qty_demand: '',
    qty_on_hand: '',
    die_code: '',
    weight_per_m: '',
    bar_length_m: '',
    dimension_text: '',
    finish: '',
    weight_per_unit: '',
    open_style: '',
    pcs_per_ctn: '',
    inner_l_mm: '',
    inner_w_mm: '',
    inner_h_mm: '',
    area_m2: '',
    price_per_m2: '',
    print_fee: '',
    carton_basis: 'ctn',
    pack_size: null,
    pack_unit: '',
    catalog_kg_m: null,
    catalog_kg_unit: null,
  }
}

/** Dòng đơn như repo trả về — chỉ những trường form cần. */
export type PoLineDto = {
  id?: string
  /** null = dòng tự do (0134) — material_name/unit đã fallback từ line_name. */
  material_id: string | null
  material_code: string
  material_name: string
  material_unit: string
  qty_ordered: number
  unit_price: number | null
  spec: string | null
  note: string | null
  material_grade: string | null
  dm_per_sp: number | null
  qty_demand: number | null
  qty_on_hand: number | null
  die_code: string | null
  weight_per_m: number | null
  bar_length_m: number | null
  dimension_text: string | null
  finish: string | null
  weight_per_unit: number | null
  open_style: string | null
  pcs_per_ctn: number | null
  inner_l_mm: number | null
  inner_w_mm: number | null
  inner_h_mm: number | null
  area_m2: number | null
  price_per_m2: number | null
  print_fee: number | null
  carton_basis: 'ctn' | 'm2' | 'm3' | 'kg' | null
  pack_size: number | null
  pack_unit: string | null
}

const n2 = (v: number | null | undefined): Num => (v == null ? '' : Number(v))
const s2 = (v: string | null | undefined): string => v ?? ''

/**
 * Dựng dòng form từ dòng đơn đã lưu — dùng khi mở SỬA hoặc NHÂN BẢN đơn.
 *
 * Phải giữ TRỌN thông số quy đổi của mẫu (kg/m, dài cây, kg/đv, m²): mất chúng
 * thì `deriveLine` rơi về 'unit' và thành tiền dòng nhôm tụt từ (tổng kg × giá/kg)
 * xuống (số cây × giá/kg) — sai khoảng 6 lần mà không báo gì.
 *
 * `on_hand` lấy tồn HIỆN TẠI (server page nạp kèm), không phải `qty_on_hand` đã
 * chốt lúc lập đơn — hai số khác nghĩa: một là tồn bây giờ, một là ảnh chụp để in.
 */
export function lineFromPo(l: PoLineDto, onHand: number | null = null): Line {
  // Dòng tự do (0134): material_id null trong DB — khóa cục bộ dựng từ id dòng
  // (mở SỬA/NHÂN BẢN không đổi khóa giữa hai lần render).
  const isFree = l.material_id == null
  return {
    is_free: isFree,
    material_id: l.material_id ?? `free-${l.id ?? crypto.randomUUID()}`,
    code: l.material_code,
    name: l.material_name,
    unit: l.material_unit,
    on_hand: onHand,
    spec: s2(l.spec),
    note: s2(l.note),
    qty: n2(l.qty_ordered),
    price: n2(l.unit_price),
    material_grade: s2(l.material_grade),
    dm_per_sp: n2(l.dm_per_sp),
    qty_demand: n2(l.qty_demand),
    qty_on_hand: n2(l.qty_on_hand),
    die_code: s2(l.die_code),
    weight_per_m: n2(l.weight_per_m),
    bar_length_m: n2(l.bar_length_m),
    dimension_text: s2(l.dimension_text),
    finish: s2(l.finish),
    weight_per_unit: n2(l.weight_per_unit),
    open_style: s2(l.open_style),
    pcs_per_ctn: n2(l.pcs_per_ctn),
    inner_l_mm: n2(l.inner_l_mm),
    inner_w_mm: n2(l.inner_w_mm),
    inner_h_mm: n2(l.inner_h_mm),
    area_m2: n2(l.area_m2),
    price_per_m2: n2(l.price_per_m2),
    print_fee: n2(l.print_fee),
    carton_basis: l.carton_basis ?? 'ctn',
    // Đóng gói đã chụp trên dòng đơn (0128) — mở SỬA/NHÂN BẢN giữ đúng con số
    // hai bên chốt lúc đặt, không lấy lại đóng gói hiện tại của danh mục. Đơn
    // cũ trước 0128 để null thì quy đổi tự ẩn như trước.
    pack_size: l.pack_size,
    pack_unit: s2(l.pack_unit),
    // Mở đơn đã lưu thì không biết danh mục đang để số gì — để null, nút "lưu
    // vào danh mục" cứ hiện khi ô có số (ghi đè bằng chính số đã chốt trên đơn
    // là việc đúng, không phải việc thừa).
    catalog_kg_m: null,
    catalog_kg_unit: null,
  }
}

/*
 * `packCount` / `roundUpToPack` đã dời sang `@/lib/po-line` (0128) — phiếu in
 * cần đúng phép chia đó, mà trang in không được import từ thư mục form.
 */

/**
 * TRA BAREM cho hai ô mà thiếu là KHÔNG GỬI ĐƯỢC ĐƠN: kg/m (mẫu nhôm) và
 * kg/đơn-vị (mẫu inox/sắt) — xem `lineReady`.
 *
 * Vì sao cần: danh mục mới có 634/13.168 mã khai kg/m và 5 mã khai kg/đơn-vị.
 * Gặp mã chưa khai thì form chặn gửi, và lối thoát duy nhất của người soạn là
 * gõ đại một số — số đó đi thẳng vào (SL × kg/đv) × giá/kg rồi lên bàn duyệt
 * Giám đốc, không ai đối chiếu. Nới chặn còn tệ hơn: dòng rơi về "SL × giá" và
 * ra tiền sai mà im lặng.
 *
 * Nên giữ nguyên chốt chặn, chỉ mở thêm lối ra ĐÚNG: barem suy từ QUY CÁCH
 * TRONG TÊN vật tư bằng công thức xưởng (`@/lib/metal-weight` — cùng bản mà
 * script backfill danh mục dùng). Không tính ra thì trả lý do để hiện thẳng
 * ("hàng tấm/cuộn — không tính theo mét", "chưa khai dài cây"), tuyệt đối không
 * gợi ý một con số đoán.
 */
export function baremFor(f: PoField, l: Line): { kg: number | null; why: string | null } {
  const perM = kgPerM(l.name, rhoFor(l.name))
  if (f.key === 'kgm') return { kg: perM.kg, why: perM.reason ?? null }
  // kg/ĐƠN-VỊ: ưu tiên kg/m đã có sẵn trên dòng, không có thì suy từ tên.
  const perMetre = l.weight_per_m === '' ? perM.kg : Number(l.weight_per_m)
  const kg = kgPerOrderUnit(
    perMetre,
    l.unit,
    l.bar_length_m === '' ? null : Number(l.bar_length_m),
  )
  if (kg != null) return { kg, why: null }
  if (!(Number(perMetre) > 0)) {
    return { kg: null, why: perM.reason ?? 'chưa có barem kg/m' }
  }
  return { kg: null, why: 'chưa khai dài cây' }
}

/**
 * Số trên ô có KHÁC số danh mục đang giữ không — tức người mua vừa gõ đè, hoặc
 * bấm barem, hoặc đọc phiếu cân NCC. Đó là lúc mời ghi ngược về danh mục (0128)
 * để lần đặt sau khỏi gõ lại.
 *
 * Dòng mở từ ĐƠN ĐÃ LƯU không biết danh mục đang để gì (`catalog_*` = null) nên
 * coi như khác: ghi lại đúng con số hai bên đã chốt trên đơn là việc đúng, và
 * ghi đè bằng chính nó thì cũng vô hại.
 */
export function overridesCatalog(f: PoField, l: Line): boolean {
  const filled = Number(f.field ? l[f.field as keyof Line] : null)
  if (!(filled > 0)) return false
  const cat = f.key === 'kgm' ? l.catalog_kg_m : l.catalog_kg_unit
  if (cat == null) return true
  return Math.abs(cat - filled) / filled > 0.0001
}

/** Kích thước lọt lòng đổi → tính lại m²/thùng theo cách mở (AD/MR). */
export function recalcCartonArea(l: Line): Num {
  const a = cartonAreaM2(l.open_style, n(l.inner_l_mm), n(l.inner_w_mm), n(l.inner_h_mm))
  return a ?? l.area_m2
}
