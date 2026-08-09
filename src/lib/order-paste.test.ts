import { describe, it, expect } from 'vitest'
import { parseMoney, parseOrderPaste, type PasteProduct } from './order-paste'

const PRODUCTS: PasteProduct[] = [
  { id: 'p1', code: 'HG-001', name: 'Ghế Santorini', customer_item_code: 'PT-138-155' },
  { id: 'p2', code: 'HG-002', name: 'Bàn Milano', customer_item_code: '17976-A' },
  // Hai SP cùng mã KHÁCH (hai khách khác nhau dùng trùng mã) — phải coi là mơ hồ.
  { id: 'p3', code: 'HG-003', name: 'Ghế Roma', customer_item_code: 'DUP-9' },
  { id: 'p4', code: 'HG-004', name: 'Ghế Roma 2', customer_item_code: 'DUP-9' },
]

describe('parseMoney — hai quy ước số lẫn nhau', () => {
  it('kiểu VN: dấu chấm phân nhóm nghìn, phẩy thập phân', () => {
    expect(parseMoney('1.234.567')).toBe(1234567)
    expect(parseMoney('1.234,56')).toBe(1234.56)
    expect(parseMoney('250.000')).toBe(250000)
  })

  it('kiểu Anh–Mỹ (đơn xuất khẩu): phẩy phân nhóm nghìn, chấm thập phân', () => {
    expect(parseMoney('1,234.56')).toBe(1234.56)
    expect(parseMoney('12,000')).toBe(12000)
    expect(parseMoney('45.90')).toBe(45.9)
  })

  it('chỉ có phẩy: 3 chữ số sau = nghìn, còn lại = thập phân', () => {
    expect(parseMoney('1,200')).toBe(1200)
    expect(parseMoney('12,5')).toBe(12.5)
  })

  it('bỏ ký hiệu tiền tệ và khoảng trắng', () => {
    expect(parseMoney(' $ 45.90 ')).toBe(45.9)
    expect(parseMoney('250.000 đ')).toBe(250000)
  })

  it('ô rỗng / không phải số → null', () => {
    expect(parseMoney('')).toBeNull()
    expect(parseMoney(undefined)).toBeNull()
    expect(parseMoney('—')).toBeNull()
  })
})

describe('parseOrderPaste — có dòng tiêu đề', () => {
  it('nhận cột theo tiêu đề, khớp SP theo mã của khách', () => {
    const text = [
      'Item code\tQty\tUnit price\tNote',
      'PT-138-155\t120\t45.90\tgiao đợt 1',
      '17976-A\t50\t120.00\t',
    ].join('\n')

    const r = parseOrderPaste(text, PRODUCTS)

    expect(r.source).toBe('header')
    expect(r.rows).toHaveLength(2)
    expect(r.rows[0]).toMatchObject({
      product_id: 'p1',
      qty: 120,
      unit_price: 45.9,
      note: 'giao đợt 1',
    })
    expect(r.rows[1]).toMatchObject({ product_id: 'p2', qty: 50, unit_price: 120 })
    expect(r.skipped[0].reason).toBe('dòng tiêu đề')
  })

  it('cột "Thành tiền" bị bỏ qua — app tự nhân lại', () => {
    const text = ['Mã SP\tSL\tĐơn giá\tThành tiền', 'HG-001\t10\t45.90\t459.00'].join(
      '\n',
    )
    const r = parseOrderPaste(text, PRODUCTS)
    expect(r.rows[0].unit_price).toBe(45.9)
    expect(r.mapped.map((m) => m.label)).not.toContain('—')
  })
})

describe('parseOrderPaste — không có tiêu đề (đoán cột)', () => {
  it('một cột số duy nhất = ĐƠN GIÁ (ca bù giá cho đơn đã có số lượng)', () => {
    const r = parseOrderPaste('PT-138-155\t45.90\n17976-A\t120', PRODUCTS)
    expect(r.source).toBe('guess')
    expect(r.rows[0]).toMatchObject({ product_id: 'p1', unit_price: 45.9, qty: null })
    expect(r.rows[1]).toMatchObject({ product_id: 'p2', unit_price: 120 })
  })

  it('hai cột số = SL rồi ĐƠN GIÁ', () => {
    const r = parseOrderPaste('PT-138-155\t120\t45.90', PRODUCTS)
    expect(r.rows[0]).toMatchObject({ qty: 120, unit_price: 45.9 })
  })
})

describe('parseOrderPaste — khớp sản phẩm', () => {
  it('mã nội bộ thắng mã khách; so mã bỏ qua dấu cách và gạch', () => {
    const r = parseOrderPaste('hg 001\t10\t1', PRODUCTS)
    expect(r.rows[0].product_id).toBe('p1')
  })

  it('trùng mã khách ở 2 SP → đánh dấu mơ hồ, KHÔNG đoán bừa', () => {
    const r = parseOrderPaste('DUP-9\t10\t1', PRODUCTS)
    expect(r.rows[0].product_id).toBeNull()
    expect(r.rows[0].ambiguous).toBe(true)
  })

  it('không khớp SP nào → vẫn trả dòng, để người dán tự chọn', () => {
    const r = parseOrderPaste('KHONG-CO\t10\t1', PRODUCTS)
    expect(r.rows[0]).toMatchObject({
      product_id: null,
      ambiguous: false,
      raw_key: 'KHONG-CO',
    })
  })
})

describe('parseOrderPaste — dòng rác', () => {
  it('bỏ dòng tổng cộng và dòng trống, có nêu lý do', () => {
    const text = ['PT-138-155\t10\t45.90', '', 'TỔNG CỘNG\t\t459.00'].join('\n')
    const r = parseOrderPaste(text, PRODUCTS)
    expect(r.rows).toHaveLength(1)
    expect(r.skipped.map((s) => s.reason)).toContain('dòng tổng cộng')
  })

  it('dòng không có mã/tên → bỏ kèm lý do, không nuốt im lặng', () => {
    const r = parseOrderPaste('\t10\t45.90', PRODUCTS)
    expect(r.rows).toHaveLength(0)
    expect(r.skipped[0].reason).toBe('không có mã / tên sản phẩm')
  })
})
