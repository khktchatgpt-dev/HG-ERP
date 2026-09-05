import { describe, expect, it } from 'vitest'
import {
  buildBangKe,
  classifyBangKe,
  summarizeBangKe,
  type BangKeFacts,
  type BangKeNeed,
} from './lsx-bang-ke'

const need = (over: Partial<BangKeNeed> = {}): BangKeNeed => ({
  material_id: 'm1',
  material_code: 'T-VUO-20X0.7',
  material_name: 'Vuông 20x0.7',
  unit: 'cây',
  group_name: 'Thép',
  qty_needed: 1453,
  qty_issued: 0,
  qty_remaining: 1453,
  source: 'bom',
  ...over,
})

const facts = (over: Partial<BangKeFacts> = {}): BangKeFacts => ({
  on_hand: 0,
  reserved_others: 0,
  ordered: 0,
  pending: 0,
  draft: 0,
  received: 0,
  pos: [],
  ...over,
})

describe('classifyBangKe', () => {
  const base = { qty_needed: 100, qty_remaining: 100, ordered: 0, pending: 0, draft: 0 }
  it('còn phải đặt mà không có đơn nào = Chưa đặt', () => {
    expect(classifyBangKe({ ...base, suggest: 100, source: 'bom' })).toBe('none')
  })
  it('còn phải đặt, chỉ có nháp / chờ ký = Đơn chưa duyệt (không phải "chưa ai làm gì")', () => {
    expect(classifyBangKe({ ...base, suggest: 100, draft: 100, source: 'bom' })).toBe(
      'pending',
    )
    expect(classifyBangKe({ ...base, suggest: 100, pending: 100, source: 'bom' })).toBe(
      'pending',
    )
  })
  it('còn phải đặt dù đã có đơn duyệt = Đặt chưa đủ', () => {
    expect(classifyBangKe({ ...base, suggest: 20, ordered: 80, source: 'bom' })).toBe(
      'short',
    )
  })
  it('không còn phải đặt: có đơn mở = Đang về, không thì Đủ', () => {
    expect(classifyBangKe({ ...base, suggest: 0, ordered: 100, source: 'bom' })).toBe(
      'inflight',
    )
    expect(classifyBangKe({ ...base, suggest: 0, source: 'bom' })).toBe('done')
  })
  it('dòng tay số 0 (vừa thêm mã) = Chưa có số, không phải Đủ', () => {
    expect(
      classifyBangKe({ ...base, qty_needed: 0, qty_remaining: 0, suggest: 0, source: 'manual' }),
    ).toBe('blank')
  })
  it('mã chỉ có trên đơn = Ngoài định mức', () => {
    expect(classifyBangKe({ ...base, suggest: 0, ordered: 5, source: 'none' })).toBe(
      'extra',
    )
  })
})

describe('buildBangKe', () => {
  it('còn phải đặt = còn cần − khả dụng − đã đặt (cùng công thức form soạn đơn)', () => {
    const rows = buildBangKe({
      needs: [need()],
      manual: [],
      facts: new Map([
        ['m1', facts({ on_hand: 133, reserved_others: 0, ordered: 500, received: 485 })],
      ]),
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      available: 133,
      ordered: 500,
      suggest: 820,
      status: 'short',
      source: 'bom',
    })
  })

  it('dòng tay ghi đè từng mã, gắn cờ lệch khi khác định mức > 10%', () => {
    const rows = buildBangKe({
      needs: [
        need(),
        need({
          material_id: 'm2',
          material_code: 'T-LA-2.5X30',
          qty_needed: 100,
          qty_remaining: 100,
        }),
      ],
      manual: [
        {
          material_id: 'm1',
          material_code: 'T-VUO-20X0.7',
          material_name: 'Vuông 20x0.7',
          unit: 'cây',
          qty_needed: 1000,
          note: 'lấy tròn bó',
        },
      ],
      facts: new Map(),
    })
    const m1 = rows.find((r) => r.material_id === 'm1')!
    const m2 = rows.find((r) => r.material_id === 'm2')!
    expect(m1).toMatchObject({
      source: 'manual',
      qty_needed: 1000,
      auto_needed: 1453,
      deviates: true,
      note: 'lấy tròn bó',
    })
    expect(m2).toMatchObject({ source: 'bom', qty_needed: 100, deviates: false })
  })

  it('mã có đơn mua nhưng không có trong nhu cầu → dòng Ngoài định mức, tên lấy từ đơn', () => {
    const rows = buildBangKe({
      needs: [],
      manual: [],
      facts: new Map([
        [
          'm9',
          facts({
            ordered: 50,
            pos: [
              {
                id: 'p1',
                code: 'PO-1',
                supplier_name: 'Visa',
                status: 'ordered',
                expected_at: null,
                qty_ordered: 50,
                qty_received: 0,
                late: false,
              },
            ],
            material: {
              material_code: 'NK-0001',
              material_name: 'Nhôm',
              unit: 'cây',
              group_name: null,
            },
          }),
        ],
        // Chỉ có tồn, không đơn, không nhu cầu → không hiện.
        ['m8', facts({ on_hand: 99 })],
      ]),
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      material_code: 'NK-0001',
      status: 'extra',
      qty_needed: 0,
    })
  })

  it('xếp gấp lên đầu: Chưa đặt → Đặt chưa đủ → Đơn chưa duyệt → Đang về → Đủ; cùng mức thì thiếu nhiều trước', () => {
    const rows = buildBangKe({
      needs: [
        need({ material_id: 'a', material_code: 'A', qty_needed: 10, qty_remaining: 10 }),
        need({ material_id: 'b', material_code: 'B', qty_needed: 10, qty_remaining: 10 }),
        need({ material_id: 'c', material_code: 'C', qty_needed: 50, qty_remaining: 50 }),
        need({ material_id: 'd', material_code: 'D', qty_needed: 10, qty_remaining: 10 }),
        need({ material_id: 'e', material_code: 'E', qty_needed: 10, qty_remaining: 10 }),
      ],
      manual: [],
      facts: new Map([
        ['a', facts({ ordered: 10 })], // inflight
        ['b', facts({ on_hand: 10 })], // done
        ['c', facts({ ordered: 5 })], // short 45
        ['d', facts({ draft: 10 })], // pending
        // e: none
      ]),
    })
    expect(rows.map((r) => r.material_code)).toEqual(['E', 'C', 'D', 'A', 'B'])
    expect(summarizeBangKe(rows)).toMatchObject({
      blank: 0,
      none: 1,
      short: 1,
      pending: 1,
      inflight: 1,
      done: 1,
      extra: 0,
      total: 5,
      needed: 5,
    })
  })
})
