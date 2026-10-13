import { describe, expect, it } from 'vitest'
import { avgLai, checkPrice, planCostOf, planFromOrder, vsPlanTotal } from './sale-price'

// Ví dụ trong lời giải thích gửi user 13/10: trực tiếp 80, chung 12, lợi nhuận 9,2 → FOB 101,2.
const PLAN = { cost: 92, price: 101.2, currency: 'USD' }

describe('planCostOf', () => {
  it('giá vốn = trực tiếp + chung', () => {
    expect(planCostOf(80, 12)).toBe(92)
    expect(planCostOf(10.105, 0.1)).toBe(10.21)
  })
  it('thiếu một vế (SP chỉ có FOB) → null, không suy ngược', () => {
    expect(planCostOf(null, 12)).toBeNull()
    expect(planCostOf(80, null)).toBeNull()
    expect(planCostOf(undefined, undefined)).toBeNull()
  })
})

describe('checkPrice', () => {
  it('chào ĐÚNG giá bán KH → lãi thực ≈ 9%, ± 0 — lỗi cũ báo "Lãi 0%"', () => {
    const c = checkPrice(101.2, 'USD', PLAN)
    expect(c.lai_pct).toBe(9.1)
    expect(c.vs_plan_pct).toBe(0)
    expect(c.below_cost).toBe(false)
    expect(c.below_plan).toBe(false)
  })
  it('hạ xuống 95 → còn lãi (lỗi cũ báo lỗ), chỉ thấp hơn giá bán KH', () => {
    const c = checkPrice(95, 'USD', PLAN)
    expect(c.lai_pct).toBe(3.2)
    expect(c.vs_plan_pct).toBe(-6.1)
    expect(c.below_cost).toBe(false)
    expect(c.below_plan).toBe(true)
  })
  it('dưới giá vốn → lỗ thật', () => {
    const c = checkPrice(90, 'USD', PLAN)
    expect(c.lai_pct).toBe(-2.2)
    expect(c.below_cost).toBe(true)
  })
  it('SP chỉ có giá bán KH → không có lãi thực, vẫn so được với giá bán KH', () => {
    const c = checkPrice(110, 'USD', { cost: null, price: 100, currency: 'USD' })
    expect(c.lai_pct).toBeNull()
    expect(c.vs_plan_pct).toBe(10)
    expect(c.below_cost).toBe(false)
  })
  it('khác tiền tệ → không so', () => {
    const c = checkPrice(90, 'EUR', PLAN)
    expect(c).toMatchObject({ lai_pct: null, vs_plan_pct: null, currency_mismatch: true })
    expect(c.below_cost).toBe(false)
  })
  it('chưa có giá / chưa có kế hoạch → rỗng', () => {
    expect(checkPrice(0, 'USD', PLAN).lai_pct).toBeNull()
    expect(checkPrice(100, 'USD', null).vs_plan_pct).toBeNull()
  })
})

describe('avgLai', () => {
  it('gia quyền theo trị giá, dòng thiếu SL tính 1, bỏ dòng không so được', () => {
    const r = avgLai([
      { price: 100, qty: 10, cost: 90, comparable: true }, // rev 1000, lãi 100
      { price: 50, qty: null, cost: 25, comparable: true }, // rev 50, lãi 25
      { price: 80, qty: 5, cost: null, comparable: true },
      { price: 80, qty: 5, cost: 10, comparable: false },
    ])
    expect(r.n).toBe(2)
    expect(r.pct).toBe(11.9)
  })
  it('không dòng nào → null', () => {
    expect(avgLai([])).toEqual({ pct: null, n: 0 })
  })
})

describe('vsPlanTotal', () => {
  it('tờ LAURA trên artboard: 41.911,20 / 43.598 − 1 = −3,9%, bỏ dòng thiếu SL', () => {
    const r = vsPlanTotal([
      { price: 87, qty: 160, plan: 87, comparable: true },
      { price: 110.2, qty: 170, plan: 116, comparable: true },
      { price: 172.48, qty: 40, plan: 190, comparable: true },
      { price: 19.65, qty: 120, plan: 19.65, comparable: true },
      { price: 84, qty: null, plan: 81.58, comparable: true },
    ])
    expect(r).toEqual({ pct: -3.9, n: 4 })
  })
  it('khác tiền tệ / chưa có giá bán KH → bỏ', () => {
    expect(vsPlanTotal([{ price: 10, qty: 1, plan: 12, comparable: false }])).toEqual({
      pct: null,
      n: 0,
    })
  })
})

describe('planFromOrder', () => {
  it('nhận đúng ba kiểu câu nguồn đã nạp ngược từ đơn (chép nguyên DB 13/10)', () => {
    expect(
      planFromOrder(
        'TONG HOP DON HANG CON LAI 2026-2027.xlsx › sheet LAURA — giá thành: Ban Hali.xlsx, lợi nhuận tính lại theo giá đơn (báo giá 82)',
      ),
    ).toBe(true)
    expect(
      planFromOrder(
        'order HG 2026-2027.xlsx — giá trên đơn MERXX 18023/18028; chưa có bảng tính giá thành',
      ),
    ).toBe(true)
    expect(
      planFromOrder(
        'Sale điền cột "The price" (05/10/2026) — giá kế hoạch đơn, chưa có bảng tính giá thành',
      ),
    ).toBe(true)
  })
  it('bảng tính giá thật → không gắn nhãn', () => {
    expect(planFromOrder('Quotation - Halston (10 Jul 2026, Drive 18q18J9T)')).toBe(false)
    expect(
      planFromOrder('quotation 10 Aruba-tinh gia.xlsx › dining chair · dòng 29'),
    ).toBe(false)
    expect(planFromOrder(null)).toBe(false)
  })
})
