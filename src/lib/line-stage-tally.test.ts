import { describe, expect, it } from 'vitest'
import { tallyLineStages, type TallyComponent } from './line-stage-tally'

/**
 * Cần/đạt theo (dòng SP × công đoạn) ĐÚNG ĐƠN VỊ (09/11/2026). Đây là nguồn số
 * của dải công đoạn, Tình hình xưởng và số "cần" của việc giao tổ — phải ra
 * cùng số với Ghi sản lượng cho cùng một ô.
 */

const part = (
  over: Partial<TallyComponent> & { id: string; name: string },
): TallyComponent => ({
  production_order_line_id: 'L1',
  kind: 'part',
  group_code: 'FRAME',
  first_stage: null,
  final_stage: null,
  qty_per_unit: 1,
  dm_kg: null,
  pcs_per_bar: null,
  line_qty: 100,
  ...over,
})

describe('tallyLineStages — BOM phẳng (7/8 lệnh thật)', () => {
  const comps = [
    part({ id: 'chan', name: 'Chân', qty_per_unit: 4 }),
    part({ id: 'me', name: 'Mê', qty_per_unit: 1 }),
  ]

  it('phôi đếm CHI TIẾT = Σ CT/SP × SL; hàn·nguội·sơn đếm BỘ = SL dòng, không phải 500 chi tiết', () => {
    const t = tallyLineStages(comps, null, new Map())
    expect(t.get('phoi')?.needed).toBe(500)
    expect(t.get('phoi')?.by_unit).toEqual([
      { level: 'part', unit: 'chi tiết', needed: 500, done: 0 },
    ])
    for (const s of ['han', 'nguoi', 'son']) {
      expect(t.get(s)?.needed, s).toBe(100)
      expect(t.get(s)?.by_unit, s).toEqual([
        { level: 'cluster', unit: 'cái', needed: 100, done: 0 },
      ])
    }
  })

  it('chặng thành phẩm có mặt với cần = SL dòng, đạt 0 khi chưa vật chất hoá', () => {
    const t = tallyLineStages(comps, null, new Map())
    expect(t.get('lap_rap')).toMatchObject({ needed: 100, done: 0 })
    expect(t.get('hoan_thien')?.by_unit[0]).toMatchObject({ level: 'unit', unit: 'cái' })
    expect([...t.keys()]).toEqual([
      'phoi',
      'han',
      'nguoi',
      'son',
      'lap_rap',
      'bao_bi',
      'dong_goi',
      'hoan_thien',
    ])
  })

  it('đạt ở hàn SUY từ chi tiết chậm nhất — cùng công thức Ghi sản lượng', () => {
    // Chân: 200/400 hàn → 50 bộ; Mê: 80/100 → 80 bộ → min = 50.
    const done = new Map([
      ['chan|han', 200],
      ['me|han', 80],
      ['chan|phoi', 400],
      ['me|phoi', 100],
    ])
    const t = tallyLineStages(comps, null, done)
    expect(t.get('han')).toMatchObject({ needed: 100, done: 50 })
    expect(t.get('han')?.shortfalls[0]).toMatchObject({
      name: 'Cụm khung (mặc nhiên)',
      missing: 50,
    })
    expect(t.get('phoi')).toMatchObject({ needed: 500, done: 500, shortfalls: [] })
  })

  it('đơn vị dòng SP đi theo dòng lệnh ("bộ") thay vì ghi cứng', () => {
    const t = tallyLineStages(comps, null, new Map(), undefined, 'bộ')
    expect(t.get('han')?.by_unit[0].unit).toBe('bộ')
  })

  it('dòng SP chưa có bảng chi tiết → rỗng', () => {
    expect(tallyLineStages([], null, new Map()).size).toBe(0)
  })
})

describe('tallyLineStages — cụm thật (0088, JAWOLL) và hai đơn vị trên một công đoạn', () => {
  const comps = [
    part({
      id: 'tay',
      name: 'Tay vịn',
      qty_per_unit: 2,
      final_stage: 'phoi',
      line_qty: 557,
    }),
    part({ id: 'pat', name: 'Pát', qty_per_unit: 4, final_stage: 'phoi', line_qty: 557 }),
    part({
      id: 'asm',
      name: 'Cụm khung',
      kind: 'assembly',
      qty_per_unit: 1,
      first_stage: 'han',
      line_qty: 557,
    }),
    part({
      id: 'van',
      name: 'Ván ngồi',
      group_code: 'WOOD',
      qty_per_unit: 1,
      line_qty: 557,
    }),
  ]

  it('phôi = chi tiết, hàn = cụm, sơn = cụm + tấm gỗ (không cộng thành một số)', () => {
    const t = tallyLineStages(comps, null, new Map())
    expect(t.get('phoi')).toMatchObject({ needed: 3342 }) // 1.114 + 2.228
    expect(t.get('han')?.by_unit).toEqual([
      { level: 'cluster', unit: 'cụm', needed: 557, done: 0 },
    ])
    expect(t.get('son')?.by_unit).toEqual([
      { level: 'cluster', unit: 'cụm', needed: 557, done: 0 },
      { level: 'part', unit: 'chi tiết', needed: 557, done: 0 },
    ])
    // Có cụm thật → máy không sinh cụm mặc nhiên.
    expect(t.get('han')?.shortfalls.map((s) => s.name)).toEqual(['Cụm khung'])
  })

  it('kế hoạch SX (jobs) thắng lộ trình suy theo nhóm', () => {
    const t = tallyLineStages(
      [part({ id: 'a', name: 'A', qty_per_unit: 1 })],
      ['phoi', 'han', 'son'],
      new Map(),
    )
    expect([...t.keys()]).toEqual([
      'phoi',
      'han',
      'son',
      'lap_rap',
      'bao_bi',
      'dong_goi',
      'hoan_thien',
    ])
    expect(t.get('nguoi')).toBeUndefined()
  })
})
