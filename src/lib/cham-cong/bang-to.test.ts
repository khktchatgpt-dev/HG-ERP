import { describe, expect, it } from 'vitest'
import { chuO, dsTo, tinhBangTo, type BangToVao } from './bang-to'

const l = (gio: string) => ({ gio, may: '.203' })
// 03/10/2026 thứ Bảy · 04/10 chủ nhật · 05/10 thứ Hai (hôm nay)
const vao: BangToVao = {
  to: 'Tổ Phôi',
  homNay: '2026-10-05',
  theoNgay: [
    { ngay: '2026-10-02', theoMay: {} }, // chưa lấy về
    { ngay: '2026-10-03', theoMay: { '.203': 9 } },
    { ngay: '2026-10-04', theoMay: { '.203': 1 } },
    { ngay: '2026-10-05', theoMay: { '.203': 2 } },
    { ngay: '2026-10-06', theoMay: {} }, // sau hôm nay
  ],
  nhanSu: [
    { ma: '1', ten: 'B', boPhan: 'Tổ Phôi' },
    { ma: '2', ten: 'A', boPhan: 'Tổ Phôi' },
    { ma: '3', ten: 'C', boPhan: null },
  ],
  dong: [
    { ngay: '2026-10-03', ma: '1', daGhep: true, luot: [l('06:58:00'), l('21:01:00')] },
    { ngay: '2026-10-03', ma: '2', daGhep: true, luot: [l('06:50:00')] },
    { ngay: '2026-10-05', ma: '1', daGhep: true, luot: [l('06:55:00')] },
  ],
}

describe('tinhBangTo', () => {
  const b = tinhBangTo(vao)

  it('chỉ người của tổ, xếp theo tên; không bày ngày sau hôm nay', () => {
    expect(b.nguoi.map((p) => p.ten)).toEqual(['A', 'B'])
    expect(b.ngays.map((n) => n.ngay)).toEqual([
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
      '2026-10-05',
    ])
  })

  it('ô: tổng giờ, 1 lượt, vắng ngày thường đã có dữ liệu, trống ngày chưa lấy / CN / hôm nay', () => {
    const B = b.nguoi.find((p) => p.ma === '1')!
    const A = b.nguoi.find((p) => p.ma === '2')!
    expect(B.o.map(chuO)).toEqual(['', '14', '', '•'])
    expect(A.o.map(chuO)).toEqual(['', '!', '', ''])
  })

  it('đếm: hôm nay không tính đi làm / vắng; người đi làm từng ngày', () => {
    const B = b.nguoi.find((p) => p.ma === '1')!
    expect(B).toMatchObject({ diLam: 1, thieu: 0, vang: 0, phut: 843 })
    expect(b.ngays.map((n) => n.diLam)).toEqual([0, 2, 0, 1])
    expect(b.tong).toEqual({ diLam: 2, thieu: 1, vang: 0, phut: 843 })
  })

  it('người không quẹt ngày thường đã có dữ liệu thì là vắng', () => {
    const b2 = tinhBangTo({ ...vao, dong: [] })
    expect(b2.nguoi[0].o.map(chuO)).toEqual(['', 'V', '', ''])
    expect(b2.tong.vang).toBe(2)
  })
})

describe('dsTo', () => {
  it('tổ đông trước, chưa có bộ phận cuối', () => {
    expect(dsTo(vao.nhanSu)).toEqual([
      { to: 'Tổ Phôi', so: 2 },
      { to: '(chưa có bộ phận)', so: 1 },
    ])
  })
})
