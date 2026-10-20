import { describe, expect, it } from 'vitest'
import { khoangTrongKy, maKccTiep, ngaySau, tinhTrangLam } from './bien-dong'

const KY = ['2026-09-26', '2026-10-25'] as const

describe('phần kỳ còn làm', () => {
  it('không ngày vào, không nghỉ → cả kỳ', () => {
    expect(khoangTrongKy({ hireDate: null, leaveDate: null }, ...KY)).toEqual({
      tu: '2026-09-26',
      den: '2026-10-25',
    })
  })
  it('nghỉ giữa kỳ → tới hết ngày làm cuối', () => {
    expect(
      khoangTrongKy({ hireDate: '2021-03-02', leaveDate: '2026-10-20' }, ...KY),
    ).toEqual({ tu: '2026-09-26', den: '2026-10-20' })
  })
  it('vào giữa kỳ → từ ngày vào', () => {
    expect(khoangTrongKy({ hireDate: '2026-10-05', leaveDate: null }, ...KY)?.tu).toBe(
      '2026-10-05',
    )
  })
  it('nghỉ trước kỳ hoặc vào sau kỳ → không có', () => {
    expect(khoangTrongKy({ hireDate: null, leaveDate: '2026-09-25' }, ...KY)).toBeNull()
    expect(khoangTrongKy({ hireDate: '2026-10-26', leaveDate: null }, ...KY)).toBeNull()
  })
  it('nghỉ đúng ngày đầu kỳ vẫn làm một ngày', () => {
    expect(khoangTrongKy({ hireDate: null, leaveDate: '2026-09-26' }, ...KY)).toEqual({
      tu: '2026-09-26',
      den: '2026-09-26',
    })
  })
})

describe('tình trạng suy từ ngày', () => {
  const h = '2026-10-19'
  it('bốn trạng thái', () => {
    expect(tinhTrangLam({ hireDate: null, leaveDate: null }, h)).toBe('dang_lam')
    expect(tinhTrangLam({ hireDate: null, leaveDate: '2026-10-19' }, h)).toBe('sap_nghi')
    expect(tinhTrangLam({ hireDate: null, leaveDate: '2026-10-18' }, h)).toBe('da_nghi')
    expect(tinhTrangLam({ hireDate: '2026-11-01', leaveDate: null }, h)).toBe('chua_vao')
  })
})

describe('mã KCC tự cấp', () => {
  it('lấy số lớn nhất + 1, đệm 3 chữ số', () => {
    expect(maKccTiep(['105', 'KCC-007', 'KCC-011', 'kcc-003'])).toBe('KCC-012')
    expect(maKccTiep(['1', '2'])).toBe('KCC-001')
  })
  it('ngày kế tiếp qua tháng', () => {
    expect(ngaySau('2026-10-31')).toBe('2026-11-01')
  })
})
