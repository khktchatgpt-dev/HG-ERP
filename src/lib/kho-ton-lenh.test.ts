import { describe, expect, it } from 'vitest'
import {
  chiaTon,
  cuaLenhTheoMa,
  giuChoLenhKhac,
  roCuaLenh,
  tomTatLenh,
  veXuatTheoLenh,
  type LenhTon,
  type MaLenh,
} from './kho-ton-lenh'

/** Lệnh thật 12/10/2026 (rút gọn). */
const L = (p: Partial<LenhTon> & Pick<LenhTon, 'id' | 'code'>): LenhTon => ({
  status: 'approved',
  ship_date: '2026-11-29',
  khach: null,
  xuat_cuoi: null,
  ...p,
})
const YOTRIO = L({ id: 'yo', code: '01/26-27 - YOTRIO', ship_date: '2026-10-10' })
const MX05 = L({ id: 'mx5', code: '05/26-27 - MX', status: 'completed', ship_date: '2026-09-13' }) // prettier-ignore
const MX06 = L({ id: 'mx6', code: '06/26-27 - MX' })
const MX09 = L({ id: 'mx9', code: '09/26-27 - MX' })
const ROSCO = L({ id: 'ro', code: '02/26-27 - ROSCO', ship_date: '2027-03-17' })
const byId = new Map([YOTRIO, MX05, MX06, MX09, ROSCO].map((l) => [l.id, l]))

const m = (lsx_id: string, material_id: string, con: number, ve = con, xuat = 0) => ({
  lsx_id,
  material_id,
  ve,
  xuat,
  con,
})

describe('chiaTon (Q2)', () => {
  it('PKN0390: kho 9.880 thuộc 02-ROSCO, lệnh 05-MX đã xong không còn gì', () => {
    const r = chiaTon(
      [m('mx5', 'pkn0390', 35264), m('ro', 'pkn0390', 9880)],
      new Map([['pkn0390', 9880]]),
      byId,
    )
    expect(r.map((x) => [x.lsx_id, x.chia])).toEqual([
      ['mx5', 0],
      ['ro', 9880],
    ])
  })

  it('NK-0044: hạn xuất sớm hơn được chia trước (YOTRIO 10/10 trước 06-MX 29/11)', () => {
    const r = chiaTon(
      [m('mx6', 'nk44', 824), m('yo', 'nk44', 840)],
      new Map([['nk44', 824]]),
      byId,
    )
    expect(Object.fromEntries(r.map((x) => [x.lsx_id, x.chia]))).toEqual({
      yo: 824,
      mx6: 0,
    })
  })

  it('cùng hạn thì mã lệnh nhỏ trước: THE0020 kho 750 → 06-MX 750, 09-MX 0', () => {
    const r = chiaTon(
      [m('mx9', 'the20', 750), m('mx6', 'the20', 880)],
      new Map([['the20', 750]]),
      byId,
    )
    expect(Object.fromEntries(r.map((x) => [x.lsx_id, x.chia]))).toEqual({
      mx6: 750,
      mx9: 0,
    })
  })

  it('tồn dư sau khi chia đủ mọi lệnh không gán cho ai; tồn âm coi như 0', () => {
    const r = chiaTon([m('mx9', 'a', 100), m('mx6', 'b', 5)], new Map([['a', 1000], ['b', -3]]), byId) // prettier-ignore
    expect(r.map((x) => x.chia)).toEqual([100, 0])
  })
})

describe('veXuatTheoLenh', () => {
  it('đã về theo dòng đơn, trừ xuất ròng; xuất nhiều hơn về thì còn 0', () => {
    const r = veXuatTheoLenh({
      dong: [
        { lsx_id: 'mx6', line_id: 'l1', material_id: 'nhan', qty_ordered: 8030, phan_lenh: 8030 }, // prettier-ignore
        { lsx_id: 'mx6', line_id: 'l2', material_id: 'bb', qty_ordered: 380, phan_lenh: 380 }, // prettier-ignore
        { lsx_id: 'mx9', line_id: 'l3', material_id: 'nhan', qty_ordered: 1020, phan_lenh: 1020 }, // prettier-ignore
      ],
      nhanTheoDong: new Map([['l1', 8030], ['l2', 380], ['l3', 1020]]), // prettier-ignore
      xuat: new Map([['mx6', new Map([['nhan', 7070], ['bb', 500]])]]), // prettier-ignore
    })
    expect(r).toEqual([
      { lsx_id: 'mx6', material_id: 'nhan', ve: 8030, xuat: 7070, con: 960 },
      { lsx_id: 'mx6', material_id: 'bb', ve: 380, xuat: 500, con: 0 },
      { lsx_id: 'mx9', material_id: 'nhan', ve: 1020, xuat: 0, con: 1020 },
    ])
  })
})

describe('tomTatLenh + roCuaLenh', () => {
  const rows: MaLenh[] = [
    { ...m('yo', 'a', 100), chia: 100 },
    { ...m('yo', 'b', 50), chia: 20 },
    { ...m('yo', 'c', 30), chia: 0 },
    { ...m('mx6', 'd', 0, 300, 300), chia: 0 },
    { ...m('mx6', 'e', 10), chia: 10 },
    { ...m('mx5', 'f', 35264), chia: 0 },
  ]
  const t = tomTatLenh(rows, [MX05, MX06, YOTRIO, MX09])

  it('đếm: còn trong kho / thiếu / kho hết / đã xuất đủ; bỏ lệnh chưa có hàng về', () => {
    expect(
      t.map((x) => [x.lenh.code, x.ma_ve, x.xuat_du, x.con_kho, x.thieu, x.het]),
    ).toEqual([
      ['01/26-27 - YOTRIO', 3, 0, 2, 1, 1],
      ['06/26-27 - MX', 2, 1, 1, 0, 0],
      ['05/26-27 - MX', 1, 0, 0, 0, 1],
    ])
  })

  it('rổ: YOTRIO quá hạn → "han"; 06-MX hạn 29/11 chưa tới 7 ngày; 05-MX đã xong còn sót → "xong"', () => {
    const ro = (code: string) =>
      roCuaLenh(
        t.find((x) => x.lenh.code === code)!,
        '2026-10-12',
      )
    expect(ro('01/26-27 - YOTRIO')).toEqual({
      con: true,
      han: true,
      xong: false,
      all: true,
    })
    expect(ro('06/26-27 - MX').han).toBe(false)
    expect(roCuaLenh(t[1], '2026-11-22').han).toBe(true)
    expect(ro('05/26-27 - MX')).toEqual({ con: false, han: false, xong: true, all: true })
  })

  it('giữ cho lệnh khác + cột "Của lệnh" theo thứ tự chia', () => {
    const chia = chiaTon(
      [m('mx9', 'nhan', 1020), m('mx6', 'nhan', 960)],
      new Map([['nhan', 1020]]),
      byId,
    )
    expect(cuaLenhTheoMa(chia, byId).get('nhan')).toEqual([
      { lsx_id: 'mx6', code: '06/26-27 - MX', qty: 960 },
      { lsx_id: 'mx9', code: '09/26-27 - MX', qty: 60 },
    ])
    expect(giuChoLenhKhac(chia, byId).get('mx9')?.get('nhan')).toEqual(['06/26-27 - MX'])
  })
})
