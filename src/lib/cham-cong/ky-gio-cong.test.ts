import { describe, expect, it } from 'vitest'
import type { DieuChinh } from './dieu-chinh'
import { kyCuaThang, thangCuaNgay, tinhKyGioCong, type KyGioVao } from './ky-gio-cong'

describe('kỳ công 26 → 25', () => {
  it('kỳ tháng 10/2026 = 26/09 → 25/10; tháng 1 lùi sang năm trước', () => {
    expect(kyCuaThang('2026-10')).toEqual({ tu: '2026-09-26', den: '2026-10-25' })
    expect(kyCuaThang('2027-01')).toEqual({ tu: '2026-12-26', den: '2027-01-25' })
  })
  it('ngày 25 thuộc kỳ tháng đó, ngày 26 sang kỳ tháng sau', () => {
    expect(thangCuaNgay('2026-10-25')).toBe('2026-10')
    expect(thangCuaNgay('2026-10-26')).toBe('2026-11')
    expect(thangCuaNgay('2026-12-31')).toBe('2027-01')
  })
})

const l = (...g: string[]) => g.map((gio) => ({ gio: `${gio}:00`, may: 'Máy 203' }))
const dc = (p: Partial<DieuChinh>): DieuChinh => ({
  id: 'x',
  ma: 'A',
  ngay: '2026-10-05',
  loai: 'add_punch',
  gio: null,
  chieu: null,
  nghi: null,
  lyDo: 'Quên quẹt',
  canCu: null,
  tinhTrang: 'approved',
  nguoiGui: null,
  luc: '',
  nguoiDuyet: null,
  lucDuyet: null,
  ghiChuDuyet: null,
  ...p,
})
const vao = (p: Partial<KyGioVao>): KyGioVao => ({
  tu: '2026-09-26',
  den: '2026-10-25',
  nhanSu: [{ ma: 'A', ten: 'Người A', boPhan: 'Tổ Phôi' }],
  dong: [],
  dieuChinh: [],
  trua: {},
  cachTinh: {},
  ...p,
})

describe('tinhKyGioCong', () => {
  it('sản xuất: 06:41 → 19:00 = 8 + 3 giờ; xuyên trưa chưa tick', () => {
    const [a] = tinhKyGioCong(
      vao({
        dong: [{ ngay: '2026-10-05', ma: 'A', daGhep: true, luot: l('06:41', '19:00') }],
      }),
    )
    expect(a.ngay[0]).toMatchObject({ tong: 660, xuyenTrua: true, trua: 0, thieu: false })
    expect(a.tong).toMatchObject({ tong: 660, cong: 1.38, truaCho: 1 })
  })
  it('tick làm trưa 60 phút → +2 giờ hành chính', () => {
    const [a] = tinhKyGioCong(
      vao({
        dong: [{ ngay: '2026-10-05', ma: 'A', daGhep: true, luot: l('06:41', '19:00') }],
        trua: { 'A|2026-10-05': 60 },
      }),
    )
    expect(a.ngay[0]).toMatchObject({ trua: 60, truaCong: 120, tong: 780 })
    expect(a.tong.truaCho).toBe(0)
  })
  it('1 lượt = cần bổ sung; bổ sung giờ ra đã duyệt thì tính được', () => {
    const dong = [{ ngay: '2026-10-05', ma: 'A', daGhep: true, luot: l('06:55') }]
    expect(tinhKyGioCong(vao({ dong }))[0].tong.thieu).toBe(1)
    const [a] = tinhKyGioCong(
      vao({ dong, dieuChinh: [dc({ gio: '16:00:00', chieu: 'out' })] }),
    )
    expect(a.ngay[0]).toMatchObject({ thieu: false, tong: 480, daSua: true })
  })
  it('bổ sung đang chờ duyệt chưa đổi kết quả, chỉ đếm', () => {
    const dong = [{ ngay: '2026-10-05', ma: 'A', daGhep: true, luot: l('06:55') }]
    const [a] = tinhKyGioCong(
      vao({ dong, dieuChinh: [dc({ gio: '16:00:00', tinhTrang: 'pending' })] }),
    )
    expect(a.ngay[0]).toMatchObject({ thieu: true, choDuyet: 1 })
  })
  it('nghỉ có lý do không phải "thiếu"', () => {
    const [a] = tinhKyGioCong(vao({ dieuChinh: [dc({ loai: 'leave', nghi: 'annual' })] }))
    expect(a.ngay[0]).toMatchObject({ nghi: 'annual', thieu: false, tong: 0 })
  })
  it('không tính khung (văn phòng): có quẹt = đúng 1 công, ra 19:00 cũng không cộng giờ', () => {
    const nhanSu = [{ ma: 'A', ten: 'A', boPhan: 'Phòng Kế Toán' }]
    const cachTinh = { 'Phòng Kế Toán': 'ngay' as const }
    const [a] = tinhKyGioCong(
      vao({
        nhanSu,
        cachTinh,
        dong: [
          { ngay: '2026-10-05', ma: 'A', daGhep: true, luot: l('07:58') },
          { ngay: '2026-10-06', ma: 'A', daGhep: true, luot: l('07:55', '19:02') },
        ],
      }),
    )
    expect(a.cachTinh).toBe('ngay')
    expect(a.ngay.map((x) => x.tong)).toEqual([480, 480])
    expect(a.tong).toMatchObject({ thieu: 0, truaCho: 0, cong: 2 })
  })
  it('chỉ lấy ngày trong kỳ; ca đêm ngày cuối kỳ dùng lượt hôm sau', () => {
    const [a] = tinhKyGioCong(
      vao({
        dong: [
          { ngay: '2026-09-25', ma: 'A', daGhep: true, luot: l('07:00', '16:00') },
          { ngay: '2026-10-25', ma: 'A', daGhep: true, luot: l('06:59') },
          { ngay: '2026-10-26', ma: 'A', daGhep: true, luot: l('00:01', '07:00') },
        ],
      }),
    )
    expect(a.ngay.map((x) => x.ngay)).toEqual(['2026-10-25'])
    expect(a.ngay[0]).toMatchObject({ quaDem: true, tong: 480 + 180 + 180 + 120 })
  })
})

describe('ngày đang dở', () => {
  it('1 lượt từ ngày lấy dữ liệu lần cuối không tính là thiếu lượt', () => {
    const dong = [
      { ngay: '2026-10-15', ma: 'A', daGhep: true, luot: l('06:55') },
      { ngay: '2026-10-16', ma: 'A', daGhep: true, luot: l('06:55') },
    ]
    const [a] = tinhKyGioCong(vao({ dong, ngayDoDang: '2026-10-16' }))
    expect(a.ngay.map((x) => [x.ngay, x.thieu, x.doDang])).toEqual([
      ['2026-10-15', true, false],
      ['2026-10-16', false, true],
    ])
    expect(a.tong.thieu).toBe(1)
  })
})
