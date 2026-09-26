import { describe, it, expect } from 'vitest'
import { planAdjustment, type AdjBeforeLine, type AdjAfterLine } from './po-adjust'

/*
 * Số liệu = đơn thật PO-2026-0085 (Tường Nguyên, 3 dòng, VAT 8% cộng thêm) và
 * đúng tình huống vẽ ở artboard 9a: NCC tăng giá NK-0049 150 → 160, đặt thêm
 * 5.000 bulon dòng 2, thêm dòng long đền CN0827 5.000 × 60.
 */
const b = (over: Partial<AdjBeforeLine> & { id: string }): AdjBeforeLine => ({
  material_id: `m-${over.id}`,
  code: 'X',
  name: 'x',
  unit: 'Con',
  qty_ordered: 1,
  unit_price: 1,
  price_basis: 'unit',
  qty2: null,
  received: 0,
  planned: 0,
  invoiced: false,
  ...over,
})
const BEFORE: AdjBeforeLine[] = [
  b({
    id: 'l1',
    material_id: 'BUL0029',
    code: 'BUL0029',
    name: 'Bulon 6x10x13',
    qty_ordered: 19_890,
    unit_price: 110,
  }),
  b({
    id: 'l2',
    material_id: 'BUL0029',
    code: 'BUL0029',
    name: 'Bulon 6x10x13',
    qty_ordered: 34_443,
    unit_price: 110,
  }),
  b({
    id: 'l3',
    material_id: 'NK-0049',
    code: 'NK-0049',
    name: 'Bulong 6x20x13, 7M',
    qty_ordered: 73_114,
    unit_price: 150,
  }),
]
const keep = (l: AdjBeforeLine, over: Partial<AdjAfterLine> = {}): AdjAfterLine => {
  const { received: _r, planned: _p, invoiced: _i, ...rest } = l
  return { ...rest, ...over }
}
const H = { vatRate: 8, discount: null }
const plan = (after: AdjAfterLine[], before = BEFORE, hA = H) =>
  planAdjustment({
    currency: 'VND',
    priceIncludesVat: false,
    before: { lines: before, header: H },
    after: { lines: after, header: hA },
  })

describe('planAdjustment — PO-2026-0085 (artboard 9a)', () => {
  const p = plan([
    keep(BEFORE[0]),
    keep(BEFORE[1], { qty_ordered: 39_443 }),
    keep(BEFORE[2], { unit_price: 160 }),
    {
      material_id: 'CN0827',
      code: 'CN0827',
      name: 'LĐS 6x20x2 màu',
      unit: 'Con',
      qty_ordered: 5_000,
      unit_price: 60,
      price_basis: 'unit',
      qty2: null,
    },
  ])

  it('không lỗi, ra đúng 3 thay đổi (dòng 1 không đổi thì không ghi)', () => {
    expect(p.errors).toEqual([])
    expect(p.changes.map((c) => [c.kind, c.no])).toEqual([
      ['changed', 2],
      ['changed', 3],
      ['added', 4],
    ])
  })

  it('tiền trước / sau khớp số trên artboard', () => {
    expect(p.money.before.grandTotal).toBe(18_299_228)
    expect(p.money.after.subtotal).toBe(18_524_870)
    expect(p.money.after.vatAmount).toBe(1_481_990)
    expect(p.money.after.grandTotal).toBe(20_006_860)
  })

  it('phát sinh tách vì giá / vì lượng, cộng lại đúng chênh tiền hàng', () => {
    expect(p.delta).toEqual({
      subtotal: 1_581_140,
      vat: 126_492,
      total: 1_707_632,
      byPrice: 731_140,
      byQty: 850_000,
    })
    expect(p.changes[0]).toMatchObject({ by_price: 0, by_qty: 550_000 })
    expect(p.changes[1]).toMatchObject({ by_price: 731_140, by_qty: 0 })
    expect(p.changes[2]).toMatchObject({ by_price: 0, by_qty: 300_000 })
  })

  it('dòng cũ đi update theo id, dòng mới đi insert, thứ tự theo lưới', () => {
    expect(p.updates.map((u) => [u.id, u.sort_order])).toEqual([
      ['l1', 0],
      ['l2', 1],
      ['l3', 2],
    ])
    expect(p.inserts.map((u) => [u.code, u.sort_order])).toEqual([['CN0827', 3]])
    expect(p.deleteIds).toEqual([])
  })
})

describe('planAdjustment — dòng vừa đổi giá vừa đổi lượng', () => {
  it('vì giá = SL mới × Δgiá, vì lượng = ΔSL × giá cũ', () => {
    const p = plan([
      keep(BEFORE[0]),
      keep(BEFORE[1]),
      keep(BEFORE[2], { qty_ordered: 70_000, unit_price: 160 }),
    ])
    // 70.000 × 10 = 700.000 vì giá; −3.114 × 150 = −467.100 vì lượng
    expect(p.changes[0]).toMatchObject({ by_price: 700_000, by_qty: -467_100 })
    expect(p.delta.byPrice + p.delta.byQty).toBe(p.delta.subtotal)
  })
})

describe('planAdjustment — giảm tiền ra phát sinh âm (artboard 9f)', () => {
  it('bớt 3.114 con NK-0049 sau lần 1', () => {
    const after1 = BEFORE.map((l) => (l.id === 'l3' ? { ...l, unit_price: 160 } : l))
    const p = planAdjustment({
      currency: 'VND',
      priceIncludesVat: false,
      before: { lines: after1, header: H },
      after: {
        lines: [
          keep(after1[0]),
          keep(after1[1]),
          keep(after1[2], { qty_ordered: 70_000 }),
        ],
        header: H,
      },
    })
    expect(p.errors).toEqual([])
    expect(p.delta.subtotal).toBe(-498_240)
    expect(p.delta.byQty).toBe(-498_240)
  })
})

describe('planAdjustment — chặn tại dòng (artboard 9e)', () => {
  const received = BEFORE.map((l) => (l.id === 'l1' ? { ...l, received: 12_000 } : l))

  it('đặt thấp hơn số đã nhận', () => {
    const p = plan(
      [keep(received[0], { qty_ordered: 10_000 }), keep(received[1]), keep(received[2])],
      received,
    )
    expect(p.errors).toHaveLength(1)
    expect(p.errors[0]).toMatch(/Dòng 1 \(BUL0029.*đã nhận 12\.000.*Chốt thiếu/)
  })

  it('bỏ dòng đã có hàng về', () => {
    const p = plan([keep(received[1]), keep(received[2])], received)
    expect(p.deleteIds).toEqual(['l1'])
    expect(p.errors[0]).toMatch(/không bỏ được — đã nhận 12\.000/)
  })

  it('bỏ dòng đã lên hoá đơn hoặc đang trong đợt giao', () => {
    const inv = BEFORE.map((l) =>
      l.id === 'l1'
        ? { ...l, invoiced: true }
        : l.id === 'l2'
          ? { ...l, planned: 100 }
          : l,
    )
    const p = plan([keep(inv[2])], inv)
    expect(p.errors).toEqual([
      expect.stringMatching(/hoá đơn NCC/),
      expect.stringMatching(/đợt giao/),
    ])
  })

  it('đặt thấp hơn tổng đợt giao đã hẹn', () => {
    const pl = BEFORE.map((l) => (l.id === 'l2' ? { ...l, planned: 30_000 } : l))
    const p = plan([keep(pl[0]), keep(pl[1], { qty_ordered: 20_000 }), keep(pl[2])], pl)
    expect(p.errors[0]).toMatch(/đợt giao đã hẹn 30\.000/)
  })

  it('đổi vật tư của dòng đang chạy', () => {
    const p = plan([
      keep(BEFORE[0], { material_id: 'KHAC' }),
      keep(BEFORE[1]),
      keep(BEFORE[2]),
    ])
    expect(p.errors[0]).toMatch(/không đổi vật tư/)
  })

  it('dòng mới trùng vật tư đã có — nhưng hai dòng CŨ cùng mã thì để yên', () => {
    const p = plan([
      ...BEFORE.map((l) => keep(l)),
      {
        material_id: 'NK-0049',
        code: 'NK-0049',
        name: 'x',
        unit: 'Con',
        qty_ordered: 1,
        unit_price: 1,
        price_basis: 'unit',
        qty2: null,
      },
    ])
    expect(p.errors).toEqual([expect.stringMatching(/Dòng 4.*đã có trong đơn/)])
  })

  it('không có thay đổi nào', () => {
    expect(plan(BEFORE.map((l) => keep(l))).errors).toEqual([
      'Chưa có thay đổi nào so với đơn đang chạy',
    ])
  })

  it('bỏ hết dòng', () => {
    expect(plan([]).errors[0]).toMatch(/ít nhất một dòng/)
  })

  it('id lạ', () => {
    expect(
      plan([...BEFORE.map((l) => keep(l)), keep(BEFORE[0], { id: 'zz' })]).errors[0],
    ).toMatch(/không thuộc đơn này/)
  })
})

describe('planAdjustment — chỉ đổi quy cách / đầu đơn', () => {
  it('sửa quy cách: có thay đổi, phát sinh 0, ghi tên ô đổi', () => {
    const p = plan([
      keep(BEFORE[0], { spec: '6x10x13 xi 7M' }),
      keep(BEFORE[1]),
      keep(BEFORE[2]),
    ])
    expect(p.errors).toEqual([])
    expect(p.changes).toHaveLength(1)
    expect(p.changes[0]).toMatchObject({ fields: ['spec'], by_price: 0, by_qty: 0 })
    expect(p.delta.total).toBe(0)
  })

  it('"" và null coi như nhau — không đẻ thay đổi ma', () => {
    const p = plan([
      keep(BEFORE[0], { note: '' }),
      keep(BEFORE[1], { spec: null }),
      keep(BEFORE[2]),
    ])
    expect(p.errors).toEqual(['Chưa có thay đổi nào so với đơn đang chạy'])
  })

  it('đổi VAT 8 → 10: không dòng nào đổi, phát sinh chỉ ở VAT', () => {
    const p = plan(
      BEFORE.map((l) => keep(l)),
      BEFORE,
      { vatRate: 10, discount: null },
    )
    expect(p.errors).toEqual([])
    expect(p.headerChanges).toEqual({ vat_rate: [8, 10] })
    expect(p.delta).toMatchObject({ subtotal: 0, vat: 338_875 })
  })
})

describe('planAdjustment — giá theo đơn vị 2 (kg)', () => {
  it('tách theo qty2 chứ không theo SL cây', () => {
    const kg: AdjBeforeLine[] = [
      b({
        id: 'n1',
        qty_ordered: 100,
        unit_price: 50_000,
        price_basis: 'unit2',
        qty2: 520,
      }),
    ]
    const p = plan([keep(kg[0], { unit_price: 52_000, qty_ordered: 120, qty2: 624 })], kg)
    // vì giá = 624 kg × 2.000 = 1.248.000; vì lượng = 104 kg × 50.000 = 5.200.000
    expect(p.changes[0]).toMatchObject({ by_price: 1_248_000, by_qty: 5_200_000 })
  })
})
