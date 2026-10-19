import { describe, expect, it } from 'vitest'
import {
  doanCa,
  gioChuan,
  gopLap,
  tinhNgay,
  tongThang,
  type Ca,
  type LuotQuet,
} from './tinh-cong'

const XUONG: Ca = {
  code: 'XUONG',
  name: 'Xưởng',
  start: '07:00',
  end: '16:00',
  breakMin: 60,
  requiredPunches: 2,
  otFrom: '16:00',
  otRound: 30,
  graceMin: 5,
}
const VP: Ca = {
  ...XUONG,
  code: 'VP',
  name: 'Văn phòng',
  start: '08:00',
  end: '17:00',
  requiredPunches: 1,
  otFrom: '17:00',
}
const BEP: Ca = {
  ...XUONG,
  code: 'BEP',
  name: 'Bếp',
  start: '03:30',
  end: '15:30',
  breakMin: 240,
  otFrom: '15:30',
}

const l = (...gio: string[]): LuotQuet[] =>
  gio.map((g) => ({ may: '.203', gio: g.length === 5 ? g + ':00' : g }))

describe('gopLap', () => {
  it('gộp lượt cách nhau dưới 2 phút, đếm số lượt lặp', () => {
    const r = gopLap(l('11:45:23', '11:45:29', '11:45:31', '06:59:38'))
    expect(r.map((x) => x.gio)).toEqual(['06:59:38', '11:45:23'])
    expect(r[1].lap).toBe(2)
  })
})

describe('tinhNgay — ca Xưởng', () => {
  it('06:53 → 16:00 = 8 giờ, không tăng ca, không trễ', () => {
    const r = tinhNgay(l('06:53', '16:01'), XUONG, 'thuong')!
    expect(r).toMatchObject({ kieu: 'ok', gioCong: 480, tangCa: 0, tre: 0 })
  })
  it('ra 19:01 = +3 giờ tăng ca (làm tròn xuống 30 phút)', () => {
    expect(tinhNgay(l('06:51', '19:01'), XUONG, 'thuong')!.tangCa).toBe(180)
  })
  it('ra 21:20 = +5 giờ (5h20 làm tròn xuống)', () => {
    expect(tinhNgay(l('06:51', '21:20'), XUONG, 'thuong')!.tangCa).toBe(300)
  })
  it('vào 07:05 chưa trễ (ân hạn 5 phút), 07:06 trễ 6 phút, giờ công vẫn tính từ giờ vào thật', () => {
    expect(tinhNgay(l('07:05', '16:00'), XUONG, 'thuong')!.tre).toBe(0)
    const r = tinhNgay(l('07:06', '16:00'), XUONG, 'thuong')!
    expect(r.tre).toBe(6)
    expect(r.gioCong).toBe(474)
  })
  it('làm buổi sáng 07:00–11:00 không bị trừ giờ nghỉ', () => {
    expect(tinhNgay(l('06:55', '11:00'), XUONG, 'thuong')!.gioCong).toBe(240)
  })
  it('một lượt / vào-ra cách nhau dưới 1 giờ = thiếu lượt, chưa tính công', () => {
    expect(tinhNgay(l('06:52'), XUONG, 'thuong')!.kieu).toBe('thieu')
    expect(tinhNgay(l('06:13', '06:13:40', '06:14:50'), XUONG, 'thuong')!.kieu).toBe(
      'thieu',
    )
  })
  it('vào trước 05:00 = ngoài ca', () => {
    expect(tinhNgay(l('04:58', '20:57'), XUONG, 'thuong')!.kieu).toBe('ngoai')
  })
  it('chủ nhật / lễ: giữ giờ công + tăng ca, kiểu riêng', () => {
    expect(tinhNgay(l('06:50', '19:00'), XUONG, 'cn')).toMatchObject({
      kieu: 'cn',
      gioCong: 480,
      tangCa: 180,
    })
    expect(tinhNgay(l('06:50', '16:00'), XUONG, 'le')!.kieu).toBe('le')
  })
  it('không có lượt → null (vắng)', () => {
    expect(tinhNgay([], XUONG, 'thuong')).toBeNull()
  })
})

describe('tinhNgay — ca Văn phòng (1 lượt)', () => {
  it('chỉ lượt vào 07:57 = đủ 1 công', () => {
    expect(tinhNgay(l('07:57'), VP, 'thuong')).toMatchObject({
      kieu: 'ok',
      gioCong: gioChuan(VP),
      tre: 0,
    })
  })
  it('vào 08:09 trễ 9 phút, vẫn đủ công', () => {
    expect(tinhNgay(l('08:09'), VP, 'thuong')).toMatchObject({ gioCong: 480, tre: 9 })
  })
})

describe('tinhNgay — ca Bếp', () => {
  it('03:47 → 15:23 = 8 giờ (12 giờ ca trừ 4 giờ nghỉ, ra sớm 7 phút)', () => {
    const r = tinhNgay(l('03:47', '15:23'), BEP, 'thuong')!
    expect(r.kieu).toBe('ok')
    expect(r.gioCong).toBe(15 * 60 + 23 - (3 * 60 + 47) - 240)
  })
})

describe('tongThang', () => {
  it('cộng công ngày thường, tách chủ nhật/lễ, đếm thiếu/trễ', () => {
    const days = [
      tinhNgay(l('06:50', '19:00'), XUONG, 'thuong')!,
      tinhNgay(l('07:20', '16:00'), XUONG, 'thuong')!,
      tinhNgay(l('06:50', '21:00'), XUONG, 'cn')!,
      tinhNgay(l('06:50'), XUONG, 'thuong')!,
    ]
    expect(tongThang(days, XUONG)).toEqual({
      cong: Math.round(((480 + 460) / 480) * 100) / 100,
      tangCa: 180,
      chuNhat: 480 + 300,
      le: 0,
      thieu: 1,
      ngoai: 0,
      tre: 1,
    })
  })
})

describe('doanCa', () => {
  it('vào trước 05:00 → Bếp', () => {
    expect(
      doanCa([
        { dau: '03:47', soLuot: 2 },
        { dau: '03:40', soLuot: 2 },
      ]),
    ).toBe('BEP')
  })
  it('gần như chỉ 1 lượt, vào ~08:00 → Văn phòng', () => {
    expect(doanCa(Array.from({ length: 10 }, () => ({ dau: '07:57', soLuot: 1 })))).toBe(
      'VP',
    )
  })
  it('vào 06:50 hai lượt → Xưởng; công nhân hay quên quẹt ra vẫn là Xưởng', () => {
    expect(doanCa([{ dau: '06:50', soLuot: 2 }])).toBe('XUONG')
    expect(doanCa(Array.from({ length: 10 }, () => ({ dau: '06:50', soLuot: 1 })))).toBe(
      'XUONG',
    )
  })
})
