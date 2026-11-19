import { describe, expect, it } from 'vitest'
import {
  gopDongMau,
  khoangMacDinh,
  ngayTuDen,
  tenTo,
  type MauDongRaw,
} from './dan-so-mau'

const r = (p: Partial<MauDongRaw>): MauDongRaw => ({
  ma: 'SP1',
  ten_sp: 'Ghế',
  cum: 'Cụm chân',
  ten: 'Chân phi 40',
  ct_sp: 4,
  can: 100,
  da_lam: 10,
  o: {},
  thu_tu: 0,
  ...p,
})

describe('gopDongMau', () => {
  it('gộp các đợt của cùng (mã, cụm, tên): cộng cần, đã làm và số từng ngày', () => {
    const g = gopDongMau([
      r({ can: 100, da_lam: 10, o: { '2026-11-10': 5 } }),
      r({ can: 300, da_lam: 40, o: { '2026-11-10': 7, '2026-11-11': 3 } }),
      r({ ten: 'Giằng', can: 50, thu_tu: 1 }),
    ])
    expect(g).toHaveLength(2)
    expect(g[0]).toMatchObject({ ten: 'Chân phi 40', can: 400, da_lam: 50 })
    expect(g[0].o).toEqual({ '2026-11-10': 12, '2026-11-11': 3 })
  })
  it('không phân biệt hoa thường / dấu / khoảng trắng khi gộp', () => {
    expect(
      gopDongMau([r({ ten: 'Chân  Phi 40' }), r({ ten: 'chan phi 40' })]),
    ).toHaveLength(1)
  })
  it('mã SP khác nhau thì không gộp, xếp theo mã rồi thứ tự', () => {
    const g = gopDongMau([
      r({ ma: 'B' }),
      r({ ma: 'A', ten: 'x', thu_tu: 2 }),
      r({ ma: 'A', thu_tu: 1 }),
    ])
    expect(g.map((x) => x.ma + ':' + x.ten)).toEqual([
      'A:Chân phi 40',
      'A:x',
      'B:Chân phi 40',
    ])
  })
})

describe('khoảng ngày', () => {
  it('mặc định 7 ngày tới hôm nay', () => {
    expect(khoangMacDinh('2026-11-19')).toEqual({ tu: '2026-11-13', den: '2026-11-19' })
  })
  it('ngayTuDen gồm hai đầu, giữ phần gần cuối khi vượt trần, sai khoảng thì rỗng', () => {
    expect(ngayTuDen('2026-11-13', '2026-11-19')).toHaveLength(7)
    expect(ngayTuDen('2026-01-01', '2026-11-19', 31).at(-1)).toBe('2026-11-19')
    expect(ngayTuDen('2026-01-01', '2026-11-19', 31)).toHaveLength(31)
    expect(ngayTuDen('2026-11-19', '2026-11-13')).toEqual([])
    expect(ngayTuDen('abc', '2026-11-13')).toEqual([])
  })
})

describe('tenTo', () => {
  it('bỏ ký tự cấm, không trùng', () => {
    const d = new Set<string>()
    expect(tenTo('Phôi', d)).toBe('PHÔI')
    expect(tenTo('phôi', d)).toBe('PHÔI 2')
    expect(tenTo('a/b?c', d)).toBe('A B C')
  })
})
