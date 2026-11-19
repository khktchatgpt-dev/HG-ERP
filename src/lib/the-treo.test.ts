import { describe, expect, it } from 'vitest'
import QRCode from 'qrcode'
import {
  buildThe,
  chiaTo,
  dichGiaTri,
  frameOf,
  ngayVn,
  qrPath,
  sapTheoKhu,
  soTo,
  theThieu,
  type TheNguon,
} from './the-treo'

const sp = (o: Partial<TheNguon> = {}): TheNguon => ({
  id: 'p1',
  code: 'TB0174HG-AL',
  name: '  Bàn xếp   Santorin ',
  description_en: null,
  frame_material: 'AL',
  length_mm: 740,
  width_mm: 600,
  height_mm: 225,
  tech_spec: { wood: 'Acacia FSC 100% Màu 142', paint: 'Màu Graphit H-SM-9608' },
  customer_name: 'MERXX',
  customer_item_code: '22028-209',
  image_url: '/api/files/x/img?s=1',
  showroom_zone: null,
  showroom_sample: false,
  showroom_tagged_at: null,
  ...o,
})

describe('buildThe', () => {
  it('đủ dữ liệu: khung + gỗ + sơn, kích thước số nguyên, tên gọn khoảng trắng', () => {
    const t = buildThe(sp(), { khach: false })
    expect(t.name).toBe('Bàn xếp Santorin')
    expect(t.dims).toEqual({ l: 740, w: 600, h: 225 })
    expect(t.rows.map((r) => r.vi)).toEqual(['Khung', 'Gỗ', 'Sơn'])
    expect(t.rows[0].value).toBe('Aluminium')
    expect(t.en).toBeNull()
  })

  it('Q2: mặc định KHÔNG mang tên / mã khách; bật ô thì ghép "khách · mã"', () => {
    expect(buildThe(sp(), { khach: false }).khach).toBeNull()
    expect(buildThe(sp(), { khach: true }).khach).toBe('MERXX · 22028-209')
    expect(
      buildThe(sp({ customer_name: null, customer_item_code: null }), { khach: true })
        .khach,
    ).toBeNull()
  })

  it('Q3: dòng tiếng Anh chỉ từ Mô tả EN', () => {
    expect(buildThe(sp({ description_en: ' Folding table ' }), { khach: false }).en).toBe(
      'Folding table',
    )
  })

  it('Q5: thiếu một chiều là coi như chưa có kích thước (ô để trống ghi tay)', () => {
    expect(buildThe(sp({ height_mm: null }), { khach: false }).dims).toBeNull()
    expect(buildThe(sp({ width_mm: 0 }), { khach: false }).dims).toBeNull()
  })

  it('"xác nhận sau", "-", rỗng không lên thẻ', () => {
    const t = buildThe(
      sp({
        tech_spec: {
          paint: 'xác nhận sau',
          cushion: 'Xác nhận sau',
          fabric: '-',
          wood: '  ',
          glass: 'Kính cường lực 8mm',
          machine: 'không phải thông số thẻ',
        },
      }),
      { khach: false },
    )
    expect(t.rows.map((r) => r.vi)).toEqual(['Khung', 'Kính'])
  })

  it('khung đọc đuôi mã khi cột trống; XX (chưa xác định) không in', () => {
    expect(frameOf(null, 'SL0187HG-IR')).toEqual(['Sắt', 'Steel'])
    expect(frameOf('XX', 'AC0012HG-XX')).toBeNull()
    expect(
      buildThe(sp({ frame_material: 'XX', code: 'AC0012HG-XX' }), { khach: false }).rows,
    ).toHaveLength(2)
  })
})

describe('theThieu', () => {
  it('cùng một hàm cho cảnh báo kích thước + ảnh', () => {
    expect(theThieu(sp())).toEqual({ kt: false, anh: false })
    expect(theThieu(sp({ length_mm: null, image_url: null }))).toEqual({
      kt: true,
      anh: true,
    })
  })
})

describe('chia tờ', () => {
  it('2 thẻ/tờ: 5 thẻ → 3 tờ, tờ cuối 1 thẻ; 4 thẻ/tờ: 167 → 42 tờ', () => {
    const t = chiaTo([1, 2, 3, 4, 5], 2)
    expect(t).toEqual([[1, 2], [3, 4], [5]])
    expect(soTo(167, 2)).toBe(84)
    expect(soTo(167, 4)).toBe(42)
    expect(chiaTo([], 2)).toEqual([])
  })
})

describe('ngayVn', () => {
  it('19:30 UTC là sáng hôm sau ở VN', () => {
    expect(ngayVn('2026-11-19T19:30:00+00:00')).toBe('20/11/2026')
    expect(ngayVn(null)).toBe('')
  })
})

describe('sapTheoKhu', () => {
  it('theo khu A1 → K2, chưa có khu xuống cuối, cùng khu theo mã', () => {
    const r = sapTheoKhu([
      { code: 'CH0003', showroom_zone: null },
      { code: 'CH0002', showroom_zone: 'K2' },
      { code: 'CH0009', showroom_zone: 'A1' },
      { code: 'CH0001', showroom_zone: 'A1' },
    ])
    expect(r.map((x) => x.code)).toEqual(['CH0001', 'CH0009', 'CH0002', 'CH0003'])
  })
})

describe('qrPath', () => {
  it('vẽ đúng từng ô đen của ma trận QR', () => {
    const url = 'https://erp.example.vn/products/5f0c2a3e-6d0b-4f0a-9a54-1b2c3d4e5f60'
    const { size, d } = qrPath(url)
    const m = QRCode.create(url, { errorCorrectionLevel: 'M' }).modules
    expect(size).toBe(m.size)
    let dark = 0
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (m.get(y, x)) dark++
    // Tổng bề rộng các đoạn "h…" = số ô đen.
    const sum = [...d.matchAll(/h(\d+)v1/g)].reduce((s, x) => s + Number(x[1]), 0)
    expect(sum).toBe(dark)
  })
})

describe('thẻ xuất khẩu — tiếng Anh, inch, đóng gói', () => {
  it('dịch giá trị đang có trong DB và dịch theo từ cho giá trị mới', () => {
    expect(dichGiaTri('Sơn đen')).toBe('Black powder coat')
    expect(dichGiaTri('  Màu  Graphit H-SM-9608 ')).toBe('Graphite H-SM-9608')
    expect(dichGiaTri('Kính mờ')).toBe('Frosted glass')
    expect(dichGiaTri('Gỗ keo - non FSC')).toBe('Acacia (non-FSC)')
    expect(dichGiaTri('HG-T650-07 (T07)')).toBe('HG-T650-07 (T07)')
    expect(dichGiaTri('Sơn trắng mờ')).not.toMatch(/[ơắ]/)
  })

  it('thông số in tiếng Anh; "0" coi như trống', () => {
    const t = buildThe(sp({ tech_spec: { paint: 'Sơn đen', wood: '0' } }), {
      khach: false,
    })
    expect(t.rows.map((r) => [r.en, r.value])).toEqual([
      ['Frame', 'Aluminium'],
      ['Finish', 'Black powder coat'],
    ])
  })

  it('inch, đóng gói, trọng lượng, công ty sản xuất', () => {
    const t = buildThe(
      sp({
        packing: {
          carton_l_cm: 133,
          carton_w_cm: 81,
          carton_h_cm: 53.4,
          qty_per_carton: 1,
          cbm: 0.5754,
          loading_40hc: 108,
          gw_kg: 12.5,
        },
        net_weight_kg: 9,
        origin_country: null,
      }),
      { khach: false },
    )
    expect(t.inch).toBe('29.1 × 23.6 × 8.9 in')
    expect(t.pack.map((r) => r.value)).toEqual([
      '133 × 81 × 53.4 cm · 1 pc/ctn',
      '0.575 m³ · 108 pcs/40HC',
      '9 / 12.5 kg',
    ])
    expect(t.origin).toBe('Manufactured by Hoang Gia Co., Ltd.')
    expect(buildThe(sp({ packing: null }), { khach: false }).pack).toEqual([])
    expect(buildThe(sp({ height_mm: null }), { khach: false }).inch).toBeNull()
  })
})
