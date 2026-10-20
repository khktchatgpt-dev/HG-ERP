import { describe, expect, it } from 'vitest'
import {
  chuDau,
  conThieu,
  demLocNv,
  khoiCua,
  nhanTinhTrang,
  tinhVang,
  khopTimNv,
  soSanhMa,
  SO_MUC_HO_SO,
  thamNien,
  thuocLoc,
  type NvTom,
} from './ho-so'

const nv = (p: Partial<NvTom> = {}): NvTom => ({
  code: '105',
  hoTen: 'Phan Đình Hậu',
  boPhan: 'Tổ Phôi',
  chucDanh: null,
  ngayVao: null,
  ngayCuoi: null,
  active: true,
  khongChamCong: false,
  tenTuMay: false,
  ma: [{}],
  coRieng: DU,
  hd: { tuNgay: '2021-03-02', denNgay: null, huy: false },
  vang: null,
  ...p,
})
const H = '2026-10-19'
const DU = {
  ngaySinh: true,
  cccd: true,
  diaChi: true,
  dienThoai: true,
  trinhDo: true,
  khanCap: true,
}

describe('thâm niên', () => {
  it('năm + tháng, tháng, ngày; chưa có ngày vào → null', () => {
    expect(thamNien('2021-03-02', H)).toBe('5 năm 7 th')
    expect(thamNien('2025-10-19', H)).toBe('1 năm')
    expect(thamNien('2026-07-20', H)).toBe('2 th')
    expect(thamNien('2026-10-07', H)).toBe('12 ngày')
    expect(thamNien(null, H)).toBeNull()
    expect(thamNien('2026-11-01', H)).toBeNull()
  })
})

describe('còn thiếu', () => {
  it('đếm trên các trường đang có', () => {
    expect(conThieu(nv())).toEqual(['chuc_danh', 'ngay_vao'])
    expect(conThieu(nv({ tenTuMay: true, boPhan: null, ma: [] }))).toEqual([
      'ho_ten',
      'to',
      'chuc_danh',
      'ngay_vao',
      'ma_may',
    ])
    expect(conThieu(nv({ coRieng: { ...DU, cccd: false, khanCap: false } }))).toEqual([
      'chuc_danh',
      'ngay_vao',
      'cccd',
      'khan_cap',
    ])
    expect(SO_MUC_HO_SO).toBe(12)
    expect(conThieu(nv({ hd: null }))).toContain('hop_dong')
    // Không chấm công thì không đòi mã máy.
    expect(conThieu(nv({ khongChamCong: true, ma: [] }))).not.toContain('ma_may')
  })
})

describe('chip danh sách', () => {
  const ds = [
    nv(),
    nv({ code: '5', boPhan: null, tenTuMay: true }),
    nv({
      code: 'KCC-007',
      khongChamCong: true,
      chucDanh: 'Tài xế',
      ngayVao: '2026-10-01',
    }),
    nv({ code: '7', active: false, ngayCuoi: '2026-10-10', boPhan: null }),
    nv({
      code: '8',
      ngayCuoi: '2026-10-30',
      hd: { tuNgay: '2026-01-01', denNgay: '2026-11-01', huy: false },
      vang: { ngay: 9, quetCuoi: '2026-10-08' },
    }),
    nv({ code: '9', hd: { tuNgay: '2025-01-01', denNgay: '2026-09-30', huy: false } }),
  ]
  it('đếm bằng đúng hàm lọc; người đã nghỉ không lọt vào chip việc', () => {
    expect(demLocNv(ds, H)).toEqual({
      dang_lam: 5,
      moi_vao: 1,
      khong_cham: 1,
      da_nghi: 1,
      ten_may: 1,
      chua_to: 1,
      vang: 1,
      hd: 2,
      sap_nghi: 1,
    })
  })
})

describe('vắng', () => {
  const ngay = ['2026-10-08', '2026-10-09', '2026-10-10', '2026-10-12', '2026-10-13']
  const du = [...ngay, '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17']
  it('đếm ngày CÓ DỮ LIỆU sau lần quẹt cuối, từ ngày vào', () => {
    expect(tinhVang(du, '2026-10-09', null)).toEqual({ ngay: 7, quetCuoi: '2026-10-09' })
    expect(tinhVang(du, '2026-10-10', null)).toBeNull()
    expect(tinhVang(ngay, null, null)).toBeNull()
    expect(tinhVang(du, null, null)).toEqual({ ngay: 9, quetCuoi: null })
    // Mới vào 13/10 — chỉ đếm từ ngày vào: 5 ngày, chưa đủ.
    expect(tinhVang(du, null, '2026-10-13')).toBeNull()
  })
})

describe('nhãn tình trạng + khối', () => {
  it('ưu tiên nghỉ › sắp nghỉ › chưa vào › vắng › mới', () => {
    expect(nhanTinhTrang(nv({ active: false, ngayCuoi: '2026-09-25' }), H)).toEqual({
      kieu: 'da_nghi',
      ngay: '2026-09-25',
    })
    expect(
      nhanTinhTrang(nv({ ngayCuoi: '2026-10-31', vang: { ngay: 8, quetCuoi: null } }), H)
        .kieu,
    ).toBe('sap_nghi')
    expect(nhanTinhTrang(nv({ ngayVao: '2026-11-02' }), H).kieu).toBe('chua_vao')
    expect(
      nhanTinhTrang(nv({ ngayVao: '2026-10-07', vang: { ngay: 7, quetCuoi: null } }), H)
        .kieu,
    ).toBe('vang')
    expect(nhanTinhTrang(nv({ ngayVao: '2026-10-07' }), H)).toEqual({
      kieu: 'moi',
      ngay: 12,
    })
    expect(nhanTinhTrang(nv({ ngayVao: '2017-09-07' }), H).kieu).toBe('dang_lam')
  })
  it('chia khối theo tên tổ', () => {
    expect(khoiCua('Phòng Kế Hoạch')).toBe('van_phong')
    expect(khoiCua('Thống Kê')).toBe('van_phong')
    expect(khoiCua('Khoán Bốc Xếp')).toBe('phuc_vu')
    expect(khoiCua('Bảo Vệ')).toBe('phuc_vu')
    expect(khoiCua('Tài Xế')).toBe('phuc_vu')
    expect(khoiCua('Tạp Vụ')).toBe('phuc_vu')
    expect(khoiCua('Tổ Hàn Nhôm')).toBe('xuong')
    expect(khoiCua('Kiểm Hàng')).toBe('xuong')
    expect(khoiCua(null)).toBeNull()
  })
})

describe('linh tinh', () => {
  it('xếp mã theo số, KCC sau', () => {
    expect(['105', 'KCC-007', '31', '5'].sort(soSanhMa)).toEqual([
      '5',
      '31',
      '105',
      'KCC-007',
    ])
  })
  it('tìm không dấu; chữ cái đầu', () => {
    expect(khopTimNv(nv(), 'dinh hau')).toBe(true)
    expect(khopTimNv(nv(), 'tổ phôi')).toBe(true)
    expect(khopTimNv(nv(), 'ninh')).toBe(false)
    expect(chuDau('Phan Đình Hậu')).toBe('PH')
    expect(chuDau('BA THONG')).toBe('BT')
  })
})
