import { describe, expect, it } from 'vitest'
import { usageText, usageTotal, type MaterialUsage } from './material-usage'

const ZERO: MaterialUsage = { po: 0, stock: 0, bom: 0, prices: 0, other: 0 }

describe('material-usage', () => {
  it('chưa dùng ở đâu → tổng 0, câu rỗng', () => {
    expect(usageTotal(ZERO)).toBe(0)
    expect(usageText(ZERO)).toBe('')
  })
  it('chỉ kể nhóm khác 0, đúng thứ tự', () => {
    const u = { ...ZERO, po: 1, stock: 1 }
    expect(usageTotal(u)).toBe(2)
    expect(usageText(u)).toBe('1 dòng đơn mua · 1 dòng sổ kho')
  })
  it('nhóm "khác" (kế hoạch lệnh) vẫn tính là đã dùng', () => {
    expect(usageTotal({ ...ZERO, other: 3 })).toBe(3)
    expect(usageText({ ...ZERO, other: 1200 })).toBe('1.200 dòng kế hoạch lệnh')
  })
})
