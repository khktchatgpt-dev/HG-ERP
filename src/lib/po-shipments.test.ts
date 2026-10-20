import { describe, expect, it } from 'vitest'
import {
  splitShipmentLines,
  shipmentStatusesFromReceipts,
  confirmReplacePlan,
  allocateReceiptsToShipments,
  earliestExpectedDate,
  mapDraftShipments,
  nextSeq,
  shipmentAmount,
  validateShipments,
  type PoLineForShipment,
  type ShipmentInput,
  shipmentWaitingReceipt,
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
      {
        expected_date: '2026-09-01',
        note: null,
        lines: [{ po_line_id: 'line-b', qty: 300 }],
      },
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

describe('shipmentWaitingReceipt — đợt còn chờ Kho nhận', () => {
  it('đơn đang chạy + đợt còn sống thì chờ nhận', () => {
    for (const po of ['approved', 'ordered', 'confirmed', 'in_transit', 'partial']) {
      for (const dot of ['planned', 'arrived']) {
        expect(shipmentWaitingReceipt(po, dot), `${po}/${dot}`).toBe(true)
      }
    }
  })

  it('CHÍNH LỖI CŨ: đơn ĐÃ VỀ ĐỦ thì đợt bỏ quên không còn chờ nhận nữa', () => {
    // 02/26HG/BT: status 'received' mà vẫn còn 4 đợt 'planned'.
    expect(shipmentWaitingReceipt('received', 'planned')).toBe(false)
    expect(shipmentWaitingReceipt('received', 'arrived')).toBe(false)
  })

  it('đơn huỷ thì thôi — không ai chờ hàng của đơn đã huỷ', () => {
    expect(shipmentWaitingReceipt('cancelled', 'planned')).toBe(false)
  })

  it('đơn chưa gửi NCC thì chưa có gì để chờ', () => {
    expect(shipmentWaitingReceipt('draft', 'planned')).toBe(false)
    expect(shipmentWaitingReceipt('pending_approval', 'planned')).toBe(false)
  })

  it('đợt đã nhận xong / đã huỷ thì không chờ, dù đơn còn chạy', () => {
    expect(shipmentWaitingReceipt('partial', 'received')).toBe(false)
    expect(shipmentWaitingReceipt('partial', 'cancelled')).toBe(false)
  })
})

describe('confirmReplacePlan — NCC xác nhận không xoá lịch cũ', () => {
  const cur = [
    { id: 'a', seq: 1, status: 'planned', lines: [{ po_line_id: 'L1', qty: 300 }] },
    { id: 'b', seq: 2, status: 'received', lines: [{ po_line_id: 'L1', qty: 200 }] },
    { id: 'c', seq: 3, status: 'cancelled', lines: [{ po_line_id: 'L1', qty: 999 }] },
  ]
  it('đợt đề nghị chưa có hàng → đánh dấu thay, KHÔNG xoá', () => {
    expect(confirmReplacePlan(cur).cancelIds).toEqual(['a'])
  })
  it('đợt đã có hàng giữ nguyên và tính vào SL đã hẹn; đợt đã huỷ không tính', () => {
    expect(confirmReplacePlan(cur).keptQty.get('L1')).toBe(200)
  })
  it('cam kết mới đánh số nối tiếp, kể cả sau đợt đã huỷ', () => {
    expect(confirmReplacePlan(cur).startSeq).toBe(4)
    expect(confirmReplacePlan([]).startSeq).toBe(1)
  })
})

describe('shipmentStatusesFromReceipts — trạng thái đợt theo số nhận cộng dồn', () => {
  const S = (id: string, seq: number, date: string, qty: number, status = 'planned') => ({
    id, seq, status, expected_date: date, lines: [{ po_line_id: 'L', qty }],
  }) // prettier-ignore
  const rec = (n: number) => new Map([['L', n]])

  it('đợt nhận bằng HAI phiếu → đủ thì received (bản cũ kẹt arrived)', () => {
    const d1 = S('d1', 1, '2026-10-01', 100, 'arrived')
    const linked = new Map([['d1', new Map([['L', 100]])]]) // 60 + 40, hai phiếu cùng nối đợt
    expect(shipmentStatusesFromReceipts([d1], rec(100), linked)).toEqual(new Map([['d1', 'received']]))
  })

  it('nhận DƯ đợt 1 → phần dư lấp đợt 2 (hàng gấp chở luôn)', () => {
    const d1 = S('d1', 1, '2026-10-01', 100)
    const d2 = S('d2', 2, '2026-10-10', 100)
    const linked = new Map([['d1', new Map([['L', 150]])]])
    const out = shipmentStatusesFromReceipts([d1, d2], rec(150), linked)
    expect(out.get('d1')).toBe('received')
    expect(out.get('d2')).toBe('arrived') // đã có 50/100
  })

  it('nhận ngoài đợt đủ cả hai đợt → cả hai received', () => {
    const out = shipmentStatusesFromReceipts([S('d1', 1, '2026-10-01', 100), S('d2', 2, '2026-10-10', 50)], rec(150)) // prettier-ignore
    expect([...out.values()]).toEqual(['received', 'received'])
  })

  it('đảo phiếu làm thiếu → received lùi về arrived; không còn gì vẫn arrived (xe đã tới)', () => {
    const out = shipmentStatusesFromReceipts([S('d1', 1, '2026-10-01', 100, 'received')], rec(0))
    expect(out.get('d1')).toBe('arrived')
  })

  it('chứng từ nối đợt nhiều hơn số NET (đã trả NCC) → chỉ tính số net', () => {
    const d1 = S('d1', 1, '2026-10-01', 100, 'received')
    const linked = new Map([['d1', new Map([['L', 100]])]])
    expect(shipmentStatusesFromReceipts([d1], rec(70), linked).get('d1')).toBe('arrived')
  })

  it('không đổi thì không trả; đợt huỷ không đụng', () => {
    const out = shipmentStatusesFromReceipts([S('d1', 1, '2026-10-01', 100), S('dx', 2, '2026-10-01', 100, 'cancelled')], rec(0)) // prettier-ignore
    expect(out.size).toBe(0)
  })
})

describe('splitShipmentLines — lấy trước một phần đợt', () => {
  const cur = [{ po_line_id: 'A', qty: 100 }, { po_line_id: 'B', qty: 40 }]
  it('kéo 30 A lên đợt mới, đợt gốc còn 70 A + 40 B', () => {
    expect(splitShipmentLines(cur, [{ po_line_id: 'A', qty: 30 }])).toEqual({
      remain: [{ po_line_id: 'A', qty: 70 }, { po_line_id: 'B', qty: 40 }],
      pulled: [{ po_line_id: 'A', qty: 30 }],
      errors: [],
    })
  })
  it('lấy hết một dòng thì dòng đó rời đợt gốc', () => {
    expect(splitShipmentLines(cur, [{ po_line_id: 'B', qty: 40 }]).remain).toEqual([{ po_line_id: 'A', qty: 100 }])
  })
  it('vượt số của đợt / dòng lạ / không nhập gì → lỗi', () => {
    expect(splitShipmentLines(cur, [{ po_line_id: 'A', qty: 120 }]).errors[0]).toMatch(/vượt/)
    expect(splitShipmentLines(cur, [{ po_line_id: 'Z', qty: 1 }]).errors[0]).toMatch(/không nằm/)
    expect(splitShipmentLines(cur, []).errors[0]).toMatch(/Chưa nhập/)
  })
  it('lấy trước TOÀN BỘ đợt → chỉ sang "Dời đợt"', () => {
    expect(splitShipmentLines(cur, [{ po_line_id: 'A', qty: 100 }, { po_line_id: 'B', qty: 40 }]).errors[0]).toMatch(/Dời đợt/)
  })
})
