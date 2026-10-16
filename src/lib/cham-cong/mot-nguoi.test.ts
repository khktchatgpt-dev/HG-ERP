import { describe, expect, it } from 'vitest'
import { deYNgay, gioPhut, tachLuot, tomTatMotNguoi, type NgayLuot } from './mot-nguoi'

const l = (gio: string, may = '.203') => ({ gio, may, lap: 0 })
// 01/10/2026 thứ Năm · 04/10 chủ nhật
const ds: NgayLuot[] = [
  { ngay: '2026-10-01', luot: [l('06:50:00'), l('19:01:00')], soLuotTho: 3, daLay: true },
  { ngay: '2026-10-02', luot: [], soLuotTho: 0, daLay: true },
  { ngay: '2026-10-03', luot: [l('06:47:00')], soLuotTho: 1, daLay: true },
  { ngay: '2026-10-04', luot: [l('06:55:00'), l('11:02:00')], soLuotTho: 2, daLay: true },
  {
    ngay: '2026-10-05',
    luot: [l('06:50:00'), l('10:50:00'), l('13:30:00')],
    soLuotTho: 3,
    daLay: true,
  },
  { ngay: '2026-10-06', luot: [], soLuotTho: 0, daLay: false },
]

describe('tomTatMotNguoi', () => {
  it('đếm ngày thường có/không quẹt, bỏ CN và ngày chưa lấy khỏi mẫu số', () => {
    expect(tomTatMotNguoi(ds)).toEqual({
      ngayThuong: 4,
      coQuet: 3,
      khongQuet: 1,
      motLuot: 1,
      tuBaLuot: 1,
      quetChuNhat: 1,
      chuaLay: 1,
      tongLuot: 8,
    })
  })
})

describe('deYNgay', () => {
  it('ngày chưa lấy không bị coi là vắng', () => {
    expect(deYNgay(ds[5])).toEqual([{ text: 'chưa lấy dữ liệu' }])
  })
  it('ngày thường không quẹt tô đỏ, chủ nhật nghỉ thì không', () => {
    expect(deYNgay(ds[1])[0].tone).toBe('stop')
    expect(deYNgay({ ...ds[3], luot: [], soLuotTho: 0 })).toEqual([
      { text: 'nghỉ chủ nhật' },
    ])
  })
  it('bấm lặp, 1 lượt, làm CN', () => {
    expect(deYNgay(ds[0]).map((x) => x.text)).toEqual(['bấm lặp 1'])
    expect(deYNgay(ds[2]).map((x) => x.text)).toEqual(['chỉ 1 lượt'])
    expect(deYNgay(ds[3]).map((x) => x.text)).toEqual(['làm chủ nhật'])
  })
})

describe('tachLuot', () => {
  it('lượt đầu là vào, cuối là ra, còn lại là giữa; có mặt tính từ đầu tới cuối', () => {
    expect(
      tachLuot([l('06:52:10'), l('10:53:00', '.201'), l('13:36:00'), l('19:12:59')]),
    ).toEqual({
      vao: '06:52',
      ra: '19:12',
      giua: ['10:53', '13:36'],
      coMatPhut: 740,
      may: ['Máy 203', 'Máy 201'],
    })
  })
  it('một lượt: chỉ có vào, chưa có ra', () => {
    expect(tachLuot([l('03:54:00')])).toMatchObject({ vao: '03:54', ra: null, coMatPhut: null })
  })
  it('gioPhut', () => {
    expect(gioPhut(684)).toBe('11:24')
    expect(gioPhut(65)).toBe('1:05')
  })
})
