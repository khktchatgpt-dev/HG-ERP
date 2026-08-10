import { describe, it, expect } from 'vitest'
import { resolveImportRows, type CatalogProduct } from './quote-import-match'
import type { QuoteExcelRow } from './quote-excel'

const CATALOG: CatalogProduct[] = [
  {
    id: 'p1',
    code: 'CH0065HG-AL',
    name: 'Ghế đan mây Rattan',
    customer_item_code: 'H24-206',
    is_active: true,
  },
  // Hai SP khác nhau CÙNG mã khách — khách A và khách B đặt trùng mã.
  {
    id: 'p2',
    code: 'CH0100HG-AL',
    name: 'Ghế Roma',
    customer_item_code: 'DUP-9',
    is_active: true,
  },
  {
    id: 'p3',
    code: 'CH0101HG-AL',
    name: 'Ghế Roma 2',
    customer_item_code: 'DUP-9',
    is_active: true,
  },
  // SP đã ngừng dùng — mã vẫn chiếm chỗ vì technical_products.code là UNIQUE.
  {
    id: 'p4',
    code: 'OLD-001',
    name: 'Ghế cũ ngừng bán',
    customer_item_code: null,
    is_active: false,
  },
]

/** Dòng hợp lệ tối thiểu — mọi trường bắt buộc đã đủ. */
function row(over: Partial<QuoteExcelRow> = {}): QuoteExcelRow {
  return {
    row: 4,
    code: null,
    customer_item_code: null,
    name: 'Ghế nào đó',
    description_en: null,
    length_mm: 700,
    width_mm: 650,
    height_mm: 900,
    material: null,
    colour: null,
    qty_per_carton: null,
    carton_l_cm: null,
    carton_w_cm: null,
    carton_h_cm: null,
    nw_kg: null,
    gw_kg: null,
    loading_40hc: null,
    unit: null,
    unit_price: 50,
    note: null,
    image_id: null,
    missing: [],
    warnings: [],
    ...over,
  }
}

describe('khớp sản phẩm — ca thường', () => {
  it('khớp theo mã nội bộ', () => {
    const [r] = resolveImportRows([row({ code: 'CH0065HG-AL' })], CATALOG)
    expect(r.action).toBe('existing')
    expect(r.matched_product_id).toBe('p1')
  })

  it('khớp theo mã khách khi không có mã nội bộ', () => {
    const [r] = resolveImportRows([row({ customer_item_code: 'H24-206' })], CATALOG)
    expect(r.matched_product_id).toBe('p1')
  })

  it('so mã bỏ qua dấu cách / gạch / hoa thường', () => {
    const [r] = resolveImportRows([row({ code: 'ch 0065 hg-al' })], CATALOG)
    expect(r.matched_product_id).toBe('p1')
  })

  it('không khớp gì → tạo SP mới', () => {
    const [r] = resolveImportRows([row({ name: 'Ghế hoàn toàn mới' })], CATALOG)
    expect(r.action).toBe('new')
    expect(r.matched_product_id).toBeNull()
  })
})

describe('ca hiểm 1 — trùng nhiều SP trong thư viện', () => {
  it('CHẶN thay vì tạo bản trùng thứ ba', () => {
    const [r] = resolveImportRows([row({ customer_item_code: 'DUP-9' })], CATALOG)
    expect(r.action).toBe('blocked')
    expect(r.ambiguous).toBe(true)
    expect(r.blocked_reason).toMatch(/khớp 2 sản phẩm/)
    expect(r.blocked_reason).toMatch(/Mã SP/)
  })

  it('điền mã nội bộ thì hết mơ hồ', () => {
    const [r] = resolveImportRows(
      [row({ code: 'CH0101HG-AL', customer_item_code: 'DUP-9' })],
      CATALOG,
    )
    expect(r.action).toBe('existing')
    expect(r.matched_product_id).toBe('p3')
  })
})

describe('ca hiểm 2 — sản phẩm đã ngừng dùng', () => {
  it('vẫn khớp (không đi tạo mới trùng mã) và cảnh báo', () => {
    const [r] = resolveImportRows([row({ code: 'OLD-001' })], CATALOG)
    expect(r.action).toBe('existing')
    expect(r.matched_product_id).toBe('p4')
    expect(r.warnings.join(' ')).toMatch(/NGỪNG DÙNG/)
  })
})

describe('ca hiểm 3 — trùng dòng trong chính file', () => {
  it('hai dòng cùng khớp một SP → dòng sau bị chặn, chỉ rõ dòng trước', () => {
    const rows = resolveImportRows(
      [row({ row: 4, code: 'CH0065HG-AL' }), row({ row: 5, code: 'CH0065HG-AL' })],
      CATALOG,
    )
    expect(rows[0].action).toBe('existing')
    expect(rows[1].action).toBe('blocked')
    expect(rows[1].blocked_reason).toBe('trùng với dòng 4 trong file')
  })

  it('hai dòng SP MỚI cùng mã → dòng sau bị chặn (nếu không sẽ vỡ UNIQUE code)', () => {
    const rows = resolveImportRows(
      [
        row({ row: 4, code: 'NEW-01', name: 'Ghế mới' }),
        row({ row: 5, code: 'NEW-01', name: 'Ghế mới lần nữa' }),
      ],
      CATALOG,
    )
    expect(rows[0].action).toBe('new')
    expect(rows[1].action).toBe('blocked')
  })

  it('hai dòng SP mới không mã, cùng mã khách → dòng sau bị chặn', () => {
    const rows = resolveImportRows(
      [
        row({ row: 4, customer_item_code: 'ITEM-X', name: 'A' }),
        row({ row: 5, customer_item_code: 'ITEM-X', name: 'B' }),
      ],
      CATALOG,
    )
    expect(rows[1].action).toBe('blocked')
  })

  it('hai SP mới KHÁC nhau thì không chặn nhầm', () => {
    const rows = resolveImportRows(
      [
        row({ row: 4, customer_item_code: 'ITEM-X', name: 'A' }),
        row({ row: 5, customer_item_code: 'ITEM-Y', name: 'B' }),
      ],
      CATALOG,
    )
    expect(rows.map((r) => r.action)).toEqual(['new', 'new'])
  })
})

describe('dòng thiếu dữ liệu', () => {
  it('chặn kèm lý do, không đụng tới việc khớp', () => {
    const [r] = resolveImportRows([row({ missing: ['thiếu đơn giá'] })], CATALOG)
    expect(r.action).toBe('blocked')
    expect(r.blocked_reason).toBe('thiếu đơn giá')
  })

  it('dòng bị chặn KHÔNG chiếm chỗ chống trùng của dòng sau', () => {
    const rows = resolveImportRows(
      [
        row({ row: 4, code: 'CH0065HG-AL', missing: ['thiếu đơn giá'] }),
        row({ row: 5, code: 'CH0065HG-AL' }),
      ],
      CATALOG,
    )
    expect(rows[0].action).toBe('blocked')
    expect(rows[1].action).toBe('existing')
  })
})
