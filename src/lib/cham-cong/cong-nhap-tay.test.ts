import { describe, expect, it } from 'vitest'
import { docSo, kiemNhap, ngayLamViec, soNgayKy } from './cong-nhap-tay'

describe('docSo — số kiểu Việt Nam', () => {
  it('dấu phẩy là thập phân; trống = null; chữ = NaN', () => {
    expect(docSo('27,5')).toBe(27.5)
    expect(docSo(' 28 ')).toBe(28)
    expect(docSo('80.5')).toBe(80.5)
    expect(docSo('')).toBeNull()
    expect(docSo('abc')).toBeNaN()
    expect(docSo('1.2.3')).toBeNaN()
  })
})

describe('ngày làm việc gợi ý — kỳ 09/2026 thật (25/08 → 25/09, lễ 02/09)', () => {
  it('trọn kỳ = 32 ngày − 4 Chủ nhật = 28 (lễ vẫn tính, như sổ T9)', () => {
    expect(soNgayKy('2026-08-25', '2026-09-25')).toBe(32)
    expect(ngayLamViec('2026-08-25', '2026-09-25')).toBe(28)
  })
  it('vào / nghỉ giữa kỳ thì cắt theo mốc', () => {
    expect(ngayLamViec('2026-08-25', '2026-09-25', { ngayVao: '2026-09-07' })).toBe(17)
    expect(ngayLamViec('2026-08-25', '2026-09-25', { ngayNghi: '2026-09-18' })).toBe(22)
  })
})

describe('kiemNhap', () => {
  const k = { soNgayKy: 32, ngayLamViec: 28 }
  it('sổ T9: 6021 28 công + 80 giờ hợp lệ; KCC-002 32 công là cảnh báo, không chặn', () => {
    expect(kiemNhap({ cong: 28, tcGio: 80 }, k)).toEqual({ loi: null, canhBao: null })
    // 27,1 × 100 = 2710,0000000000005 trong số thực máy — vẫn là 1 số lẻ.
    expect(kiemNhap({ cong: 27.1, tcGio: null }, k).loi).toBeNull()
    expect(kiemNhap({ cong: 32, tcGio: null }, k).canhBao).toMatch(/Chủ nhật/)
    expect(kiemNhap({ cong: 32, tcGio: null }, k).loi).toBeNull()
  })
  it('lỗi: quá số ngày kỳ, âm, chữ, 3 số lẻ, có tăng ca mà trống công', () => {
    expect(kiemNhap({ cong: 33, tcGio: null }, k).loi).toMatch(/lớn hơn số ngày của kỳ/)
    expect(kiemNhap({ cong: -1, tcGio: null }, k).loi).toMatch(/không âm/)
    expect(kiemNhap({ cong: Number.NaN, tcGio: null }, k).loi).toMatch(/phải là số/)
    expect(kiemNhap({ cong: 27.125, tcGio: null }, k).loi).toMatch(/2 số lẻ/)
    expect(kiemNhap({ cong: null, tcGio: 8 }, k).loi).toMatch(/cả số công/)
    expect(kiemNhap({ cong: 20, tcGio: 600 }, k).loi).toMatch(/quá 512 giờ/)
  })
  it('ô trống chưa nhập không phải lỗi dòng (chặn ở điều kiện chốt)', () => {
    expect(kiemNhap({ cong: null, tcGio: null }, k)).toEqual({ loi: null, canhBao: null })
  })
})

describe('khối B — công cộng thêm', () => {
  it('kiemThem: > 0, tối đa số ngày kỳ, 2 số lẻ', async () => {
    const { kiemThem } = await import('./cong-nhap-tay')
    expect(kiemThem(5.1, 32)).toBeNull()
    expect(kiemThem(0, 32)).toMatch(/lớn hơn 0/)
    expect(kiemThem(null, 32)).toMatch(/Nhập số công/)
    expect(kiemThem(33, 32)).toMatch(/số ngày của kỳ/)
    expect(kiemThem(3.375, 32)).toMatch(/2 số lẻ/)
  })
  it('docDan: dán cột mã + công từ sổ TH Sơn Sắt (mã có số 0 đầu, dấu phẩy)', async () => {
    const { docDan } = await import('./cong-nhap-tay')
    const r = docDan(
      'Mã nhân viên\tCÔNG NGOÀI GIỜ\n01043\t5,1\n05014\t4,58\tghi chú\n\n00247\tabc\n',
    )
    expect(r.dong).toEqual([
      { ma: '1043', cong: 5.1, ghiChu: null },
      { ma: '5014', cong: 4.58, ghiChu: 'ghi chú' },
    ])
    expect(r.hong).toHaveLength(1)
  })
})
