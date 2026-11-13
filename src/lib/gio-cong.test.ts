import { describe, expect, it } from 'vitest'
import { crewProblem, laborHours, linesKg, parseCrew, productivity } from './gio-cong'

describe('parseCrew', () => {
  it('đọc số kiểu VN, ô trống là null, gõ bậy là NaN', () => {
    expect(parseCrew({ shift: '1', workers: '6', hours: '3,5' })).toEqual({
      shift: 1,
      worker_count: 6,
      hours_per_worker: 3.5,
    })
    expect(parseCrew({ shift: '', workers: ' ', hours: '' })).toEqual({
      shift: null,
      worker_count: null,
      hours_per_worker: null,
    })
    expect(parseCrew({ shift: '1', workers: 'sáu', hours: '8' }).worker_count).toBeNaN()
  })
})

describe('laborHours', () => {
  it('số CN × giờ, thiếu một vế thì null', () => {
    expect(laborHours({ worker_count: 4, hours_per_worker: 7 })).toBe(28)
    expect(laborHours({ worker_count: 3, hours_per_worker: 3.5 })).toBe(10.5)
    expect(laborHours({ worker_count: null, hours_per_worker: 8 })).toBeNull()
    expect(laborHours({ worker_count: 0, hours_per_worker: 8 })).toBeNull()
  })
})

describe('crewProblem', () => {
  it('đủ và đúng → null; ca bỏ trống vẫn được', () => {
    expect(crewProblem({ shift: null, worker_count: 6, hours_per_worker: 8 })).toBeNull()
  })
  it('ô trống là "missing" (chỉ chặn Ghi sổ)', () => {
    expect(
      crewProblem({ shift: 1, worker_count: null, hours_per_worker: 8 }),
    ).toMatchObject({
      missing: true,
      field: 'workers',
    })
    expect(
      crewProblem({ shift: 1, worker_count: 6, hours_per_worker: null }),
    ).toMatchObject({
      missing: true,
      field: 'hours',
    })
  })
  it('gõ sai là lỗi thật (chặn cả lưu nháp), báo trước ô trống', () => {
    expect(
      crewProblem({ shift: 1, worker_count: 2.5, hours_per_worker: null }),
    ).toMatchObject({
      missing: false,
      field: 'workers',
    })
    expect(
      crewProblem({ shift: 1, worker_count: 6, hours_per_worker: 30 }),
    ).toMatchObject({
      missing: false,
      field: 'hours',
    })
    expect(crewProblem({ shift: 4, worker_count: 6, hours_per_worker: 8 })).toMatchObject(
      {
        field: 'shift',
      },
    )
    expect(
      crewProblem({ shift: 1, worker_count: NaN, hours_per_worker: 8 }),
    ).toMatchObject({
      missing: false,
    })
  })
})

describe('productivity', () => {
  it('Σ kg ÷ giờ công, một số lẻ', () => {
    expect(productivity(6703, 48)).toBe(139.6)
  })
  it('không giờ hoặc không kg → null, không phải 0', () => {
    expect(productivity(100, null)).toBeNull()
    expect(productivity(0, 48)).toBeNull()
  })
  it('lỗi sổ Excel: chép giờ lên từng dòng làm năng suất tụt đúng bằng số dòng', () => {
    // 97 dòng, mỗi dòng 50 kg, tổ 4 người × 7 giờ.
    const kg = 97 * 50
    expect(productivity(kg, 28)).toBe(173.2)
    expect(productivity(kg, 28 * 97)).toBe(1.8)
  })
})

describe('linesKg', () => {
  it('kg gõ tay thắng, trống thì ĐM × SL, thiếu ĐM thì đếm vào missing', () => {
    expect(
      linesKg([
        { qty: 416, kg: null, dm_kg: 1.93 },
        { qty: 100, kg: 55, dm_kg: 0.731 },
        { qty: 50, kg: null, dm_kg: null },
        { qty: 0, kg: null, dm_kg: 1 },
      ]),
    ).toEqual({ kg: 857.88, missing: 1 })
  })
})
