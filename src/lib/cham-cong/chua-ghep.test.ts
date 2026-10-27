import { describe, expect, it } from 'vitest'
import { NHOM_CHUA_GHEP, dongChuaGhep, nhanSuChuaGhep } from './chua-ghep'

const D = [
  { ngay: '2026-10-20', ma: '59', ten: 'Lê Thị Phúc', daGhep: true },
  { ngay: '2026-10-20', ma: '7007', ten: 'nguyen cong dinh', daGhep: false },
  { ngay: '2026-10-21', ma: '7007', ten: 'nguyen cong dinh', daGhep: false },
  { ngay: '2026-10-21', ma: '89', ten: '', daGhep: false },
  // 436 trùng số với nhân viên 00436 đang có → bỏ, Nhân sự xử lý ở "cần xem".
  { ngay: '2026-08-06', ma: '436', ten: 'VAN THAN', daGhep: false },
]

describe('nhanSuChuaGhep — mỗi mã chưa ghép một người tạm, tên như máy', () => {
  it('bỏ dòng đã ghép và mã trùng số nhân viên; tên trống thì "Mã máy …"', () => {
    expect(nhanSuChuaGhep(D, ['00436', '59'])).toEqual([
      { ma: '89', ten: 'Mã máy 89', boPhan: NHOM_CHUA_GHEP },
      { ma: '7007', ten: 'nguyen cong dinh', boPhan: NHOM_CHUA_GHEP },
    ])
  })
  it('không có mã nào chưa ghép → rỗng', () => {
    expect(
      nhanSuChuaGhep(
        D.filter((r) => r.daGhep),
        [],
      ),
    ).toEqual([])
  })
})

describe('dongChuaGhep — lượt của các mã đó, đánh dấu daGhep để tính được', () => {
  it('chỉ lấy đúng mã được chọn, giữ ngày + lượt', () => {
    const r = dongChuaGhep(D, ['7007'])
    expect(r.map((x) => `${x.ma} ${x.ngay} ${x.daGhep}`)).toEqual([
      '7007 2026-10-20 true',
      '7007 2026-10-21 true',
    ])
  })
})
