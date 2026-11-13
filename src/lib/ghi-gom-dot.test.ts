import { describe, expect, it } from 'vitest'
import { chiaDot, chiaText, gomTheoMaHang, khoaGom, type PhanDot } from './ghi-gom-dot'

const line = (over: Record<string, unknown> = {}) => ({
  component_id: 'c',
  kind: 'part' as const,
  is_virtual: false,
  cluster: null as string | null,
  name: 'Chân',
  unit: 'cái',
  dm_kg: 0.3758,
  needed: 108,
  done: 0,
  pending: 0,
  remaining: 108,
  today_qty: 0,
  days: [] as { date: string; qty: number; docs: number }[],
  available: null as number | null,
  ...over,
})
const group = (over: Record<string, unknown> = {}) => ({
  order_line_id: 'l1',
  lsx_id: 'x',
  lsx_code: '01/26-27 - GIGA',
  customer_name: 'GIGA',
  product_code: 'TB0298HG-AL',
  product_name: 'Bàn khung nhôm',
  qty: 27,
  unit: 'cái',
  image_src: null,
  dot: 'Đợt 1',
  ship_date: '2026-12-24' as string | null,
  dot_sort: 0,
  lines: [line()],
  ...over,
})

describe('gomTheoMaHang', () => {
  it('gộp cùng mã hàng qua các đợt: cộng SL, cần, đã làm; một dòng mỗi chi tiết', () => {
    const out = gomTheoMaHang([
      group({
        order_line_id: 'l1',
        lines: [
          line({ component_id: 'a1', done: 10, remaining: 98 }),
          line({ component_id: 'b1', name: 'Giằng chân', needed: 54, remaining: 54 }),
        ],
      }),
      group({
        order_line_id: 'l2',
        dot: 'Đợt 2',
        dot_sort: 1,
        lines: [
          line({ component_id: 'a2', days: [{ date: '2026-11-12', qty: 5, docs: 1 }] }),
        ],
      }),
      group({
        order_line_id: 'l9',
        product_code: 'CH0289HG-AL',
        qty: 62,
        lines: [line({ component_id: 'z' })],
      }),
    ])
    expect(out.map((g) => [g.product_code, g.qty, g.dots, g.lines.length])).toEqual([
      ['TB0298HG-AL', 54, 2, 2],
      ['CH0289HG-AL', 62, 1, 1],
    ])
    const chan = out[0].lines[0]
    expect(chan.component_id).toBe(
      khoaGom({
        lsx_id: 'x',
        product_code: 'TB0298HG-AL',
        kind: 'part',
        cluster: null,
        name: 'Chân',
      }),
    )
    expect([chan.needed, chan.done, chan.remaining]).toEqual([216, 10, 206])
    expect(chan.parts.map((p) => p.component_id)).toEqual(['a1', 'a2'])
    expect(chan.days).toEqual([{ date: '2026-11-12', qty: 5, docs: 1 }])
  })
  it('khả dụng: null khi mọi đợt null, cộng khi có', () => {
    const out = gomTheoMaHang([
      group({ lines: [line({ available: null })] }),
      group({ order_line_id: 'l2', lines: [line({ available: 7 })] }),
    ])
    expect(out[0].lines[0].available).toBe(7)
    expect(
      gomTheoMaHang([group(), group({ order_line_id: 'l2' })])[0].lines[0].available,
    ).toBeNull()
  })
})

const part = (over: Partial<PhanDot>): PhanDot => ({
  component_id: 'p',
  order_line_id: 'l',
  dot: 'Đợt 1',
  ship_date: '2026-12-24',
  sort: 0,
  needed: 108,
  done: 0,
  pending: 0,
  remaining: 108,
  ...over,
})

describe('chiaDot', () => {
  const parts = [
    part({ component_id: 'd3', dot: 'Đợt 3', ship_date: '2027-01-21', sort: 2 }),
    part({ component_id: 'd1', dot: 'Đợt 1', ship_date: '2026-12-24', sort: 0 }),
    part({ component_id: 'd2', dot: 'Đợt 2', ship_date: '2026-12-24', sort: 1 }),
  ]
  it('đợt xuất sớm trước, đủ mới sang đợt sau — 120 Chân = đợt 1: 108 · đợt 2: 12', () => {
    const c = chiaDot(parts, { qty: 120, defect: 0, rework: 0, kg: null })
    expect(c.map((x) => [x.component_id, x.qty])).toEqual([
      ['d1', 108],
      ['d2', 12],
    ])
    expect(chiaText(c)).toBe('đợt 1: 108 · đợt 2: 12')
  })
  it('trừ cả số đang chờ duyệt; dư dồn vào đợt cuối', () => {
    const c = chiaDot(
      [
        part({ component_id: 'd1', pending: 100 }),
        part({ component_id: 'd2', dot: 'Đợt 2', sort: 1, remaining: 10 }),
      ],
      { qty: 30, defect: 0, rework: 0, kg: null },
    )
    expect(c.map((x) => [x.component_id, x.qty])).toEqual([
      ['d1', 8],
      ['d2', 22],
    ])
  })
  it('phế / sửa lại theo đợt đầu nhận đạt; chỉ báo phế thì vào đợt đầu còn thiếu', () => {
    expect(chiaDot(parts, { qty: 50, defect: 2, rework: 1, kg: null })).toEqual([
      { component_id: 'd1', dot: 'Đợt 1', qty: 50, defect: 2, rework: 1, kg: null },
    ])
    expect(
      chiaDot(
        [
          part({ component_id: 'd1', remaining: 0 }),
          part({ component_id: 'd2', sort: 1 }),
        ],
        {
          qty: 0,
          defect: 3,
          rework: 0,
          kg: null,
        },
      ),
    ).toEqual([
      { component_id: 'd2', dot: 'Đợt 1', qty: 0, defect: 3, rework: 0, kg: null },
    ])
  })
  it('kg gõ tay chia theo tỉ lệ, phần lẻ vào đợt cuối nhận số — tổng không đổi', () => {
    const c = chiaDot(parts, { qty: 120, defect: 0, rework: 0, kg: 45.1 })
    expect(c.map((x) => x.kg)).toEqual([40.59, 4.51])
    expect(c.reduce((a, x) => a + (x.kg ?? 0), 0)).toBeCloseTo(45.1, 5)
  })
  it('một đợt: giữ nguyên', () => {
    expect(
      chiaDot([part({ component_id: 'x' })], { qty: 5, defect: 0, rework: 0, kg: null }),
    ).toEqual([
      { component_id: 'x', dot: 'Đợt 1', qty: 5, defect: 0, rework: 0, kg: null },
    ])
  })
})
