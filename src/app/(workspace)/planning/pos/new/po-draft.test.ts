import { describe, expect, it } from 'vitest'
import { poTemplateMeta } from '@/lib/po-template'
import {
  buildPoPayload,
  draftProblem,
  poTotals,
  templateDefaults,
  type PoHeader,
} from './po-draft'
import type { Line } from './po-line'

const line = (over: Partial<Line> = {}): Line => ({
  material_id: 'm1',
  code: 'NK-0001',
  name: 'Vít 4x15, 7 màu',
  unit: 'con',
  on_hand: 0,
  spec: '',
  note: '',
  qty: 100,
  price: 1000,
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
  carton_basis: 'ctn',
  pack_size: null,
  pack_unit: '',
  ...over,
})

const header = (over: Partial<PoHeader> = {}): PoHeader => ({
  template: 'accessory',
  poType: 'lsx',
  lsxId: 'lsx-1',
  extraLsxIds: [],
  supplierId: 'ncc-1',
  expectedAt: '',
  contractNo: '',
  currency: 'VND',
  note: '',
  discount: '',
  vat: 8,
  inclVat: false,
  terms: poTemplateMeta('accessory').terms,
  signerRole: 'TRƯỞNG PHÒNG CUNG ỨNG',
  ...over,
})

describe('templateDefaults — đổi mẫu kéo theo VAT / điều khoản / chữ ký', () => {
  it('phụ kiện: VAT 8% chưa gồm, ký "TRƯỞNG PHÒNG CUNG ỨNG"', () => {
    const d = templateDefaults('accessory')
    expect(d.vat).toBe(8)
    expect(d.inclVat).toBe(false)
    expect(d.signerRole).toBe('TRƯỞNG PHÒNG CUNG ỨNG')
  })

  it('nhôm: VAT 10% chưa gồm, ký TP KẾ HOẠCH', () => {
    const d = templateDefaults('aluminium')
    expect(d.vat).toBe(10)
    expect(d.inclVat).toBe(false)
    expect(d.signerRole).toMatch(/KẾ HOẠCH/i)
  })

  it('inox/sắt: giá ĐÃ gồm VAT — khác hẳn hai mẫu trên', () => {
    expect(templateDefaults('metal_kg').inclVat).toBe(true)
  })
})

describe('poTotals — thứ tự cộng tiền của phiếu thật', () => {
  it('hàng → trừ chiết khấu → VAT trên phần còn lại', () => {
    const t = poTotals(header({ discount: 100_000, vat: 10, inclVat: false }), [
      line({ qty: 1000, price: 1000 }), // 1.000.000
    ])
    expect(t.subtotal).toBe(1_000_000)
    expect(t.vatAmount).toBe(90_000) // 10% của 900.000, không phải của 1.000.000
    expect(t.grandTotal).toBe(990_000)
  })

  it('giá ĐÃ gồm VAT thì tách ngược, không cộng thêm', () => {
    const t = poTotals(header({ vat: 10, inclVat: true }), [
      line({ qty: 1, price: 1_100_000 }),
    ])
    expect(t.vatAmount).toBe(100_000)
    expect(t.grandTotal).toBe(1_100_000) // giữ nguyên tiền hàng
  })

  it('làm tròn về đồng ngay ở tiền hàng — phiếu in không có số lẻ', () => {
    // Nhôm: 0,248 kg/m × 5,65 m × 273 cây × 102.000 = 39.017.815,2
    const t = poTotals(header({ template: 'aluminium', vat: '', inclVat: false }), [
      line({ qty: 273, price: 102_000, weight_per_m: 0.248, bar_length_m: 5.65 }),
    ])
    expect(Number.isInteger(t.subtotal)).toBe(true)
    expect(t.subtotal).toBe(39_017_815)
  })

  it('chiết khấu lớn hơn tiền hàng không làm âm', () => {
    const t = poTotals(header({ discount: 5_000_000, vat: 10 }), [
      line({ qty: 1, price: 1000 }),
    ])
    expect(t.grandTotal).toBe(0)
  })
})

describe('draftProblem — chặn gửi khi đơn chưa đủ', () => {
  it('đơn theo LSX mà chưa chọn LSX', () => {
    expect(draftProblem(header({ lsxId: '' }), [line()])).toBe('chưa chọn LSX')
  })

  it('đơn ngoài LSX thì không đòi LSX', () => {
    expect(draftProblem(header({ poType: 'standalone', lsxId: '' }), [line()])).toBeNull()
  })

  it('thiếu NCC / thiếu dòng', () => {
    expect(draftProblem(header({ supplierId: '' }), [line()])).toMatch(/nhà cung cấp/)
    expect(draftProblem(header(), [])).toMatch(/chưa có dòng/)
  })

  /*
   * Lý do phải CHỈ ĐÍCH DANH: đơn 20 dòng mà chỉ báo "2 dòng còn thiếu số" thì
   * người dùng phải tự dò từng dòng, trong khi `lineProblem` đã biết chính xác.
   */
  it('dòng thiếu số → nói rõ DÒNG NÀO và THIẾU GÌ', () => {
    expect(draftProblem(header(), [line(), line({ material_id: 'm2', qty: '' })])).toBe(
      'dòng 2 thiếu SL đặt',
    )
    expect(
      draftProblem(header(), [line({ price: '' }), line({ material_id: 'm2', qty: '' })]),
    ).toBe('dòng 1 thiếu đơn giá (và 1 dòng nữa)')
  })
})

describe('buildPoPayload', () => {
  it('đơn ngoài LSX gửi production_order_id = null', () => {
    const p = buildPoPayload(header({ poType: 'standalone', lsxId: 'lsx-1' }), [line()])
    expect(p.production_order_id).toBeNull()
  })

  it('cơ sở tính tiền chỉ gửi ở mẫu bao bì', () => {
    expect(
      buildPoPayload(header(), [line({ carton_basis: 'm2' })]).lines[0].carton_basis,
    ).toBeNull()
    expect(
      buildPoPayload(header({ template: 'carton' }), [line({ carton_basis: 'm2' })])
        .lines[0].carton_basis,
    ).toBe('m2')
  })

  it('ô trống gửi null, không gửi 0 — "chưa nhập" khác "nhập 0"', () => {
    const l = buildPoPayload(header(), [line({ price: '' })]).lines[0]
    expect(l.unit_price).toBeNull()
  })

  it('chiết khấu 0 gửi null cho sạch chứng từ', () => {
    expect(buildPoPayload(header({ discount: '' }), [line()]).discount_amount).toBeNull()
    expect(buildPoPayload(header({ discount: 50_000 }), [line()]).discount_amount).toBe(
      50_000,
    )
  })

  it('KHÔNG gửi qty2 / price_basis — server tự dẫn xuất', () => {
    /*
     * Client chỉ gửi thông số gốc (kg/m, dài cây, kg/đv, m²); `pos.service` dẫn
     * xuất lại tổng kg và cơ sở tính tiền. Gửi kèm là mở đường cho một request
     * thủ công ghi tổng kg không khớp thông số của chính nó rồi đi thẳng qua bàn
     * duyệt của Giám đốc.
     */
    const l = buildPoPayload(header({ template: 'aluminium' }), [
      line({ qty: 273, weight_per_m: 0.248, bar_length_m: 5.65 }),
    ]).lines[0]
    expect(l).not.toHaveProperty('qty2')
    expect(l).not.toHaveProperty('price_basis')
    expect(l.weight_per_m).toBe(0.248)
    expect(l.qty_ordered).toBe(273)
  })
})
