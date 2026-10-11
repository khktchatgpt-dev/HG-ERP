import { describe, expect, it } from 'vitest'
import {
  chuanThue,
  goiYThue,
  goiYThueNgan,
  khoaThue,
  nhanThue,
  thueMacDinh,
  tuKhoaThue,
  viDuThue,
} from './po-thue'

describe('kiểu thuế đơn mua', () => {
  it('0% luôn là chưa gồm; null → 0', () => {
    expect(chuanThue(0, true)).toEqual({ rate: 0, incl: false })
    expect(chuanThue(null, true)).toEqual({ rate: 0, incl: false })
    expect(chuanThue(10, true)).toEqual({ rate: 10, incl: true })
  })

  it('khoá đi về được', () => {
    for (const k of [
      { rate: 8, incl: false },
      { rate: 10, incl: true },
      { rate: 5.5, incl: false },
    ])
      // prettier-ignore
      expect(tuKhoaThue(khoaThue(k))).toEqual(k)
    expect(tuKhoaThue('khac')).toBeNull()
  })

  it('nhãn + ví dụ tiền đúng số', () => {
    expect(nhanThue({ rate: 8, incl: false })).toBe('VAT 8% · giá chưa gồm')
    expect(nhanThue({ rate: 0, incl: false })).toBe('Không VAT')
    expect(viDuThue({ rate: 8, incl: false })).toBe('1.000.000 tiền hàng → 80.000 thuế → tổng 1.080.000') // prettier-ignore
    expect(viDuThue({ rate: 10, incl: true })).toBe(
      'tổng 1.000.000 → trong đó thuế 90.909',
    )
    expect(viDuThue({ rate: 8, incl: true })).toBe(
      'tổng 1.000.000 → trong đó thuế 74.074',
    )
  })

  it('mặc định: đơn trước của NCC → hồ sơ NCC → null', () => {
    expect(thueMacDinh({ ncc: { rate: 10, incl: true, n: 6, kieu: 2 }, nccVat: 8 })).toEqual({ rate: 10, incl: true, nguon: 'don', n: 6, kieu: 2 }) // prettier-ignore
    expect(thueMacDinh({ nccVat: 8 })).toEqual({ rate: 8, incl: false, nguon: 'ho_so' })
    expect(thueMacDinh({})).toBeNull()
  })

  it('gợi ý: nói nguồn khi khớp, nói kiểu thường của NCC khi lệch', () => {
    const md = thueMacDinh({ ncc: { rate: 8, incl: false, n: 7, kieu: 1 } })
    expect(goiYThue({ rate: 8, incl: false }, md)).toBe('theo 7 đơn trước của NCC')
    expect(goiYThue({ rate: 10, incl: false }, md)).toBe(
      'NCC thường: VAT 8% · giá chưa gồm',
    )
    const md2 = thueMacDinh({ ncc: { rate: 10, incl: false, n: 4, kieu: 2 } })
    expect(goiYThue({ rate: 10, incl: false }, md2)).toBe('theo 4 đơn trước của NCC · NCC từng dùng 2 kiểu') // prettier-ignore
    expect(goiYThue({ rate: 8, incl: false }, null)).toBeNull()
  })
})

describe('goiYThueNgan — bản ngắn cạnh ô', () => {
  it('theo NCC / từng n kiểu / hồ sơ / lệch', () => {
    const md = thueMacDinh({ ncc: { rate: 8, incl: false, n: 7, kieu: 1 } })
    expect(goiYThueNgan({ rate: 8, incl: false }, md)).toBe('theo NCC')
    expect(goiYThueNgan({ rate: 10, incl: false }, md)).toBe('NCC thường 8%')
    const md2 = thueMacDinh({ ncc: { rate: 10, incl: true, n: 6, kieu: 2 } })
    expect(goiYThueNgan({ rate: 10, incl: true }, md2)).toBe('theo NCC (2 kiểu)')
    expect(goiYThueNgan({ rate: 0, incl: false }, md2)).toBe('NCC thường 10% đã gồm')
    expect(goiYThueNgan({ rate: 8, incl: false }, thueMacDinh({ nccVat: 8 }))).toBe(
      'theo hồ sơ NCC',
    )
  })
})
