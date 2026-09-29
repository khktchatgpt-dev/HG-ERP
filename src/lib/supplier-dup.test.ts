import { describe, expect, it } from 'vitest'
import { findSupplierDupes, normTaxNo } from './supplier-dup'
import { supplierNameKey } from './supplier-code'

// Ca thật trong danh mục 29/09/2026.
const LIST = [
  { id: 'vy', name: 'Công ty TNHH Nhôm Việt Ý', tax_no: '0107595790' },
  {
    id: 'pt1',
    name: 'CÔNG TY TNHH THƯƠNG MẠI TỔNG HỢP PHÚC THỊNH',
    tax_no: '4101443090',
  },
  { id: 'pt2', name: 'CÔNG TY TNHH THƯƠNG MẠI TỔNG HỢP PHÚC THỊNH', tax_no: null },
  {
    id: 'cn',
    name: 'Công ty CP Nhôm Việt Ý - Chi nhánh Bình Dương',
    tax_no: '0107595790-001',
  },
]

describe('normTaxNo', () => {
  it('bỏ khoảng trắng và dấu chấm, giữ gạch nối chi nhánh', () => {
    expect(normTaxNo(' 0107 595.790 ')).toBe('0107595790')
    expect(normTaxNo('0107595790-001')).toBe('0107595790-001')
  })
  it('rỗng là chưa khai (null), không phải chuỗi rỗng', () => {
    expect(normTaxNo('  ')).toBeNull()
    expect(normTaxNo(null)).toBeNull()
  })
})

describe('supplierNameKey', () => {
  it('viết tắt và viết đầy đủ cụm pháp lý ra cùng một khoá', () => {
    expect(supplierNameKey('CÔNG TY TNHH TM TỔNG HỢP PHÚC THỊNH')).toBe(
      supplierNameKey('Công ty TNHH Thương mại Tổng hợp Phúc Thịnh'),
    )
  })
})

describe('findSupplierDupes', () => {
  it('MST gõ có khoảng trắng vẫn bắt được chủ cũ', () => {
    const r = findSupplierDupes(LIST, { name: 'Nhôm Hoàng Gia', tax_no: '0107 595 790' })
    expect(r.taxOwner?.id).toBe('vy')
  })
  it('MST chi nhánh (-001) KHÁC MST công ty mẹ — không coi là trùng', () => {
    const r = findSupplierDupes(LIST, { name: 'X', tax_no: '0107595790-002' })
    expect(r.taxOwner).toBeNull()
  })
  it('tên trùng sau khi bỏ cụm pháp lý → trả CẢ HAI dòng đang có', () => {
    const r = findSupplierDupes(LIST, {
      name: 'Công ty TNHH TM Tổng hợp Phúc Thịnh',
      tax_no: '',
    })
    expect(r.sameName.map((x) => x.id)).toEqual(['pt1', 'pt2'])
    expect(r.taxOwner).toBeNull()
  })
  it('sửa chính NCC đó (exceptId) thì không tự báo trùng với mình', () => {
    const r = findSupplierDupes(LIST, { name: 'Công ty TNHH Nhôm Việt Ý', tax_no: '0107595790' }, 'vy') // prettier-ignore
    expect(r.taxOwner).toBeNull()
    expect(r.sameName).toEqual([])
  })
  it('tên trống thì không báo trùng tên', () => {
    expect(findSupplierDupes(LIST, { name: '  ', tax_no: null }).sameName).toEqual([])
  })
})
