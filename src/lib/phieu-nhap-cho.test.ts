import { describe, expect, it } from 'vitest'
import { NGOAI_DOT, dotCuaPhieu, gopMa, nhapChoRefs } from './phieu-nhap-cho'

describe('gopMa', () => {
  it('bỏ trùng, bỏ rỗng, giữ thứ tự (lệnh chính đứng đầu)', () => {
    expect(gopMa(['06/26-27 MX', null, ' ', '09/26-27 MX', '06/26-27 MX'])).toEqual([
      '06/26-27 MX',
      '09/26-27 MX',
    ])
  })
})

describe('dotCuaPhieu', () => {
  it('phiếu gắn đợt → Đợt x/y · hẹn dd/mm/yyyy', () => {
    expect(dotCuaPhieu({ seq: 2, expected_date: '2026-10-05' }, 3)).toBe(
      'Đợt 2/3 · hẹn 05/10/2026',
    )
  })
  it('đợt đã bị xoá khỏi đếm vẫn không in "2/1"', () => {
    expect(dotCuaPhieu({ seq: 2, expected_date: '2026-10-05' }, 1)).toBe(
      'Đợt 2/2 · hẹn 05/10/2026',
    )
  })
  it('đơn có đợt mà phiếu không gắn → ngoài đợt', () => {
    expect(dotCuaPhieu(null, 2)).toBe(NGOAI_DOT)
  })
  it('đơn không chia đợt → không in dòng đợt', () => {
    expect(dotCuaPhieu(null, 0)).toBeNull()
  })
})

describe('nhapChoRefs', () => {
  it('đơn gom nhiều lệnh in đủ mọi lệnh', () => {
    expect(
      nhapChoRefs({
        ncc: ['Tân Phát'],
        don: ['PO-2026-0086'],
        lenh: ['06/26-27 MX', '09/26-27 MX'],
        dot: 'Đợt 1/2 · hẹn 01/10/2026',
      }),
    ).toEqual([
      ['Đơn mua:', 'PO-2026-0086'],
      ['Lệnh SX:', '06/26-27 MX, 09/26-27 MX'],
      ['Đợt giao:', 'Đợt 1/2 · hẹn 01/10/2026'],
    ])
  })
  it('đơn không theo lệnh nói rõ, không bỏ trống', () => {
    expect(
      nhapChoRefs({ ncc: ['A'], don: ['PO-2026-0081'], lenh: [], dot: null }),
    ).toEqual([
      ['Đơn mua:', 'PO-2026-0081'],
      ['Lệnh SX:', 'không theo lệnh'],
    ])
  })
  it('hoàn kho: không đơn nhưng có lệnh', () => {
    expect(nhapChoRefs({ ncc: [], don: [], lenh: ['05/26-27 MX'], dot: null })).toEqual([
      ['Lệnh SX:', '05/26-27 MX'],
    ])
  })
  it('nhập ngoài đơn / không có gì → không có khối', () => {
    expect(nhapChoRefs(null)).toEqual([])
    expect(nhapChoRefs({ ncc: [], don: [], lenh: [], dot: null })).toEqual([])
  })
})
