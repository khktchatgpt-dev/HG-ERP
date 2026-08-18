import { describe, expect, it } from 'vitest'
import {
  earliestExpectedDate,
  nextSeq,
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
