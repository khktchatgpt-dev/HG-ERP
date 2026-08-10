import { describe, it, expect } from 'vitest'
import { parseNum, parseQuoteExcel } from './quote-excel'

/** Dòng tiêu đề đúng như mẫu `scripts/make-quote-template.mjs` sinh ra. */
const HEADER = [
  'Mã SP (HG)',
  'Mã khách (Item code)',
  'Tên SP (tiếng Việt) *',
  'Description (EN)',
  'Ảnh (Photo)',
  'Dài/Sâu D (mm) *',
  'Rộng W (mm) *',
  'Cao H (mm) *',
  'Chất liệu',
  'Mã màu (Colour code)',
  'SL / thùng',
  'Carton dài (cm)',
  'Carton rộng (cm)',
  'Carton cao (cm)',
  'NW (kg)',
  'GW (kg)',
  "Loading 40'HC",
  'ĐVT',
  'Đơn giá (FOB) *',
  'Ghi chú',
]

const rowFull = [
  '',
  'H24-206',
  'Ghế đan mây Rattan',
  'Rattan armchair',
  '',
  548,
  565,
  876,
  'ALU + PE rattan',
  'PM363',
  2,
  59.5,
  91,
  78,
  12.5,
  14,
  910,
  'cai',
  45.9,
  'SP mới',
]

describe('parseNum', () => {
  it('lấy thẳng khi ô đã là số', () => {
    expect(parseNum(548)).toBe(548)
    expect(parseNum(45.9)).toBe(45.9)
  })

  it('chịu cả hai quy ước dấu', () => {
    expect(parseNum('1.234,56')).toBe(1234.56)
    expect(parseNum('1,234.56')).toBe(1234.56)
    expect(parseNum('12,000')).toBe(12000)
    expect(parseNum('12,5')).toBe(12.5)
  })

  it('bỏ ký hiệu tiền tệ / đơn vị bám theo số', () => {
    expect(parseNum('$45.90')).toBe(45.9)
    expect(parseNum('548 mm')).toBe(548)
  })

  it('ô trống / gạch ngang → null', () => {
    expect(parseNum('')).toBeNull()
    expect(parseNum('—')).toBeNull()
    expect(parseNum(null)).toBeNull()
  })
})

describe('parseQuoteExcel — nhận cột theo tiêu đề', () => {
  it('đọc đủ một dòng sản phẩm mới', () => {
    const r = parseQuoteExcel([['BÁO GIÁ — SẢN PHẨM MỚI'], [], HEADER, rowFull])
    expect(r.headerRow).toBe(3)
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0]).toMatchObject({
      row: 4,
      code: null,
      customer_item_code: 'H24-206',
      name: 'Ghế đan mây Rattan',
      length_mm: 548,
      width_mm: 565,
      height_mm: 876,
      qty_per_carton: 2,
      carton_l_cm: 59.5,
      nw_kg: 12.5,
      loading_40hc: 910,
      unit_price: 45.9,
      missing: [],
    })
  })

  it('CỘT CARTON không bị nuốt vào kích thước SP', () => {
    const r = parseQuoteExcel([HEADER, rowFull])
    const row = r.rows[0]
    expect(row.length_mm).toBe(548) // không phải 59.5 của carton
    expect(row.carton_l_cm).toBe(59.5)
    expect(row.carton_w_cm).toBe(91)
    expect(row.carton_h_cm).toBe(78)
  })

  it('không có dòng tiêu đề nhận ra được → trả rỗng, không đoán bừa', () => {
    const r = parseQuoteExcel([
      ['abc', 'def'],
      [1, 2],
    ])
    expect(r.headerRow).toBeNull()
    expect(r.rows).toHaveLength(0)
  })
})

describe('parseQuoteExcel — thiếu và ngờ vực', () => {
  it('thiếu tên / giá / kích thước → liệt kê ra, vẫn trả dòng', () => {
    const row = [
      '',
      'H24-207',
      '',
      '',
      '',
      548,
      null,
      876,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      null,
      '',
    ]
    const r = parseQuoteExcel([HEADER, row])
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0].missing).toContain('tên sản phẩm')
    expect(r.rows[0].missing).toContain('đơn giá')
    expect(r.rows[0].missing).toContain('kích thước (D×R×C mm)')
  })

  it('ba số kích thước đều nhỏ → cảnh báo có thể đang điền cm, KHÔNG tự nhân 10', () => {
    const row = [
      '',
      '',
      'Ghế',
      '',
      '',
      54.8,
      56.5,
      87.6,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      10,
      '',
    ]
    const r = parseQuoteExcel([HEADER, row])
    expect(r.rows[0].length_mm).toBe(54.8) // giữ nguyên số người điền
    expect(r.rows[0].warnings[0]).toMatch(/cm thay vì mm/)
  })

  it('kích thước mm bình thường thì không cảnh báo', () => {
    const r = parseQuoteExcel([HEADER, rowFull])
    expect(r.rows[0].warnings).toHaveLength(0)
  })

  it('bỏ dòng tổng cộng và dòng rỗng ruột, có nêu lý do', () => {
    const empty = [
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      'ghi chú lạc',
    ]
    const total = [
      'TỔNG CỘNG',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      999,
      '',
    ]
    const r = parseQuoteExcel([HEADER, rowFull, empty, total])
    expect(r.rows).toHaveLength(1)
    expect(r.skipped.map((s) => s.reason)).toEqual(
      expect.arrayContaining(['không có tên / mã sản phẩm', 'dòng tổng cộng']),
    )
  })
})

describe('parseQuoteExcel — ảnh neo theo dòng', () => {
  it('gắn ảnh đúng dòng sản phẩm', () => {
    // Khoá của map là SỐ DÒNG TRONG FILE (1-based): HEADER ở dòng 1 ⇒ hai dòng
    // hàng nằm ở dòng 2 và 3. Ảnh neo dòng 3 chỉ được gắn cho sản phẩm thứ hai.
    const r = parseQuoteExcel([HEADER, rowFull, rowFull], new Map([[3, 'img-1']]))
    expect(r.rows[0].image_id).toBeNull()
    expect(r.rows[1].image_id).toBe('img-1')
  })

  it('ảnh neo lệch dòng thì KHÔNG gắn cho dòng khác', () => {
    const r = parseQuoteExcel([HEADER, rowFull], new Map([[99, 'img-x']]))
    expect(r.rows[0].image_id).toBeNull()
  })
})
