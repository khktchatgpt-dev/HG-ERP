import { describe, expect, it } from 'vitest'
import { chuyenThuVienCu, isHoSoTab } from './thu-vien-chuyen'

const ID = '51f8d767-37c9-488f-83dd-613148c43a68'

describe('chuyển thư viện SP cũ → mới', () => {
  it('hồ sơ và tab', () => {
    expect(chuyenThuVienCu(`/products/${ID}`, '')).toBe(`/thu-vien/${ID}`)
    expect(chuyenThuVienCu(`/products/${ID}/dinh-muc`, '')).toBe(
      `/thu-vien/${ID}?tab=dinh-muc`,
    )
    expect(chuyenThuVienCu(`/products/${ID}/tai-lieu`, '')).toBe(
      `/thu-vien/${ID}?tab=tai-lieu`,
    )
    // Thông số nằm ngay đầu hồ sơ mới → tab mặc định; lộ trình có tab riêng (B5).
    expect(chuyenThuVienCu(`/products/${ID}/thong-so`, '')).toBe(`/thu-vien/${ID}`)
    expect(chuyenThuVienCu(`/products/${ID}/lo-trinh`, '')).toBe(
      `/thu-vien/${ID}?tab=lo-trinh`,
    )
  })

  it('danh sách: khách + mẫu showroom đổi sang tham số mới', () => {
    expect(chuyenThuVienCu('/products', '')).toBe('/thu-vien')
    expect(chuyenThuVienCu('/products', '?customer=MERXX')).toBe('/thu-vien?kh=MERXX')
    expect(chuyenThuVienCu('/products', '?showroom=chua_the')).toBe(
      '/thu-vien?mau=co&the=chua',
    )
    expect(chuyenThuVienCu('/products/new', '')).toBe('/thu-vien')
  })

  it('đường Kỹ thuật cũ đi thẳng sang mới, không hai bước', () => {
    expect(chuyenThuVienCu(`/technical/products/${ID}`, '')).toBe(`/thu-vien/${ID}`)
    expect(chuyenThuVienCu('/technical/products', '')).toBe('/thu-vien')
  })

  it('?cu=1 giữ trang cũ; đường khác không đụng', () => {
    expect(chuyenThuVienCu(`/products/${ID}`, '?cu=1')).toBeNull()
    expect(chuyenThuVienCu(`/technical/products/${ID}`, '?cu=1')).toBe(
      `/products/${ID}?cu=1`,
    )
    expect(chuyenThuVienCu('/thu-vien', '')).toBeNull()
    expect(chuyenThuVienCu('/productsx', '')).toBeNull()
    expect(chuyenThuVienCu('/api/dept/technical/products/1', '')).toBeNull()
  })

  it('tab hợp lệ của hồ sơ mới', () => {
    expect(isHoSoTab('dong-goi')).toBe(true)
    expect(isHoSoTab('thong-so')).toBe(false)
  })
})
