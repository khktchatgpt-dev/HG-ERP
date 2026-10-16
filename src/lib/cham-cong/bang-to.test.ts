import { describe, expect, it } from 'vitest'
import { dsTo, soCong, tcGon, tinhBangTo, tinhO, type BangToVao } from './bang-to'
import type { Ca } from './tinh-cong'

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
const l = (gio: string) => ({ gio, may: '.203' })
const thuong = { homNay: false, daLay: true }

describe('tinhO — ký hiệu công (câu 26) + tăng ca', () => {
  it('đủ ca + ra 21:00 → X, tăng ca 5 giờ', () => {
    const o = tinhO('2026-10-01', [l('06:58:00'), l('21:01:00')], XUONG, thuong)
    expect(o).toMatchObject({ ky: 'X', cong: 1, tc: 300 })
  })
  it('vào 11:36 → nửa công', () => {
    expect(
      tinhO('2026-10-03', [l('11:36:00'), l('19:00:00')], XUONG, thuong),
    ).toMatchObject({
      ky: '½',
      cong: 0.5,
      tc: 180,
    })
  })
  it('ra 16:38 (đủ ca) → X, tăng ca làm tròn xuống ½ giờ', () => {
    expect(
      tinhO('2026-10-02', [l('06:49:00'), l('16:38:00')], XUONG, thuong),
    ).toMatchObject({
      ky: 'X',
      tc: 30,
    })
  })
  it('1 lượt → ? cần xử lý, có lý do', () => {
    const o = tinhO('2026-10-08', [l('05:54:00')], XUONG, thuong)
    expect(o.ky).toBe('?')
    expect(o.lyDo).toMatch(/1 lượt/)
  })
  it('chủ nhật đủ ca → CN (công CN), tăng ca vẫn tính (câu 28)', () => {
    expect(
      tinhO('2026-10-11', [l('06:58:00'), l('17:04:00')], XUONG, thuong),
    ).toMatchObject({
      ky: 'CN',
      cong: 0,
      congCN: 1,
      tc: 60,
    })
  })
  it('không quẹt: ngày thường = V, chủ nhật / chưa lấy / hôm nay = trống', () => {
    expect(tinhO('2026-10-01', [], XUONG, thuong).ky).toBe('V')
    expect(tinhO('2026-10-04', [], XUONG, thuong).ky).toBe('')
    expect(tinhO('2026-10-01', [], XUONG, { homNay: false, daLay: false }).ky).toBe('')
    expect(tinhO('2026-10-16', [], XUONG, { homNay: true, daLay: true }).ky).toBe('')
  })
  it('hôm nay đã vào → • (chưa tính)', () => {
    expect(
      tinhO('2026-10-16', [l('06:55:00')], XUONG, { homNay: true, daLay: true }).ky,
    ).toBe('•')
  })
})

describe('tinhBangTo', () => {
  // 01/10 T5 · 02/10 T6 · 03/10 T7 · 04/10 CN · 05/10 T2 (hôm nay)
  const vao: BangToVao = {
    to: 'Tổ Phôi',
    homNay: '2026-10-05',
    theoNgay: ['01', '02', '03', '04', '05'].map((d) => ({
      ngay: `2026-10-${d}`,
      theoMay: (d === '02' ? {} : { '.203': 5 }) as Record<string, number>,
    })),
    nhanSu: [
      { ma: '1', ten: 'B', boPhan: 'Tổ Phôi', ca: XUONG },
      { ma: '2', ten: 'A', boPhan: 'Tổ Phôi', ca: XUONG },
      { ma: '3', ten: 'C', boPhan: 'Tổ Phôi', ca: XUONG },
      { ma: '9', ten: 'Z', boPhan: null, ca: XUONG },
    ],
    dong: [
      { ngay: '2026-10-01', ma: '1', daGhep: true, luot: [l('06:58:00'), l('21:01:00')] },
      { ngay: '2026-10-01', ma: '2', daGhep: true, luot: [l('06:50:00'), l('16:01:00')] },
      { ngay: '2026-10-03', ma: '1', daGhep: true, luot: [l('06:50:00')] },
      { ngay: '2026-10-03', ma: '2', daGhep: true, luot: [l('06:51:00')] },
      { ngay: '2026-10-04', ma: '1', daGhep: true, luot: [l('06:58:00'), l('16:04:00')] },
    ],
  }
  const b = tinhBangTo(vao)

  it('chỉ người của tổ, theo tên', () => {
    expect(b.nguoi.map((p) => p.ten)).toEqual(['A', 'B', 'C'])
  })
  it('tổng mỗi người: công, công CN, tăng ca, vắng, cần xử lý', () => {
    const B = b.nguoi.find((p) => p.ma === '1')!
    expect(B).toMatchObject({ cong: 1, congCN: 1, tc: 300, vang: 0, canXuLy: 1 })
    const C = b.nguoi.find((p) => p.ma === '3')!
    expect(C).toMatchObject({ vang: 2, khongQuet: true })
  })
  it('đầu cột: người đi làm + tổng công của tổ', () => {
    expect(b.ngays.map((n) => n.diLam)).toEqual([2, 0, 2, 1, 0])
    expect(b.ngays.map((n) => n.cong)).toEqual([2, 0, 0, 1, 0])
  })
  it('lỗi chung cả ngày khi hơn nửa người đi làm cùng thiếu lượt (cần ≥ 3 người)', () => {
    expect(b.loiNgay).toEqual([])
    const b2 = tinhBangTo({
      ...vao,
      dong: [
        ...vao.dong,
        { ngay: '2026-10-03', ma: '3', daGhep: true, luot: [l('06:52:00')] },
      ],
    })
    expect(b2.loiNgay).toEqual([{ ngay: '2026-10-03', so: 3, diLam: 3 }])
  })
  it('tổng cả tổ', () => {
    expect(b.tong).toEqual({ cong: 2, congCN: 1, tc: 300, nghi: 0, vang: 2, canXuLy: 2 })
  })
})

describe('định dạng', () => {
  it('tcGon + soCong', () => {
    expect([tcGon(330), tcGon(300), tcGon(30), tcGon(0)]).toEqual(['5½', '5', '½', ''])
    expect(soCong(12.5)).toBe('12,5')
  })
  it('dsTo', () => {
    expect(dsTo([{ boPhan: 'A' }, { boPhan: null }, { boPhan: 'A' }])).toEqual([
      { to: 'A', so: 2 },
      { to: '(chưa có bộ phận)', so: 1 },
    ])
  })
})
