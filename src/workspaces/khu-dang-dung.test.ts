import { describe, expect, it } from 'vitest'
import { WORKSPACES } from './workspaces.config'
import { khuCoMuc, khuGhiCookie, khuTheoDuongDan, khuTuCookie } from './khu-dang-dung'

describe('khu đang đứng (giữ sidebar cho trang dùng chung)', () => {
  it('đường dẫn → khu sở hữu; trang dùng chung không thuộc khu nào', () => {
    expect(khuTheoDuongDan('/finance/so-cong-no')?.id).toBe('finance')
    expect(khuTheoDuongDan('/hr')?.id).toBe('hr')
    expect(khuTheoDuongDan('/admin/users')?.id).toBe('system')
    expect(khuTheoDuongDan('/ho-so-luong')).toBeNull()
    expect(khuTheoDuongDan('/products/1')).toBeNull()
  })

  it('cookie lạ bị bỏ qua', () => {
    expect(khuTuCookie('finance')?.id).toBe('finance')
    expect(khuTuCookie('khong-co')).toBeNull()
    expect(khuTuCookie(undefined)).toBeNull()
  })

  it('khu lương chỉ giữ khu có mục lương trong sidebar', () => {
    expect(khuCoMuc(WORKSPACES.finance, '/ho-so-luong')).toBe(true)
    expect(khuCoMuc(WORKSPACES.hr, '/ho-so-luong')).toBe(true)
    expect(khuCoMuc(WORKSPACES.system, '/ho-so-luong')).toBe(true)
    expect(khuCoMuc(WORKSPACES.sales, '/ho-so-luong')).toBe(false)
  })

  it('gia đình SX (10/11/2026): trang riêng đổi khu, trang dùng chung giữ khu đang đứng', () => {
    expect(khuGhiCookie('/thongke/ghi', 'production')).toBe('thongke')
    expect(khuGhiCookie('/production', 'thongke')).toBe('production')
    expect(khuGhiCookie('/thongke/lenh', 'thongke')).toBeNull()
    expect(khuGhiCookie('/thongke/lsx/abc', 'thongke')).toBeNull()
    expect(khuGhiCookie('/thongke/bao-cao', 'production')).toBeNull()
    // Người ngoài gia đình (Kho) mở Lệnh SX → đổi sang khu sở hữu như cũ.
    expect(khuGhiCookie('/thongke/lenh', 'warehouse')).toBe('production')
    expect(khuGhiCookie('/thongke/lenh', undefined)).toBe('production')
    expect(khuGhiCookie('/ho-so-luong', 'finance')).toBeNull()
    expect(khuGhiCookie('/finance', 'finance')).toBeNull()
  })
})
