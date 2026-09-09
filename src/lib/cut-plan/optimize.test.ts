import { describe, expect, it } from 'vitest'
import { optimizeCut, planCut } from './optimize'
import { DEFAULT_CUT_PARAMS, type CutItem, type CutParams } from './types'

const P = (over: Partial<CutParams> = {}): CutParams => ({
  ...DEFAULT_CUT_PARAMS,
  ...over,
})

/** Mọi sơ đồ phải cắt được ngoài xưởng và cộng lại đúng nhu cầu. */
function assertSound(items: CutItem[], params: CutParams) {
  const r = optimizeCut(items, params)
  const byId = new Map(items.map((i) => [i.id, i]))
  for (const p of r.patterns) {
    const n = p.pieces.reduce((a, b) => a + b.count, 0)
    const used = p.pieces.reduce((a, b) => a + b.count * byId.get(b.id)!.length_mm, 0)
    expect(used).toBeCloseTo(p.used_mm, 1)
    expect(p.kerf_mm).toBeCloseTo(Math.max(0, n - 1) * params.kerf_mm, 1)
    expect(used + (n - 1) * params.kerf_mm).toBeLessThanOrEqual(r.usable_mm + 1e-6)
    expect(p.remnant_mm).toBeGreaterThanOrEqual(-1e-6)
  }
  for (const it of r.items) expect(it.planned).toBe(it.required)
  expect(r.bars).toBe(r.patterns.reduce((a, p) => a + p.bars, 0))
  return r
}

describe('optimizeCut — như bản gốc (không mạch cắt)', () => {
  it('8 chân 1390 trên cây 6 m → 4 khúc/cây, 2 cây (khớp sổ Cung ứng)', () => {
    const r = assertSound([{ id: 1, length_mm: 1390, qty: 8 }], P())
    expect(r.bars).toBe(2)
    expect(r.patterns).toHaveLength(1)
    expect(r.patterns[0]).toMatchObject({
      pieces: [{ id: 1, count: 4 }],
      bars: 2,
      used_mm: 5560,
    })
    expect(r.patterns[0].remnant_mm).toBe(440)
    expect(r.scrap_mm).toBe(880)
    expect(r.waste_pct).toBe(7.3)
  })

  it('đạt cận dưới lý thuyết khi có cách xếp vừa khít (12 500 mm → 3 cây)', () => {
    const r = assertSound(
      [
        { id: 1, length_mm: 3000, qty: 1 },
        { id: 2, length_mm: 2500, qty: 2 },
        { id: 3, length_mm: 1500, qty: 1 },
        { id: 4, length_mm: 1000, qty: 2 },
        { id: 5, length_mm: 500, qty: 2 },
      ],
      P(),
    )
    expect(r.bars).toBe(3)
    expect(r.scrap_mm).toBe(5500)
    expect(r.waste_pct).toBe(30.6)
  })

  it('chi tiết dài hơn cây → báo lỗi, bỏ ra, các chi tiết khác vẫn xếp', () => {
    const r = optimizeCut(
      [
        { id: 1, length_mm: 6200, qty: 2 },
        { id: 2, length_mm: 1000, qty: 3 },
      ],
      P(),
    )
    expect(r.errors).toHaveLength(1)
    expect(r.errors[0]).toMatch(/6200 mm/)
    expect(r.items).toEqual([
      { id: 1, required: 2, planned: 0 },
      { id: 2, required: 3, planned: 3 },
    ])
    expect(r.bars).toBe(1)
  })

  it('chưa có chiều dài cây → lỗi cấu hình, không tính', () => {
    const r = optimizeCut([{ id: 1, length_mm: 100, qty: 1 }], P({ stock_length_mm: 0 }))
    expect(r.bars).toBe(0)
    expect(r.errors[0]).toMatch(/chiều dài cây/)
  })

  it('SL lẻ làm tròn LÊN (không ai cắt nửa chi tiết)', () => {
    const r = optimizeCut([{ id: 1, length_mm: 1000, qty: 2.2 }], P())
    expect(r.items[0]).toEqual({ id: 1, required: 3, planned: 3 })
  })

  it('bỏ dòng dài ≤ 0 hoặc SL < 1 mà không lỗi', () => {
    const r = optimizeCut(
      [
        { id: 1, length_mm: 0, qty: 5 },
        { id: 2, length_mm: 500, qty: 0 },
      ],
      P(),
    )
    expect(r.bars).toBe(0)
    expect(r.errors).toEqual([])
  })

  it('số lẻ 0,1 mm vẫn xếp đúng và ghi số thật', () => {
    const r = assertSound([{ id: 1, length_mm: 1500.5, qty: 4 }], P())
    expect(r.bars).toBe(2) // 4 × 1500,5 = 6002 > 6000
    const three = r.patterns.find((p) => p.pieces[0].count === 3)!
    expect(three.used_mm).toBe(4501.5)
    expect(three.remnant_mm).toBe(1498.5)
  })

  it('sơ đồ xếp khúc dài trước và sơ đồ đầy lên đầu', () => {
    const r = assertSound(
      [
        { id: 1, length_mm: 390, qty: 30 },
        { id: 2, length_mm: 1390, qty: 4 },
      ],
      P(),
    )
    for (const p of r.patterns) {
      const lens = p.pieces.map((x) => (x.id === 2 ? 1390 : 390))
      expect([...lens].sort((a, b) => b - a)).toEqual(lens)
    }
    for (let i = 1; i < r.patterns.length; i++) {
      expect(r.patterns[i - 1].used_mm).toBeGreaterThanOrEqual(r.patterns[i].used_mm)
    }
  })

  it('bộ ngẫu nhiên 25 loại: không tệ hơn cận dưới + 2 cây, chạy dưới 4 giây', () => {
    const items: CutItem[] = []
    let seed = 7
    const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647
    for (let i = 1; i <= 25; i++) {
      items.push({
        id: i,
        length_mm: 200 + Math.floor(rnd() * 2600),
        qty: 1 + Math.floor(rnd() * 40),
      })
    }
    const t0 = Date.now()
    const r = assertSound(items, P())
    const elapsed = Date.now() - t0
    const lower = Math.ceil(items.reduce((a, i) => a + i.qty * i.length_mm, 0) / 6000)
    expect(r.bars).toBeGreaterThanOrEqual(lower)
    expect(r.bars).toBeLessThanOrEqual(lower + 2)
    expect(elapsed).toBeLessThan(4000)
  })
})

describe('optimizeCut — engine vẫn hiểu mạch cắt / cắt đầu cây (chưa bật ở màn hình)', () => {
  it('có mạch 3 mm: 3 khúc 2000 KHÔNG vừa cây 6000 (cần 2 mạch = 6006)', () => {
    const r = assertSound([{ id: 1, length_mm: 2000, qty: 3 }], P({ kerf_mm: 3 }))
    expect(r.bars).toBe(2)
    const full = r.patterns.find((p) => p.pieces[0].count === 2)!
    expect(full.kerf_mm).toBe(3)
    expect(full.remnant_mm).toBe(1997)
  })

  it('vừa khít kể cả mạch: 3 × 1998 + 2 mạch 3 = 6000 → 1 cây, dư 0', () => {
    const r = assertSound([{ id: 1, length_mm: 1998, qty: 3 }], P({ kerf_mm: 3 }))
    expect(r.bars).toBe(1)
    expect(r.patterns[0].remnant_mm).toBe(0)
  })

  it('cắt bỏ đầu/cuối cây rút ngắn phần dùng được', () => {
    const items = [{ id: 1, length_mm: 2980, qty: 2 }]
    expect(assertSound(items, P({ trim_start_mm: 20, trim_end_mm: 20 })).bars).toBe(1)
    expect(
      assertSound(items, P({ trim_start_mm: 20, trim_end_mm: 20, kerf_mm: 1 })).bars,
    ).toBe(2)
  })
})

describe('planCut — từ lưới nhập', () => {
  const line = (
    key: number,
    part_name: string,
    length_mm: number | '',
    qty: number | '',
  ) => ({
    key,
    part_name,
    length_mm,
    qty,
    note: '',
  })

  it('dòng thiếu dữ liệu bị liệt kê, dòng trống hoàn toàn thì lặng lẽ bỏ', () => {
    const r = planCut({
      stock_length_mm: 6000,
      lines: [
        line(1, '', '', ''),
        line(2, 'Chân', '', 2),
        line(3, 'Tay', 1000, ''),
        line(4, 'Giằng', 1000, 1),
      ],
    })
    expect(r.skipped).toEqual([
      { key: 2, reason: 'Thiếu chiều dài cắt' },
      { key: 3, reason: 'Thiếu số lượng' },
    ])
    expect(r.result.pieces_total).toBe(1)
    expect(r.result.bars).toBe(1)
  })

  it('cây tiêu chuẩn từ đầu phiếu', () => {
    const r = planCut({
      stock_length_mm: 5900,
      lines: [line(1, 'A', 2950, 2), line(2, 'B', 1000, 1)],
    })
    expect(r.result.stock_length_mm).toBe(5900)
    expect(r.result.bars).toBe(2)
  })

  it('không có dòng nào → 0 cây, không lỗi', () => {
    const r = planCut({ stock_length_mm: 6000, lines: [] })
    expect(r.result.bars).toBe(0)
    expect(r.result.errors).toEqual([])
  })

  it('hết ngân sách SHP thì FFD xếp nốt — vẫn đủ mọi chi tiết, không treo', () => {
    // 3000 chiều dài khác nhau, số lẻ: bảng DP đầy đủ mất hàng chục giây (đo
    // 21 s cho 5000 dòng, 09/09/2026). Ngân sách 100 ms → phải xong trong vài
    // giây và mọi chi tiết vẫn được bố trí, sơ đồ nào cũng vừa cây.
    const lines = Array.from({ length: 3000 }, (_, i) =>
      line(i + 1, `CT${i}`, 100 + ((i * 7.5) % 2500), 1 + (i % 4)),
    )
    const t0 = Date.now()
    const r = planCut({ stock_length_mm: 6000, lines }, { shp_budget_ms: 100 })
    expect(Date.now() - t0).toBeLessThan(5000)
    expect(r.result.errors).toEqual([])
    for (const it of r.result.items) expect(it.planned).toBe(it.required)
    for (const p of r.result.patterns) expect(p.remnant_mm).toBeGreaterThanOrEqual(0)
    const totalMm = lines.reduce(
      (a, l) => a + (l.length_mm as number) * (l.qty as number),
      0,
    )
    expect(r.result.bars).toBeGreaterThanOrEqual(Math.ceil(totalMm / 6000))
  })
})
