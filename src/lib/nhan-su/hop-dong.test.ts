import { describe, expect, it } from 'vitest'
import { canhBaoHd, chongNhau, hdHienHanh, tinhTrangHd } from './hop-dong'

const H = '2026-10-19'
const hd = (tuNgay: string, denNgay: string | null, huy = false) => ({
  tuNgay,
  denNgay,
  huy,
})

describe('tình trạng hợp đồng theo ngày', () => {
  it('năm trạng thái; ngày cuối 30 ngày tới là sắp hết', () => {
    expect(tinhTrangHd(hd('2026-01-01', '2026-12-31'), H)).toBe('hieu_luc')
    expect(tinhTrangHd(hd('2026-01-01', '2026-11-18'), H)).toBe('sap_het')
    expect(tinhTrangHd(hd('2026-01-01', '2026-11-19'), H)).toBe('hieu_luc')
    expect(tinhTrangHd(hd('2026-01-01', '2026-10-18'), H)).toBe('het_han')
    expect(tinhTrangHd(hd('2026-01-01', '2026-10-19'), H)).toBe('sap_het')
    expect(tinhTrangHd(hd('2026-11-01', null), H)).toBe('chua_hieu_luc')
    expect(tinhTrangHd(hd('2021-03-02', null), H)).toBe('hieu_luc')
    expect(tinhTrangHd(hd('2026-01-01', '2026-12-31', true), H)).toBe('huy')
  })
  it('HĐ đang áp: đang hiệu lực mới nhất; không có thì HĐ gần nhất chưa huỷ', () => {
    const ds = [
      hd('2025-01-01', '2025-12-31'),
      hd('2026-01-01', '2026-12-31'),
      hd('2026-06-01', null, true),
    ]
    expect(hdHienHanh(ds, H)?.tuNgay).toBe('2026-01-01')
    expect(hdHienHanh([hd('2025-01-01', '2025-12-31')], H)?.tuNgay).toBe('2025-01-01')
    expect(hdHienHanh([hd('2026-06-01', null, true)], H)).toBeNull()
  })
})

describe('chồng thời gian, cảnh báo luật', () => {
  it('chồng khi giao nhau; không xác định thời hạn kéo vô cùng', () => {
    expect(
      chongNhau(hd('2026-01-01', '2026-06-30'), hd('2026-06-30', '2026-12-31')),
    ).toBe(true)
    expect(
      chongNhau(hd('2026-01-01', '2026-06-30'), hd('2026-07-01', '2026-12-31')),
    ).toBe(false)
    expect(chongNhau(hd('2020-01-01', null), hd('2026-07-01', '2026-12-31'))).toBe(true)
  })
  it('thử việc quá 60 ngày, xác định thời hạn quá 36 tháng', () => {
    expect(
      canhBaoHd({ loai: 'probation', tuNgay: '2026-10-01', denNgay: '2026-11-29' }),
    ).toEqual([])
    expect(
      canhBaoHd({ loai: 'probation', tuNgay: '2026-10-01', denNgay: '2026-12-31' }),
    ).toHaveLength(1)
    expect(
      canhBaoHd({ loai: 'fixed', tuNgay: '2026-01-01', denNgay: '2028-12-31' }),
    ).toEqual([])
    expect(
      canhBaoHd({ loai: 'fixed', tuNgay: '2026-01-01', denNgay: '2030-01-01' }),
    ).toHaveLength(1)
  })
})
