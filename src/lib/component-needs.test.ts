import { describe, it, expect } from 'vitest'
import { calcComponent, aggregateMaterialNeeds } from './component-needs'

// Số liệu kiểu file Excel gốc (ghế HALI): 1 SP có 2 "TAY+TỰA", ĐM 0.85 kg/chi
// tiết, 1 cây cắt được 6 chi tiết; lệnh 48 ghế.
describe('calcComponent — tổng cần / kg / số cây (FR-PL-02/03)', () => {
  it('đủ dữ liệu: tổng cần = CT/SP × SL; kg = tổng × ĐM; cây = ceil(tổng / hệ số)', () => {
    const c = calcComponent({ qty_per_unit: 2, dm_kg: 0.85, pcs_per_bar: 6 }, 48)
    expect(c.total_needed).toBe(96) // 2 × 48
    expect(c.kg_needed).toBe(81.6) // 96 × 0.85
    expect(c.bars_needed).toBe(16) // ceil(96 / 6)
    expect(c.missing).toEqual([])
  })

  it('số cây luôn làm tròn LÊN — 96 chi tiết / 7 cây/chi tiết = 13.71 → 14 cây', () => {
    const c = calcComponent({ qty_per_unit: 2, dm_kg: null, pcs_per_bar: 7 }, 48)
    expect(c.bars_needed).toBe(14)
  })

  it('KHÔNG #DIV/0!: hệ số 0 hoặc null → bars null + missing PCS_PER_BAR (NFR-CC-03)', () => {
    expect(
      calcComponent({ qty_per_unit: 1, dm_kg: 1, pcs_per_bar: 0 }, 10),
    ).toMatchObject({ bars_needed: null, missing: ['PCS_PER_BAR'] })
    expect(
      calcComponent({ qty_per_unit: 1, dm_kg: 1, pcs_per_bar: null }, 10).bars_needed,
    ).toBeNull()
  })

  it('thiếu ĐM kg → kg null + missing DM_KG; tổng cần vẫn tính', () => {
    const c = calcComponent({ qty_per_unit: 4, dm_kg: null, pcs_per_bar: null }, 10)
    expect(c.total_needed).toBe(40)
    expect(c.kg_needed).toBeNull()
    expect(c.missing).toEqual(['DM_KG', 'PCS_PER_BAR'])
  })

  it('số lẻ: CT/SP 0.5 (chi tiết chung 2 SP) × 7 SP = 3.5, không lỗi làm tròn nhị phân', () => {
    const c = calcComponent({ qty_per_unit: 0.5, dm_kg: 0.1, pcs_per_bar: null }, 7)
    expect(c.total_needed).toBe(3.5)
    expect(c.kg_needed).toBe(0.35)
  })
})

describe('aggregateMaterialNeeds — gộp theo vật tư', () => {
  const calc = (total: number, kg: number | null, bars: number | null) => ({
    total_needed: total,
    kg_needed: kg,
    bars_needed: bars,
    missing: [] as never[],
  })

  it('nhiều chi tiết cùng vật tư → cộng dồn kg + số cây', () => {
    const out = aggregateMaterialNeeds([
      { material_id: 'm1', calc: calc(96, 81.6, 16) },
      { material_id: 'm1', calc: calc(48, 12.4, 5) },
      { material_id: 'm2', calc: calc(10, 2, 1) },
    ])
    const m1 = out.find((r) => r.material_id === 'm1')!
    expect(m1.total_components).toBe(144)
    expect(m1.kg_needed).toBe(94)
    expect(m1.bars_needed).toBe(21)
    expect(m1.incomplete).toBe(false)
    expect(out).toHaveLength(2)
  })

  it('1 dòng thiếu ĐM/hệ số → incomplete=true nhưng vẫn cộng phần có số', () => {
    const out = aggregateMaterialNeeds([
      { material_id: 'm1', calc: calc(96, 81.6, 16) },
      { material_id: 'm1', calc: calc(48, null, null) },
    ])
    expect(out[0]).toMatchObject({ kg_needed: 81.6, bars_needed: 16, incomplete: true })
  })

  it('dòng chưa gắn vật tư bị bỏ qua (UI cảnh báo riêng)', () => {
    const out = aggregateMaterialNeeds([{ material_id: null, calc: calc(10, 1, 1) }])
    expect(out).toEqual([])
  })
})
