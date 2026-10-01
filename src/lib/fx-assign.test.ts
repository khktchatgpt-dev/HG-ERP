import { describe, expect, it } from 'vitest'
import { fxDeviationPct, planFxAssign, rateRowFor, type FxRate } from './fx'

const rates: FxRate[] = [
  { currency: 'USD', rate_date: '2026-08-12', rate: 25_400 },
  { currency: 'USD', rate_date: '2026-09-29', rate: 25_600 },
]

describe('fxDeviationPct', () => {
  it('dương khi cao hơn dòng trước, làm tròn 1 chữ số', () => {
    expect(fxDeviationPct(25_600, 25_400)).toBe(0.8)
  })
  it('âm sâu khi thiếu một số 0 — ca người nhập hay mắc', () => {
    expect(fxDeviationPct(2_560, 25_600)).toBe(-90)
  })
  it('null khi chưa có dòng trước hoặc số không hợp lệ', () => {
    expect(fxDeviationPct(25_600, null)).toBeNull()
    expect(fxDeviationPct(25_600, 0)).toBeNull()
    expect(fxDeviationPct(0, 25_600)).toBeNull()
  })
})

describe('rateRowFor', () => {
  it('lấy dòng MỚI NHẤT có ngày ≤ ngày chứng từ, không lấy tương lai', () => {
    expect(rateRowFor(rates, 'USD', '2026-09-28')?.rate_date).toBe('2026-08-12')
    expect(rateRowFor(rates, 'USD', '2026-09-29')?.rate_date).toBe('2026-09-29')
    expect(rateRowFor(rates, 'USD', '2026-07-01')).toBeNull()
  })
  it('VND không tra bảng', () => {
    expect(rateRowFor(rates, 'VND', '2026-09-29')).toBeNull()
  })
})

describe('planFxAssign', () => {
  it('gán được thì có tỷ giá + ngày dòng + quy VND; không có dòng ≤ ngày thì đứng yên', () => {
    const plan = planFxAssign(
      [
        { id: '1', kind: 'po', code: 'PO-2026-0102', currency: 'USD', fx_date: '2026-09-28', amount: 12_480 }, // prettier-ignore
        { id: '2', kind: 'po', code: 'PO-2026-0036', currency: 'USD', fx_date: '2026-10-01', amount: 8_120.5 }, // prettier-ignore
        { id: '3', kind: 'so', code: 'DH-2026-0003', currency: 'USD', fx_date: '2026-07-21', amount: 31_250 }, // prettier-ignore
      ],
      rates,
    )
    expect(plan[0]).toMatchObject({
      rate: 25_400,
      rate_date: '2026-08-12',
      base: 316_992_000,
    })
    expect(plan[1]).toMatchObject({
      rate: 25_600,
      rate_date: '2026-09-29',
      base: 207_884_800,
    })
    expect(plan[2]).toMatchObject({ rate: null, rate_date: null, base: null })
  })
  it('không có tỷ giá nào → mọi dòng đứng yên, không đoán', () => {
    const plan = planFxAssign(
      [{ id: '1', kind: 'so', code: 'DH-1', currency: 'USD', fx_date: '2026-10-02', amount: 100 }], // prettier-ignore
      [],
    )
    expect(plan[0].rate).toBeNull()
  })
})
