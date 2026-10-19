import { describe, expect, it } from 'vitest'
import {
  chuDau,
  conThieu,
  demLocNv,
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
    nv({ code: '5', boPhan: null }),
    nv({
      code: 'KCC-007',
      khongChamCong: true,
      chucDanh: 'Tài xế',
      ngayVao: '2026-10-01',
    }),
    nv({ code: '7', active: false, ngayCuoi: '2026-10-10' }),
    nv({
      code: '8',
      ngayCuoi: '2026-10-30',
      hd: { tuNgay: '2026-01-01', denNgay: '2026-11-01', huy: false },
    }),
  ]
  it('đếm bằng đúng hàm lọc', () => {
    expect(demLocNv(ds, H)).toEqual({
      dang_lam: 4,
      thieu: 3,
      chua_to: 1,
      hd_sap_het: 1,
      hd_qua_han: 0,
      moi_vao: 1,
      co_ngay_nghi: 1,
      khong_cham: 1,
      da_nghi: 1,
    })
    expect(thuocLoc(ds[3], 'thieu', H)).toBe(false)
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
