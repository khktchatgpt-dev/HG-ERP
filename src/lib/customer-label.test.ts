import { describe, expect, it } from 'vitest'
import { customerLabelFrom, normalizeCustomerLabel } from './customer-label'

describe('normalizeCustomerLabel', () => {
  it('viết hoa hết — lớp trùng "chỉ khác hoa/thường" không tái sinh được', () => {
    // Ca thật: LAURA 93 SP nằm cạnh Laura 17 SP, người lọc bị chia đôi danh sách.
    expect(normalizeCustomerLabel('Laura')).toBe('LAURA')
    expect(normalizeCustomerLabel('LAURA')).toBe('LAURA')
    expect(normalizeCustomerLabel('Shelter Home')).toBe('SHELTER HOME')
  })

  it('gộp khoảng trắng thừa, kể cả no-break space dán từ Excel', () => {
    expect(normalizeCustomerLabel('  MERXX   HANDELS  ')).toBe('MERXX HANDELS')
    expect(normalizeCustomerLabel('MERXX HANDELS')).toBe('MERXX HANDELS')
  })

  it('rỗng / chỉ khoảng trắng → null (mẫu chung)', () => {
    expect(normalizeCustomerLabel('')).toBeNull()
    expect(normalizeCustomerLabel('   ')).toBeNull()
    expect(normalizeCustomerLabel(null)).toBeNull()
    expect(normalizeCustomerLabel(undefined)).toBeNull()
  })

  it('giữ dấu tiếng Việt và ký tự trong tên riêng', () => {
    // Tên khách là thứ pháp lý — chuẩn hoá quá tay là sửa tên người ta.
    expect(normalizeCustomerLabel('Hàng dự án')).toBe('HÀNG DỰ ÁN')
    expect(normalizeCustomerLabel("giga steve's")).toBe("GIGA STEVE'S")
    expect(normalizeCustomerLabel('M&S Home')).toBe('M&S HOME')
  })

  it('chạy lại trên kết quả của chính nó không đổi gì (idempotent)', () => {
    const once = normalizeCustomerLabel(' modern  sourcing ')
    expect(normalizeCustomerLabel(once)).toBe(once)
  })
})

describe('customerLabelFrom', () => {
  it('lấy MÃ khách, không lấy tên pháp nhân', () => {
    // Lấy name thì Kinh doanh tạo nhanh một SP là đẻ lại nhãn trùng vừa dọn.
    expect(customerLabelFrom({ code: 'MERXX', name: 'MERXX HANDELS GMBH' })).toBe('MERXX')
    expect(customerLabelFrom({ code: 'YOTRIO', name: 'YOTRIO GROUP' })).toBe('YOTRIO')
  })

  it('không có mã thì dùng tên', () => {
    expect(customerLabelFrom({ code: null, name: 'Bondesari' })).toBe('BONDESARI')
    expect(customerLabelFrom({ code: '  ', name: 'Bondesari' })).toBe('BONDESARI')
  })

  it('không có gì thì null', () => {
    expect(customerLabelFrom({ code: null, name: null })).toBeNull()
  })
})
