import { describe, expect, it } from 'vitest'
import { barLengthFromName, saveBlockReason } from './material-edit'

describe('barLengthFromName', () => {
  it('ca thật SAT1231: “…15.9x0.6x6m” → 6', () => {
    expect(barLengthFromName('Thép ống kẽm phi 15.9x0.6x6m')).toBe(6)
  })
  it('“cây 5.8 m”, “(cây 6m)” đều đọc được', () => {
    expect(barLengthFromName('Nhôm hộp 25x50 cây 5.8 m')).toBe(5.8)
    expect(barLengthFromName('Sắt vuông 20x20x1 (cây 6m)')).toBe(6)
  })
  it('không nhận mm, m2, số ngoài khoảng cây thật', () => {
    expect(barLengthFromName('Kính 5mm')).toBeNull()
    expect(barLengthFromName('Tôn 2m2')).toBeNull()
    expect(barLengthFromName('Dây 100m')).toBeNull()
    expect(barLengthFromName('Thẻ treo 8x12cm')).toBeNull()
  })
})

describe('saveBlockReason', () => {
  const ok = { name: 'Thép', unit: 'Cây', unitUnconfirmed: false, baremUnconfirmed: false, kgOffPct: null, clearedUnconfirmed: [] } // prettier-ignore
  it('đủ điều kiện → null', () => {
    expect(saveBlockReason(ok)).toBeNull()
  })
  it('thiếu tên nói trước mọi thứ khác', () => {
    expect(saveBlockReason({ ...ok, name: ' ', baremUnconfirmed: true })).toBe(
      'thiếu tên vật tư',
    )
  })
  it('barem lệch nói rõ % (2,39 so với 0,2298 → 940%)', () => {
    expect(
      saveBlockReason({ ...ok, baremUnconfirmed: true, kgOffPct: 2.39 / 0.2298 - 1 }),
    ).toContain('940%')
  })
  it('đổi nhóm liệt kê ô sẽ xoá', () => {
    expect(saveBlockReason({ ...ok, clearedUnconfirmed: ['kg/m', 'Dài cây (m)'] })).toBe(
      'đổi nhóm sẽ xoá kg/m, Dài cây (m) — xác nhận xoá',
    )
  })
})
