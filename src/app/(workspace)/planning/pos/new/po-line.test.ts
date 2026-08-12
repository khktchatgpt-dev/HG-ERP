import { describe, expect, it } from 'vitest'
import { packCount, poLineAmount, roundUpToPack } from '@/lib/po-line'
import { deriveLine, type PoTemplate } from '@/lib/po-template'
import {
  baremFor,
  cartonPriceSuggest,
  draftOf,
  lineAmount,
  lineFromPo,
  lineProblem,
  lineReady,
  newFreeLine,
  newLine,
  overridesCatalog,
  recallBasis,
  refreshLineFromMaterial,
} from './po-line'
import type { Line, MaterialRefresh, PoLineDto } from './po-line'
import type { PoField } from '@/lib/po-fields'
import type { PoMaterial } from '@/components/supply/MaterialPicker'

/**
 * MỞ ĐƠN ĐỂ SỬA KHÔNG ĐƯỢC LÀM ĐỔI SỐ TIỀN.
 *
 * Đây là hồi quy cho một bug thật: form sửa cũ trong PosManager không biết mẫu đơn
 * nên khi lưu lại đã bỏ hết thông số quy đổi (kg/m, dài cây, kg/đv, m²). Mất chúng
 * thì `deriveLine` rơi về price_basis 'unit' và thành tiền dòng nhôm tụt từ
 * (tổng kg × giá/kg) xuống (số cây × giá/kg) — sai ~6 lần, không cảnh báo gì.
 */

const base: PoLineDto = {
  material_id: 'm1',
  material_code: 'VT-001',
  material_name: 'Thanh nhôm',
  material_unit: 'cây',
  qty_ordered: 273,
  unit_price: 102_000,
  spec: null,
  note: 'Dọc ngồi',
  material_grade: null,
  dm_per_sp: null,
  qty_demand: null,
  qty_on_hand: null,
  die_code: null,
  weight_per_m: null,
  bar_length_m: null,
  dimension_text: null,
  finish: null,
  weight_per_unit: null,
  open_style: null,
  pcs_per_ctn: null,
  inner_l_mm: null,
  inner_w_mm: null,
  inner_h_mm: null,
  area_m2: null,
  price_per_m2: null,
  print_fee: null,
  carton_basis: null,
  pack_size: null,
  pack_unit: null,
}

/** Tiền của dòng ĐÃ LƯU, tính đúng cách server tính. */
function storedAmount(t: PoTemplate, dto: PoLineDto): number {
  const d = deriveLine(t, {
    qty_ordered: dto.qty_ordered,
    weight_per_m: dto.weight_per_m,
    bar_length_m: dto.bar_length_m,
    weight_per_unit: dto.weight_per_unit,
    area_m2: dto.area_m2,
    carton_basis: dto.carton_basis,
  })
  return poLineAmount({
    qty_ordered: dto.qty_ordered,
    unit_price: dto.unit_price,
    price_basis: d.price_basis,
    qty2: d.qty2,
  })
}

describe('mở đơn để sửa — thành tiền phải y nguyên', () => {
  const cases: [string, PoTemplate, PoLineDto][] = [
    [
      'nhôm (kg/m × dài cây × số cây)',
      'aluminium',
      { ...base, weight_per_m: 0.248, bar_length_m: 5.65 },
    ],
    [
      'inox theo kg/cây',
      'metal_kg',
      { ...base, qty_ordered: 20, unit_price: 73_200, weight_per_unit: 9.325 },
    ],
    [
      'bao bì tính theo m²',
      'carton',
      {
        ...base,
        qty_ordered: 300,
        unit_price: 5_000,
        area_m2: 1.6564,
        carton_basis: 'm2',
      },
    ],
    [
      'bao bì tính theo thùng',
      'carton',
      { ...base, qty_ordered: 300, unit_price: 8_282, carton_basis: 'ctn' },
    ],
    ['phụ kiện', 'accessory', { ...base, qty_ordered: 206, unit_price: 2_000 }],
  ]

  for (const [ten, template, dto] of cases) {
    it(ten, () => {
      const before = storedAmount(template, dto)
      const after = lineAmount(template, lineFromPo(dto))
      expect(after).toBeCloseTo(before, 6)
      expect(before).toBeGreaterThan(0)
    })
  }

  it('nhôm: giữ nguyên kg/m và dài cây chứ không rơi về SL × giá', () => {
    const dto = { ...base, weight_per_m: 0.248, bar_length_m: 5.65 }
    const d = draftOf(lineFromPo(dto))
    expect(d.weight_per_m).toBe(0.248)
    expect(d.bar_length_m).toBe(5.65)
    expect(deriveLine('aluminium', d).price_basis).toBe('unit2')
    // Bug cũ: mất thông số → 273 × 102.000 = 27.846.000 thay vì 39.017.815.
    expect(lineAmount('aluminium', lineFromPo(dto))).not.toBeCloseTo(27_846_000, 0)
  })

  it('dòng nạp lại từ đơn đã lưu là hợp lệ, không bắt nhập lại gì', () => {
    for (const [, template, dto] of cases) {
      const l = lineFromPo(dto)
      expect(lineProblem(template, l)).toBeNull()
      expect(lineReady(template, l)).toBe(true)
    }
  })

  it('ô trống về "" chứ không về 0 — phân biệt chưa nhập với nhập số 0', () => {
    const l = lineFromPo(base)
    expect(l.weight_per_m).toBe('')
    expect(l.qty_demand).toBe('')
    expect(l.material_grade).toBe('')
    expect(l.carton_basis).toBe('ctn') // mặc định, không phải null
  })

  it('đơn giá 0 vẫn giữ là 0, không biến thành ô trống', () => {
    // NCC cho hàng khuyến mãi / hàng bù — giá 0 là số thật, không phải chưa nhập.
    const l = lineFromPo({ ...base, unit_price: 0 })
    expect(l.price).toBe(0)
  })
})

/*
 * DÒNG MỚI PHẢI MANG SẴN BAREM CỦA VẬT TƯ.
 *
 * `lineReady` CHẶN gửi khi mẫu metal_kg thiếu kg/đơn-vị. Trước đây newLine luôn
 * để ô đó trống kể cả khi vật tư đã có barem trong danh mục, nên người soạn đơn
 * bị chặn rồi gõ đại một số cho qua — số đó đi thẳng vào (SL × kg/đv) × giá/kg
 * và lên bàn duyệt Giám đốc mà không ai đối chiếu.
 */
describe('newLine — tự điền barem, nhưng không đoán', () => {
  const inox: PoMaterial = {
    id: 'm-inox',
    code: 'IN-0001',
    name: 'Inox hộp 25x50x1',
    unit: 'cây',
    group_name: 'Inox',
    sub_group: null,
    spec: null,
    kg_per_unit: null,
    kg_per_m: 1.5542,
    default_bar_length_m: 6,
    price_unit: null,
    unit2_factor: null,
    vat_rate: null,
    default_supplier_id: null,
    last_purchase_price: null,
    pack_size: null,
    pack_unit: null,
    material_grade: null,
    on_hand: 0,
    last_line: null,
  }

  it('metal_kg: kg/đơn-vị = kg/m × dài cây, không phải kg/m', () => {
    // Đơn thật Kim Vĩnh Phú: 9,325 kg/cây. Chép thẳng kg/m là đơn hụt 6 lần.
    const l = newLine('metal_kg', inox)
    expect(l.weight_per_unit).toBeCloseTo(9.3252, 4)
    expect(lineProblem('metal_kg', { ...l, qty: 20, price: 73_200 })).toBeNull()
  })

  it('chưa khai dài cây → để trống, KHÔNG mặc định 6m', () => {
    const l = newLine('metal_kg', { ...inox, default_bar_length_m: null })
    expect(l.weight_per_unit).toBe('')
    expect(lineProblem('metal_kg', { ...l, qty: 20, price: 73_200 })).toBe(
      'thiếu kg/đơn vị',
    )
  })

  it('chưa có barem → để trống, nhập theo phiếu cân NCC', () => {
    const l = newLine('metal_kg', { ...inox, kg_per_m: null })
    expect(l.weight_per_unit).toBe('')
  })

  /*
   * HÀNG TẤM / CUỘN (0112). Tấm inox không có barem theo mét — cân theo TẤM, đúng
   * như cột "Trọng lượng tấm (kg)" trên đơn Thông Đạt / Hào Tư Hùng. Trước 0112
   * chúng luôn để trống ô kg/đơn-vị nên phải gõ tay mỗi lần đặt.
   */
  const tam: PoMaterial = {
    ...inox,
    id: 'm-tam',
    code: 'IN-0002',
    name: 'Inox tấm 304 khổ 1220x2440 dày 1.0',
    unit: 'tấm',
    kg_per_m: null,
    default_bar_length_m: null,
    price_unit: null,
    unit2_factor: null,
    kg_per_unit: 23.94,
  }

  it('hàng tấm: lấy thẳng kg/đơn-vị đã khai ở danh mục', () => {
    const l = newLine('metal_kg', tam)
    expect(l.weight_per_unit).toBe(23.94)
    expect(lineProblem('metal_kg', { ...l, qty: 10, price: 73_200 })).toBeNull()
  })

  it('kg/đơn-vị khai tay THẮNG số suy từ kg/m × dài cây', () => {
    // Số cân thật luôn đúng hơn số suy ra — kể cả khi vật tư có đủ cả hai.
    const l = newLine('metal_kg', { ...inox, kg_per_unit: 9.41 })
    expect(l.weight_per_unit).toBe(9.41)
  })

  it('hàng tấm chưa khai kg/đơn-vị → vẫn để trống, không suy bừa', () => {
    const l = newLine('metal_kg', { ...tam, kg_per_unit: null })
    expect(l.weight_per_unit).toBe('')
  })

  it('aluminium vẫn lấy thẳng kg/m + dài cây của vật tư', () => {
    const l = newLine('aluminium', {
      ...inox,
      kg_per_m: 0.248,
      default_bar_length_m: 5.65,
      price_unit: null,
      unit2_factor: null,
    })
    expect(l.weight_per_m).toBe(0.248)
    expect(l.bar_length_m).toBe(5.65)
  })
})

/*
 * TRA BAREM (0128) — lối thoát ĐÚNG khi vật tư chưa khai kg/m hay kg/đơn-vị.
 * Danh mục mới có 634/13.168 mã khai kg/m và 5 mã khai kg/đơn-vị, nên nếu không
 * có nút này thì người soạn bị chặn gửi và gõ đại một số.
 */
describe('baremFor — suy kg từ quy cách trong tên vật tư', () => {
  const line = (over: Partial<Line>): Line => ({
    ...newLine('metal_kg', {
      id: 'm1',
      code: 'IN-9',
      name: 'Inox hộp 25x50x1',
      unit: 'cây',
      group_name: 'Inox',
      sub_group: null,
      spec: null,
      kg_per_unit: null,
      kg_per_m: null,
      default_bar_length_m: null,
      price_unit: null,
      unit2_factor: null,
      vat_rate: null,
      default_supplier_id: null,
      last_purchase_price: null,
      pack_size: null,
      pack_unit: null,
      material_grade: null,
      on_hand: null,
      last_line: null,
    }),
    ...over,
  })
  const F_KGM = { key: 'kgm' } as PoField
  const F_KGUNIT = { key: 'kgunit' } as PoField

  it('ô kg/m: đọc tiết diện trong tên → barem tính được', () => {
    const r = baremFor(F_KGM, line({}))
    // Hộp 25×50 dày 1, tỷ trọng inox: (2(25+50) − 4×1) × 1 = 146 mm².
    expect(r.kg).toBeCloseTo(1.158, 3)
    expect(r.why).toBeNull()
  })

  it('ô kg/đơn-vị: kg/m × dài cây khi đã biết dài cây', () => {
    const r = baremFor(F_KGUNIT, line({ weight_per_m: 1.5542, bar_length_m: 6 }))
    expect(r.kg).toBeCloseTo(9.3252, 4)
  })

  it('chưa khai dài cây → KHÔNG đoán 6m, nói rõ lý do', () => {
    const r = baremFor(F_KGUNIT, line({ weight_per_m: 1.5542, bar_length_m: '' }))
    expect(r.kg).toBeNull()
    expect(r.why).toBe('chưa khai dài cây')
  })

  it('hàng tấm/cuộn: không có barem theo mét, trả lý do thay vì số bừa', () => {
    const r = baremFor(F_KGM, line({ name: 'Inox tấm 304 khổ 1220x2440 dày 1.0' }))
    expect(r.kg).toBeNull()
    expect(r.why).toBe('hàng tấm/cuộn — không tính theo mét')
  })
})

/*
 * GHI NGƯỢC VỀ DANH MỤC (0128) — chỉ mời khi số trên ô khác số danh mục đang
 * giữ. Người mua cầm phiếu cân NCC lúc lập đơn; trước đây con số ấy chết theo
 * dòng đơn và lần sau lại gõ lại.
 */
describe('overridesCatalog — khi nào mời lưu về danh mục', () => {
  const F_KGUNIT = { key: 'kgunit', field: 'weight_per_unit' } as PoField
  const l = (over: Partial<Line>) =>
    ({ ...({} as Line), catalog_kg_m: null, catalog_kg_unit: null, ...over }) as Line

  it('gõ đè khác số danh mục → mời lưu', () => {
    expect(
      overridesCatalog(F_KGUNIT, l({ weight_per_unit: 9.41, catalog_kg_unit: 9.3252 })),
    ).toBe(true)
  })

  it('đúng bằng số danh mục → không mời (khỏi rác màn hình)', () => {
    expect(
      overridesCatalog(F_KGUNIT, l({ weight_per_unit: 9.3252, catalog_kg_unit: 9.3252 })),
    ).toBe(false)
  })

  it('ô trống → không mời', () => {
    expect(overridesCatalog(F_KGUNIT, l({ weight_per_unit: '' }))).toBe(false)
  })

  it('mở từ đơn đã lưu (không biết danh mục để gì) → vẫn mời', () => {
    expect(overridesCatalog(F_KGUNIT, l({ weight_per_unit: 23.94 }))).toBe(true)
  })
})

/*
 * MẪU CARTON: quy cách vật tư ("900×605×115 mm") chính là LỌT LÒNG — phải tách
 * vào ba ô D×R×C, không thì người soạn nhìn quy cách gõ lại từng số (phản hồi
 * 08/08/2026: "vật tư có quy cách mà không tự điền vào được").
 */
describe('newLine carton — tách quy cách vào lọt lòng', () => {
  const bb: PoMaterial = {
    id: 'm-bb',
    code: 'BB-0015',
    name: 'BB Bàn Samos',
    unit: 'Thùng',
    group_name: 'Bao bì - đóng gói - tem nhãn',
    sub_group: null,
    spec: '900×605×115 mm',
    kg_per_unit: null,
    kg_per_m: null,
    default_bar_length_m: null,
    price_unit: null,
    unit2_factor: null,
    vat_rate: null,
    default_supplier_id: null,
    last_purchase_price: null,
    pack_size: null,
    pack_unit: null,
    material_grade: null,
    on_hand: 0,
    last_line: null,
  }

  it('900×605×115 mm → D/R/C điền sẵn, m² đợi chọn cách mở', () => {
    const l = newLine('carton', bb)
    expect([l.inner_l_mm, l.inner_w_mm, l.inner_h_mm]).toEqual([900, 605, 115])
    // m² chưa tính được vì chưa biết AD hay MR — chọn cách mở mới tính.
    expect(l.area_m2).toBe('')
  })

  it('dấu * hay x thường cũng đọc được (sổ Excel gõ đủ kiểu)', () => {
    const l = newLine('carton', { ...bb, spec: '940*940*90' })
    expect([l.inner_l_mm, l.inner_w_mm, l.inner_h_mm]).toEqual([940, 940, 90])
    const l2 = newLine('carton', { ...bb, spec: 'KT 1125x1125x105 thùng âm dương' })
    expect([l2.inner_l_mm, l2.inner_w_mm, l2.inner_h_mm]).toEqual([1125, 1125, 105])
  })

  it('quy cách ống "25×50×1li" KHÔNG phải lọt lòng → không điền', () => {
    const l = newLine('carton', { ...bb, spec: '25×50×1li' })
    expect(l.inner_l_mm).toBe('')
  })

  it('không có quy cách → ba ô trống như cũ', () => {
    const l = newLine('carton', { ...bb, spec: null })
    expect(l.inner_l_mm).toBe('')
  })

  it('mẫu KHÁC carton không đụng tới lọt lòng', () => {
    const l = newLine('accessory', bb)
    expect(l.inner_l_mm).toBe('')
  })

  /*
   * ĐIỀN SẴN TỪ LẦN ĐẶT GẦN NHẤT (08/08/2026 — "hạn chế nhân viên phải gõ"):
   * Vật liệu / Màu / Kích thước / Cách mở / Pcs-thùng / Đm-sp của một vật tư
   * gần như không đổi giữa các đơn — gõ lại mỗi lần chỉ tổ lệch chính tả.
   */
  it('carton có lịch sử: cách mở + pcs/thùng điền sẵn, m² tính được NGAY', () => {
    const l = newLine('carton', {
      ...bb,
      last_line: {
        material_grade: null,
        dimension_text: null,
        finish: null,
        pcs_per_ctn: 1,
        open_style: 'AD',
        dm_per_sp: null,
      },
    })
    expect(l.open_style).toBe('AD')
    expect(l.pcs_per_ctn).toBe(1)
    // Đủ lọt lòng (từ quy cách) + cách mở (từ đơn trước) → m² không phải đợi.
    expect(l.area_m2).toBeCloseTo(1.9268, 4)
  })

  it('phụ kiện/inox có lịch sử: Vật liệu, Màu, Đm/sp điền sẵn', () => {
    const withLast = {
      ...bb,
      spec: null,
      last_line: {
        material_grade: 'Sắt xi trắng',
        dimension_text: 'phi 10 x655mm',
        finish: 'inox bóng',
        pcs_per_ctn: null,
        open_style: null,
        dm_per_sp: 4,
      },
    }
    const l = newLine('accessory', withLast)
    expect(l.material_grade).toBe('Sắt xi trắng')
    expect(l.dm_per_sp).toBe(4)
    const l2 = newLine('metal_kg', withLast)
    expect(l2.finish).toBe('inox bóng')
    // Danh mục chưa khai quy cách → Kích thước lấy theo đơn trước.
    expect(l2.dimension_text).toBe('phi 10 x655mm')
    // Danh mục CÓ quy cách thì quy cách danh mục thắng (nguồn chốt).
    expect(
      newLine('metal_kg', { ...withLast, spec: 'Inox hộp 25x50x1.2' }).dimension_text,
    ).toBe('Inox hộp 25x50x1.2')
  })

  it('không có lịch sử → các ô để trống như cũ', () => {
    const l = newLine('carton', bb)
    expect(l.open_style).toBe('')
    expect(l.pcs_per_ctn).toBe('')
    expect(l.material_grade).toBe('')
  })

  /*
   * VẬT LIỆU TỪ DANH MỤC (0124): lần đặt gần nhất vẫn là nguồn tươi nhất, nhưng
   * vật tư CHƯA TỪNG lên đơn thì lấy số khai ở danh mục — trước đây ô này trống
   * và nhân viên phải gõ tay ở từng dòng.
   */
  it('vật liệu: chưa có lịch sử → lấy từ danh mục; có lịch sử → lịch sử thắng', () => {
    const l = newLine('accessory', { ...bb, material_grade: 'Nhựa đen' })
    expect(l.material_grade).toBe('Nhựa đen')
    const l2 = newLine('accessory', {
      ...bb,
      material_grade: 'Nhựa đen',
      last_line: {
        material_grade: 'Nhựa đỏ',
        dimension_text: null,
        finish: null,
        pcs_per_ctn: null,
        open_style: null,
        dm_per_sp: null,
      },
    })
    expect(l2.material_grade).toBe('Nhựa đỏ')
  })

  it('đóng gói mua chép từ danh mục vào dòng', () => {
    const l = newLine('accessory', { ...bb, pack_size: 500, pack_unit: 'bì' })
    expect(l.pack_size).toBe(500)
    expect(l.pack_unit).toBe('bì')
  })

  it('mở SỬA/NHÂN BẢN giữ đúng đóng gói ĐÃ CHỐT trên đơn (0128)', () => {
    // Trước 0128 dòng đơn không lưu đóng gói nên mở sửa là mất quy đổi. Giờ đọc
    // lại từ chính dòng đã lưu — không lấy đóng gói hiện tại của danh mục, vì
    // NCC có thể đã đổi bì 500 → bì 1.000 sau khi đơn được ký.
    const l = lineFromPo({ ...base, pack_size: 500, pack_unit: 'bì' })
    expect(l.pack_size).toBe(500)
    expect(l.pack_unit).toBe('bì')
    // Đơn cũ (null) thì quy đổi tự ẩn như trước, không vỡ.
    expect(lineFromPo(base).pack_size).toBeNull()
    expect(lineFromPo(base).pack_unit).toBe('')
  })
})

/*
 * QUY ĐỔI ĐÓNG GÓI (0124) — ca thật từ đơn Tân Hiệp Phát (LSX 01): cần 13.596
 * con nút bịt, NCC bán bì 500 con. Nhân viên phải tự chia 27,192 trong Excel
 * rồi làm tròn; giờ form gợi ý thẳng 14.000 con (= 28 bì).
 */
describe('packCount / roundUpToPack — quy đổi bao gói', () => {
  it('13.596 con, bì 500 → 27,19 bì; gợi ý tròn 14.000 con', () => {
    expect(packCount(13_596, 500)).toBeCloseTo(27.19, 2)
    expect(roundUpToPack(13_596, 500)).toBe(14_000)
  })

  it('vừa chẵn bao thì giữ nguyên, không cộng thêm một bao', () => {
    expect(roundUpToPack(14_000, 500)).toBe(14_000)
    expect(packCount(14_000, 500)).toBe(28)
  })

  it('không khai đóng gói → trả nguyên số, không quy đổi', () => {
    expect(roundUpToPack(700, null)).toBe(700)
    expect(packCount(700, null)).toBeNull()
    expect(roundUpToPack(700, 0)).toBe(700)
  })

  it('SL 0/âm không quy đổi bậy', () => {
    expect(packCount(0, 500)).toBeNull()
    expect(roundUpToPack(0, 500)).toBe(0)
  })
})

/*
 * KÍNH + XỐP (0134): quy cách danh mục tự bóc vào ô kích thước như carton —
 * "vật tư có quy cách mà không tự điền vào được" là đúng cái lỗi cũ, chỉ khác
 * mẫu. Kính lấy m²/tấm = D×R/10⁶ (số thứ ba là ĐỘ DÀY, không tham gia); xốp
 * lấy đủ D×R×Dày cho công thức khối.
 */
describe('newLine glass/foam — tự bóc quy cách (0134)', () => {
  const kinh: PoMaterial = {
    id: 'm-k',
    code: 'KI-0001',
    name: 'Kính trắng phun mờ cường lực',
    unit: 'Tấm',
    group_name: 'Kính - mặt đá',
    sub_group: null,
    spec: '605x539x5mm',
    kg_per_unit: null,
    kg_per_m: null,
    default_bar_length_m: null,
    price_unit: null,
    unit2_factor: null,
    vat_rate: null,
    default_supplier_id: null,
    last_purchase_price: null,
    pack_size: null,
    pack_unit: null,
    material_grade: null,
    on_hand: 0,
    last_line: null,
  }

  it('kính "605x539x5mm" → m²/tấm = 0,3261 điền sẵn (đúng đơn Mai Trang ~0,33)', () => {
    const l = newLine('glass', kinh)
    expect(l.area_m2).toBeCloseTo(0.3261, 4)
    // basis mặc định theo TẤM — m² chỉ hiện tổng, không đổi cách tính tiền.
    expect(l.carton_basis).toBe('ctn')
  })

  it('kính không quy cách đọc được → m² để trống, nhập tay', () => {
    expect(newLine('glass', { ...kinh, spec: 'Φ600 dày 5mm' }).area_m2).toBe('')
    expect(newLine('glass', { ...kinh, spec: null }).area_m2).toBe('')
  })

  it('xốp "1520x920x10" → D×R×Dày điền sẵn, chọn m³ là tổng khối tự nhảy', () => {
    const l = newLine('foam', { ...kinh, spec: '1520x920x10' })
    expect([l.inner_l_mm, l.inner_w_mm, l.inner_h_mm]).toEqual([1520, 920, 10])
    // m² không dính gì tới xốp — chỉ carton/glass dùng.
    expect(l.area_m2).toBe('')
  })

  it('mút cuộn "8mm x 1.05m x 150m" KHÔNG bị đọc nhầm thành kích thước tấm', () => {
    const l = newLine('foam', { ...kinh, spec: '8mm x 1.05m x 150m' })
    expect(l.inner_l_mm).toBe('')
  })
})

/*
 * SỬA VẬT TƯ TẠI DÒNG ĐƠN (0136 — giai đoạn hoàn thiện data): lưu danh mục
 * xong, dòng đang mở hút lại số mới. Luật: KHÔNG đè số người dùng đã gõ —
 * số gõ tay có thể là phiếu cân NCC, danh mục chỉ lấp ô trống.
 */
describe('refreshLineFromMaterial — hút lại danh mục, không đè số đã gõ', () => {
  const refreshed: MaterialRefresh = {
    name: 'Kính trắng phun mờ CL (đã sửa)',
    unit: 'Tấm',
    spec: '605x539x5mm',
    kg_per_m: null,
    kg_per_unit: null,
    default_bar_length_m: null,
    price_unit: null,
    unit2_factor: null,
    pack_size: 10,
    pack_unit: 'kiện',
    material_grade: 'Kính cường lực',
  }
  const goc = (): Line => ({
    ...newFreeLine(),
    is_free: undefined,
    material_id: 'm-k',
    code: 'KI-0001',
    name: 'Kính trắng (tên cũ)',
    unit: 'tấm',
  })

  it('tên/ĐVT/quy cách/đóng gói luôn theo danh mục; ô trống được lấp', () => {
    const l = refreshLineFromMaterial('glass', goc(), refreshed)
    expect(l.name).toBe('Kính trắng phun mờ CL (đã sửa)')
    expect(l.pack_size).toBe(10)
    expect(l.material_grade).toBe('Kính cường lực')
    // Quy cách vừa bổ sung → m²/tấm tự bóc ngay (605×539/10⁶).
    expect(l.area_m2).toBeCloseTo(0.3261, 4)
  })

  it('số đã gõ tay KHÔNG bị đè', () => {
    const l = refreshLineFromMaterial(
      'glass',
      { ...goc(), area_m2: 0.5, material_grade: 'gõ tay' },
      refreshed,
    )
    expect(l.area_m2).toBe(0.5)
    expect(l.material_grade).toBe('gõ tay')
  })

  it('foam: quy cách mới bổ sung → D×R×Dày lấp vào ô trống', () => {
    const l = refreshLineFromMaterial('foam', goc(), {
      ...refreshed,
      spec: '1520x920x10',
    })
    expect([l.inner_l_mm, l.inner_w_mm, l.inner_h_mm]).toEqual([1520, 920, 10])
  })

  it('metal_kg: kg/tấm vừa khai lấp vào ô trống, catalog_* cập nhật mốc so lệch', () => {
    const l = refreshLineFromMaterial('metal_kg', goc(), {
      ...refreshed,
      kg_per_unit: 23.94,
    })
    expect(l.weight_per_unit).toBe(23.94)
    expect(l.catalog_kg_unit).toBe(23.94)
  })
})

/*
 * NHỚ LẦN ĐẶT GẦN NHẤT cho bộ ô mẫu tính theo kích thước (0136) — đơn lặp lại
 * chỉ còn gõ SL + giá. Quy cách DANH MỤC vẫn thắng; lần trước chỉ lấp khi danh
 * mục không nói được gì.
 */
describe('newLine — recall lần đặt gần nhất (m²/dims/giá m²/basis)', () => {
  const goc: PoMaterial = {
    id: 'm-r',
    code: 'BB-0099',
    name: 'Thùng test recall',
    unit: 'Thùng',
    group_name: 'Bao bì',
    sub_group: null,
    spec: null,
    kg_per_unit: null,
    kg_per_m: null,
    default_bar_length_m: null,
    price_unit: null,
    unit2_factor: null,
    vat_rate: null,
    default_supplier_id: null,
    last_purchase_price: null,
    pack_size: null,
    pack_unit: null,
    material_grade: null,
    on_hand: 0,
    last_line: {
      material_grade: null,
      dimension_text: null,
      finish: null,
      pcs_per_ctn: null,
      open_style: null,
      dm_per_sp: null,
      area_m2: 3.591,
      inner_l_mm: 750,
      inner_w_mm: 625,
      inner_h_mm: 605,
      price_per_m2: 18_770,
      print_fee: 3_278,
      carton_basis: 'ctn',
    },
  }

  it('carton không quy cách danh mục: dims + giá/m² + bản in từ lần trước', () => {
    const l = newLine('carton', goc)
    expect([l.inner_l_mm, l.inner_w_mm, l.inner_h_mm]).toEqual([750, 625, 605])
    expect(l.price_per_m2).toBe(18_770)
    expect(l.print_fee).toBe(3_278)
    // Đủ m² + giá/m² + bản in → gợi ý giá/thùng sống lại ngay từ dòng vừa thêm.
    expect(l.area_m2).toBe(3.591)
    expect(cartonPriceSuggest('carton', l)).toBeCloseTo(70_681.07, 1)
  })

  it('quy cách DANH MỤC thắng kích thước lần trước', () => {
    const l = newLine('carton', { ...goc, spec: '900x605x115' })
    expect([l.inner_l_mm, l.inner_w_mm, l.inner_h_mm]).toEqual([900, 605, 115])
  })

  it('kính: m²/tấm lần trước lấp khi danh mục không có quy cách', () => {
    const l = newLine('glass', {
      ...goc,
      last_line: { ...goc.last_line!, area_m2: 0.33, carton_basis: 'm2' },
    })
    expect(l.area_m2).toBe(0.33)
    expect(l.carton_basis).toBe('m2')
  })

  it('xốp: basis m³ lần trước được nhớ; dims từ lần trước', () => {
    const l = newLine('foam', {
      ...goc,
      last_line: {
        ...goc.last_line!,
        inner_l_mm: 1520,
        inner_w_mm: 920,
        inner_h_mm: 10,
        carton_basis: 'm3',
      },
    })
    expect([l.inner_l_mm, l.inner_w_mm, l.inner_h_mm]).toEqual([1520, 920, 10])
    expect(l.carton_basis).toBe('m3')
  })

  it("basis KHÔNG hợp mẫu thì về 'ctn' — đơn xốp m³ cũ không rót vào dòng carton", () => {
    expect(recallBasis('carton', 'm3')).toBe('ctn')
    expect(recallBasis('glass', 'kg')).toBe('ctn')
    expect(recallBasis('outsourcing', 'kg')).toBe('kg')
    // Mẫu không dùng basis (phụ kiện…) luôn 'ctn'.
    expect(recallBasis('accessory', 'm2')).toBe('ctn')
    // Giá/m² + bản in chỉ thuộc carton — mẫu khác không nhớ.
    const l = newLine('accessory', goc)
    expect(l.price_per_m2).toBe('')
    expect(l.print_fee).toBe('')
  })
})
