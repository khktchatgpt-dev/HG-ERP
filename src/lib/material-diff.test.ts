import { describe, expect, it } from 'vitest'
import { diffMaterial, normValue } from './material-diff'

describe('normValue', () => {
  it('null / rỗng / khoảng trắng đều là null', () => {
    expect(normValue(null)).toBeNull()
    expect(normValue('')).toBeNull()
    expect(normValue('   ')).toBeNull()
  })
  it('số và chuỗi về cùng một dạng', () => {
    expect(normValue(8)).toBe('8')
    expect(normValue(' AD ')).toBe('AD')
  })
})

describe('diffMaterial', () => {
  it('chỉ soi cột có trong patch — không đẻ vết cho cả bản ghi', () => {
    const before = { spec: null, name: 'Thùng A', last_purchase_price: 125 }
    expect(diffMaterial(before, { spec: '900×605×115' })).toEqual([
      { field: 'spec', before: null, after: '900×605×115' },
    ])
  })

  it('điền ô đang trống → một dòng vết, before null', () => {
    expect(diffMaterial({ open_style: null }, { open_style: 'AD' })).toEqual([
      { field: 'open_style', before: null, after: 'AD' },
    ])
  })

  it('giá bị đè → giữ cả giá cũ lẫn giá mới', () => {
    expect(diffMaterial({ last_purchase_price: 125 }, { last_purchase_price: 140 })).toEqual([
      { field: 'last_purchase_price', before: '125', after: '140' },
    ])
  })

  it('ghi lại đúng giá trị cũ → không có vết', () => {
    expect(diffMaterial({ open_style: 'AD' }, { open_style: 'AD' })).toEqual([])
  })

  it('8 và 8.0 là cùng một số, không phải thay đổi', () => {
    expect(diffMaterial({ vat_rate: 8 }, { vat_rate: '8.0' })).toEqual([])
  })

  it("null → '' không phải thay đổi (form gửi chuỗi rỗng)", () => {
    expect(diffMaterial({ note: null }, { note: '  ' })).toEqual([])
  })

  it('bỏ qua cột máy tự đặt và cột undefined', () => {
    const d = diffMaterial(
      { updated_at: 'x', spec: null },
      { updated_at: 'y', created_at: 'z', spec: undefined },
    )
    expect(d).toEqual([])
  })

  it('nhiều cột đổi một lượt → mỗi cột một dòng', () => {
    const d = diffMaterial(
      { open_style: null, pcs_per_ctn: null },
      { open_style: 'AD', pcs_per_ctn: 4 },
    )
    expect(d.map((c) => c.field)).toEqual(['open_style', 'pcs_per_ctn'])
  })
})
