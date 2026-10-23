import { describe, expect, it } from 'vitest'
import { tongTheoKhoi, type KhoiLuong, type PhieuTong } from './tong-duyet'

const khoi = new Map<string, KhoiLuong | null>([
  ['Tổ Phôi', 'ttsx'],
  ['Tổ Hoàn Thiện Xưởng 2', 'ttsx'],
  ['Kho', 'gtsx'],
  ['Khoán Bốc Xếp', null],
])
const p = (to: string | null, tong: number, thucLinh: number): PhieuTong => ({
  to,
  tong,
  thucLinh,
})

describe('tổng cho sếp duyệt — khối → tổ, không lộ từng người', () => {
  const nay = [
    p('Tổ Phôi', 10_000_000, 9_500_000),
    p('Tổ Phôi', 8_000_000, 7_600_000),
    p('Tổ Hoàn Thiện Xưởng 2', 12_000_000, 11_800_000),
    p('Kho', 9_000_000, 8_500_000),
    p('Khoán Bốc Xếp', 5_000_000, 5_000_000),
  ]

  it('gom 4 khối theo thứ tự sổ, tổ không xếp khối vào "Chưa xếp khối"', () => {
    const r = tongTheoKhoi(nay, khoi, null)
    expect(r.khoi.map((k) => [k.ten, k.nguoi])).toEqual([
      ['Trực tiếp sản xuất', 3],
      ['Gián tiếp sản xuất', 1],
      ['Chưa xếp khối', 1],
    ])
    expect(r.khoi[0].to.map((t) => [t.ten, t.nguoi, t.thucLinh, t.tru])).toEqual([
      ['Tổ Hoàn Thiện Xưởng 2', 1, 11_800_000, 200_000],
      ['Tổ Phôi', 2, 17_100_000, 900_000],
    ])
    expect(r.cong).toMatchObject({ nguoi: 5, tong: 44_000_000, thucLinh: 42_400_000 })
    // không có kỳ trước → không so, không tô
    expect(r.khoi[0].to[0]).toMatchObject({ truoc: null, chenh: null, canhBao: false })
  })

  it('so kỳ trước theo tổ; chênh quá 15 % thì cảnh báo', () => {
    const truoc = [p('Tổ Phôi', 0, 17_000_000), p('Tổ Hoàn Thiện Xưởng 2', 0, 10_000_000)]
    const r = tongTheoKhoi(nay, khoi, truoc)
    const [ht, phoi] = r.khoi[0].to
    expect(ht).toMatchObject({ truoc: 10_000_000, canhBao: true })
    expect(ht.chenh).toBeCloseTo(0.18)
    expect(phoi).toMatchObject({ truoc: 17_000_000, canhBao: false })
    // tổ mới (Kho) không có ở kỳ trước → không so
    expect(r.khoi[1].to[0]).toMatchObject({ truoc: null, canhBao: false })
    expect(r.cong.truoc).toBe(27_000_000)
  })
})
