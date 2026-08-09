import { describe, expect, it } from 'vitest'
import { isoWeek, shipWeekLabel } from './ship-week'

describe('isoWeek / shipWeekLabel — ISO-8601', () => {
  it('đầu năm: 1/1/2026 là thứ Năm → tuần 1', () => {
    expect(shipWeekLabel('2026-01-01')).toBe('w01.26')
  })

  it('cuối năm trước thuộc tuần 1 năm sau (29/12/2025 thứ Hai)', () => {
    expect(shipWeekLabel('2025-12-29')).toBe('w01.26')
  })

  it('năm 53 tuần: 31/12/2026 (thứ Năm) → w53.26', () => {
    expect(shipWeekLabel('2026-12-31')).toBe('w53.26')
  })

  it('đầu tháng 1 thuộc tuần 53 năm trước (3/1/2027 Chủ nhật)', () => {
    expect(shipWeekLabel('2027-01-03')).toBe('w53.26')
  })

  it('giữa năm: 20/11/2026 (thứ Sáu) → w47.26', () => {
    expect(isoWeek('2026-11-20')).toEqual({ week: 47, year: 2026 })
    expect(shipWeekLabel('2026-11-20')).toBe('w47.26')
  })

  it('rỗng / ngày hỏng → null', () => {
    expect(shipWeekLabel(null)).toBeNull()
    expect(shipWeekLabel('')).toBeNull()
    expect(shipWeekLabel('not-a-date')).toBeNull()
  })
})
