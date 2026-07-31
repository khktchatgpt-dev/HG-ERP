import { poLineAmount } from '@/lib/po-line'
import { cartonAreaM2, deriveLine, type PoTemplate } from '@/lib/po-template'
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
  material_id: string
  code: string
  name: string
  unit: string
  on_hand: number
  spec: string
  note: string
  /** SL đặt cuối cùng — luôn theo ĐVT mua. Cột duy nhất mọi mẫu đều có. */
  qty: Num
  price: Num
  // accessory / chung
  material_grade: string
  product_code: string
  dm_per_sp: Num
  qty_demand: Num
  qty_on_hand: Num
  waste_pct: Num
  // aluminium
  die_code: string
  weight_per_m: Num
  bar_length_m: Num
  bar_surplus: Num
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
  carton_basis: 'ctn' | 'm2'
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
  if (l.qty === '' || Number(l.qty) <= 0) return false
  if (l.price === '' || Number(l.price) < 0) return false
  if (t === 'aluminium') {
    return (
      l.weight_per_m !== '' && Number(l.weight_per_m) > 0 && Number(l.bar_length_m) > 0
    )
  }
  if (t === 'metal_kg') return l.weight_per_unit !== '' && Number(l.weight_per_unit) > 0
  if (t === 'carton' && l.carton_basis === 'm2') {
    return l.area_m2 !== '' && Number(l.area_m2) > 0
  }
  return true
}

/** Lý do dòng chưa gửi được — hiện ngay cạnh nút, không bắt người dùng đoán. */
export function lineProblem(t: PoTemplate, l: Line): string | null {
  if (l.qty === '' || Number(l.qty) <= 0) return 'thiếu SL đặt'
  if (l.price === '') return 'thiếu đơn giá'
  if (t === 'aluminium' && !(Number(l.weight_per_m) > 0)) return 'thiếu kg/m'
  if (t === 'aluminium' && !(Number(l.bar_length_m) > 0)) return 'thiếu dài cây'
  if (t === 'metal_kg' && !(Number(l.weight_per_unit) > 0)) return 'thiếu kg/đơn vị'
  if (t === 'carton' && l.carton_basis === 'm2' && !(Number(l.area_m2) > 0)) {
    return 'thiếu m²/thùng'
  }
  return null
}

/**
 * Dựng dòng mới từ vật tư vừa chọn. TỰ ĐIỀN mọi thứ suy được — quy cách, kg/m và
 * chiều dài cây mặc định của vật tư, hao hụt 3% cho mẫu phụ kiện, giá mua lần
 * trước. Còn lại nhân viên chỉ gõ SL và đơn giá, đúng như yêu cầu.
 */
export function newLine(t: PoTemplate, m: PoMaterial): Line {
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
    material_grade: '',
    product_code: '',
    dm_per_sp: '',
    qty_demand: '',
    qty_on_hand: m.on_hand,
    waste_pct: t === 'accessory' ? 3 : '',
    die_code: '',
    weight_per_m: m.kg_per_m ?? '',
    bar_length_m: m.default_bar_length_m ?? '',
    bar_surplus: '',
    dimension_text: m.spec ?? '',
    finish: '',
    weight_per_unit: '',
    open_style: '',
    pcs_per_ctn: '',
    inner_l_mm: '',
    inner_w_mm: '',
    inner_h_mm: '',
    area_m2: '',
    carton_basis: 'ctn',
  }
}

/** Kích thước lọt lòng đổi → tính lại m²/thùng theo cách mở (AD/MR). */
export function recalcCartonArea(l: Line): Num {
  const a = cartonAreaM2(l.open_style, n(l.inner_l_mm), n(l.inner_w_mm), n(l.inner_h_mm))
  return a ?? l.area_m2
}
