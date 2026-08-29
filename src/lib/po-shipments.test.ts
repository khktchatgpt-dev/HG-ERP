import { describe, expect, it } from 'vitest'
import {
  allocateReceiptsToShipments,
  earliestExpectedDate,
  mapDraftShipments,
  nextSeq,
  shipmentAmount,
  validateShipments,
  type PoLineForShipment,
  type ShipmentInput,
} from './po-shipments'

const LINES: PoLineForShipment[] = [
  { id: 'l1', qty_ordered: 2000, name: 'Gỗ Ash' },
  { id: 'l2', qty_ordered: 100, name: 'Sơn PU' },
]

const ship = (
  date: string,
  lines: { po_line_id: string; qty: number }[],
): ShipmentInput => ({ expected_date: date, lines })

describe('validateShipments', () => {
  it('bộ đợt khớp đặt: không lỗi, không cảnh báo', () => {
    const v = validateShipments(
      [
        ship('2026-08-19', [{ po_line_id: 'l1', qty: 1000 }]),
        ship('2026-08-22', [
          { po_line_id: 'l1', qty: 1000 },
          { po_line_id: 'l2', qty: 100 },
        ]),
      ],
      LINES,
    )
    expect(v.errors).toEqual([])
    expect(v.warnings).toEqual([])
  })

  it('vượt SL đặt là LỖI chặn', () => {
    const v = validateShipments(
      [ship('2026-08-19', [{ po_line_id: 'l1', qty: 2500 }])],
      LINES,
    )
    expect(v.errors.some((e) => e.includes('vượt SL đặt'))).toBe(true)
  })

  it('NCC xác nhận hụt là CẢNH BÁO, không chặn', () => {
    const v = validateShipments(
      [
        ship('2026-08-19', [
          { po_line_id: 'l1', qty: 1500 },
          { po_line_id: 'l2', qty: 100 },
        ]),
      ],
      LINES,
    )
    expect(v.errors).toEqual([])
    expect(v.warnings.some((w) => w.includes('1.500/2.000'))).toBe(true)
  })

  it('dòng chưa nằm trong đợt nào cũng phải được gọi tên', () => {
    const v = validateShipments(
      [ship('2026-08-19', [{ po_line_id: 'l1', qty: 2000 }])],
      LINES,
    )
    expect(v.warnings.some((w) => w.includes('Sơn PU'))).toBe(true)
  })

  it('dòng lạ / lặp / SL 0 / thiếu ngày đều là lỗi', () => {
    const v = validateShipments(
      [
        {
          expected_date: '',
          lines: [
            { po_line_id: 'l9', qty: 5 },
            { po_line_id: 'l1', qty: 0 },
            { po_line_id: 'l2', qty: 10 },
            { po_line_id: 'l2', qty: 10 },
          ],
        },
      ],
      LINES,
    )
    expect(v.errors.some((e) => e.includes('không thuộc đơn'))).toBe(true)
    expect(v.errors.some((e) => e.includes('lặp hai lần'))).toBe(true)
    expect(v.errors.some((e) => e.includes('> 0'))).toBe(true)
    expect(v.errors.some((e) => e.includes('chưa chọn ngày'))).toBe(true)
  })

  it('thêm đợt mới phải cộng cả SL đã nằm ở đợt cũ', () => {
    const existing = new Map([['l1', 1500]])
    const over = validateShipments(
      [ship('2026-08-25', [{ po_line_id: 'l1', qty: 600 }])],
      LINES,
      existing,
    )
    expect(over.errors.some((e) => e.includes('vượt SL đặt'))).toBe(true)
    const ok = validateShipments(
      [ship('2026-08-25', [{ po_line_id: 'l1', qty: 500 }])],
      LINES,
      existing,
    )
    expect(ok.errors).toEqual([])
  })

  it('số thập phân cộng dồn không bật lỗi vượt oan', () => {
    const lines: PoLineForShipment[] = [{ id: 'l1', qty_ordered: 0.3, name: 'Keo' }]
    const v = validateShipments(
      [
        ship('2026-08-19', [{ po_line_id: 'l1', qty: 0.1 }]),
        ship('2026-08-20', [{ po_line_id: 'l1', qty: 0.2 }]),
      ],
      lines,
    )
    expect(v.errors).toEqual([])
    expect(v.warnings).toEqual([])
  })
})

describe('earliestExpectedDate', () => {
  it('lấy ngày sớm nhất của đợt còn sống, bỏ đợt huỷ/đã nhận', () => {
    expect(
      earliestExpectedDate([
        { expected_date: '2026-08-25', status: 'planned' },
        { expected_date: '2026-08-19', status: 'cancelled' },
        { expected_date: '2026-08-20', status: 'arrived' },
        { expected_date: '2026-08-18', status: 'received' },
      ]),
    ).toBe('2026-08-20')
  })

  it('không còn đợt sống → null (caller giữ expected_at cũ)', () => {
    expect(
      earliestExpectedDate([{ expected_date: '2026-08-19', status: 'received' }]),
    ).toBeNull()
  })
})

describe('nextSeq', () => {
  it('nối tiếp seq lớn nhất, kể cả đợt đã huỷ — không tái dùng số đợt', () => {
    expect(nextSeq([{ seq: 1 }, { seq: 3 }])).toBe(4)
    expect(nextSeq([])).toBe(1)
  })
})

describe('shipmentAmount — tiền kế hoạch của một đợt', () => {
  const money = (over: Partial<import('./po-shipments').ShipmentLineMoney> = {}) =>
    new Map([['l1', { amount: 12_500, qty_ordered: 100, approx: false, ...over }]])

  it('chia tỷ lệ theo SL đợt / SL đặt', () => {
    const r = shipmentAmount([{ po_line_id: 'l1', qty: 40 }], money())
    expect(r.amount).toBe(5_000)
    expect(r.priced).toBe(true)
    expect(r.approx).toBe(false)
  })

  it('giao đủ = đúng thành tiền dòng, không lệch làm tròn kiểu qty×giá', () => {
    const r = shipmentAmount([{ po_line_id: 'l1', qty: 100 }], money())
    expect(r.amount).toBe(12_500)
  })

  it('dòng giá theo kg (unit2) → cắm cờ ước tính', () => {
    const r = shipmentAmount([{ po_line_id: 'l1', qty: 50 }], money({ approx: true }))
    expect(r.approx).toBe(true)
  })

  it('dòng chưa có giá → priced=false, không bịa số 0 như thể miễn phí', () => {
    const r = shipmentAmount([{ po_line_id: 'l1', qty: 50 }], money({ amount: null }))
    expect(r.priced).toBe(false)
    expect(r.amount).toBe(0)
  })

  it('đợt gộp nhiều dòng thì cộng dồn', () => {
    const m = new Map([
      ['l1', { amount: 10_000, qty_ordered: 100, approx: false }],
      ['l2', { amount: 6_000, qty_ordered: 30, approx: false }],
    ])
    const r = shipmentAmount(
      [
        { po_line_id: 'l1', qty: 50 },
        { po_line_id: 'l2', qty: 10 },
      ],
      m,
    )
    expect(r.amount).toBe(7_000)
  })
})

describe('allocateReceiptsToShipments — chứng từ trước, suy diễn theo độ chắc', () => {
  const ship = (
    id: string,
    seq: number,
    qty: number,
    status = 'planned',
    date = `2026-08-1${seq}`,
  ) => ({ id, seq, status, expected_date: date, lines: [{ po_line_id: 'l1', qty }] })

  it('PNK nối đợt là số thật — vào đúng đợt, không cắt trần theo kế hoạch', () => {
    const r = allocateReceiptsToShipments(
      [ship('s1', 1, 600), ship('s2', 2, 600)],
      new Map([['l1', 620]]),
      new Map([['s1', new Map([['l1', 620]])]]), // nhận vượt trong dung sai
    )
    expect(r.get('s1')?.get('l1')).toEqual({ qty: 620, exact: true })
    expect(r.get('s2')?.get('l1')).toBeUndefined()
  })

  it('không có phiếu nối đợt → suy diễn tuần tự theo ngày, cắm cờ exact=false', () => {
    const r = allocateReceiptsToShipments(
      [ship('s1', 1, 600), ship('s2', 2, 600)],
      new Map([['l1', 800]]),
    )
    expect(r.get('s1')?.get('l1')).toEqual({ qty: 600, exact: false })
    expect(r.get('s2')?.get('l1')).toEqual({ qty: 200, exact: false })
  })

  it('GIAO CHÉO: đợt 2 đã "Xe tới" còn đợt 1 vẫn hẹn → phần suy diễn rơi vào đợt 2', () => {
    const r = allocateReceiptsToShipments(
      [ship('s1', 1, 600, 'planned'), ship('s2', 2, 600, 'arrived')],
      new Map([['l1', 500]]),
    )
    expect(r.get('s2')?.get('l1')).toEqual({ qty: 500, exact: false })
    expect(r.get('s1')?.get('l1')).toBeUndefined()
  })

  it('trộn: đợt 1 có chứng từ 400, phần rời 150 không nối → đợt 1 nhận nốt tới trần rồi tràn', () => {
    const r = allocateReceiptsToShipments(
      [ship('s1', 1, 600), ship('s2', 2, 600)],
      new Map([['l1', 750]]),
      new Map([['s1', new Map([['l1', 400]])]]),
    )
    // 400 chứng từ + 200 suy diễn (tới trần 600) → cờ ≈ vì có phần đoán
    expect(r.get('s1')?.get('l1')).toEqual({ qty: 600, exact: false })
    expect(r.get('s2')?.get('l1')).toEqual({ qty: 150, exact: false })
  })

  it('đợt huỷ bị bỏ qua kể cả khi có trong map chứng từ', () => {
    const r = allocateReceiptsToShipments(
      [ship('s1', 1, 600, 'cancelled'), ship('s2', 2, 600)],
      new Map([['l1', 500]]),
      new Map([['s1', new Map([['l1', 500]])]]),
    )
    expect(r.has('s1')).toBe(false)
    expect(r.get('s2')?.get('l1')).toEqual({ qty: 500, exact: false })
  })

  it('không sửa map đầu vào', () => {
    const input = new Map([['l1', 800]])
    allocateReceiptsToShipments([ship('s1', 1, 600)], input)
    expect(input.get('l1')).toBe(800)
  })
})

describe('mapDraftShipments — đợt khai trong form (dòng chưa có id)', () => {
  const ids = ['line-a', 'line-b']

  it('đổi line_index sang po_line_id theo đúng thứ tự dòng', () => {
    const r = mapDraftShipments(
      [{ expected_date: '2026-09-01', lines: [{ line_index: 1, qty: 300 }] }],
      ids,
    )
    expect(r).toEqual([
      { expected_date: '2026-09-01', note: null, lines: [{ po_line_id: 'line-b', qty: 300 }] },
    ])
  })

  it('index trỏ ra ngoài (dòng đã bị xoá) thì bỏ, không chặn lưu đơn', () => {
    const r = mapDraftShipments(
      [
        {
          expected_date: '2026-09-01',
          lines: [
            { line_index: 0, qty: 100 },
            { line_index: 9, qty: 50 },
          ],
        },
      ],
      ids,
    )
    expect(r[0].lines).toEqual([{ po_line_id: 'line-a', qty: 100 }])
  })

  it('đợt rỗng sau khi lọc thì bỏ hẳn', () => {
    expect(
      mapDraftShipments(
        [{ expected_date: '2026-09-01', lines: [{ line_index: 5, qty: 10 }] }],
        ids,
      ),
    ).toEqual([])
  })

  it('SL ≤ 0 bị loại', () => {
    expect(
      mapDraftShipments(
        [{ expected_date: '2026-09-01', lines: [{ line_index: 0, qty: 0 }] }],
        ids,
      ),
    ).toEqual([])
  })

  it('cùng dòng khai hai lần trong một đợt thì cộng lại', () => {
    const r = mapDraftShipments(
      [
        {
          expected_date: '2026-09-01',
          lines: [
            { line_index: 0, qty: 100 },
            { line_index: 0, qty: 50 },
          ],
        },
      ],
      ids,
    )
    expect(r[0].lines).toEqual([{ po_line_id: 'line-a', qty: 150 }])
  })
})
