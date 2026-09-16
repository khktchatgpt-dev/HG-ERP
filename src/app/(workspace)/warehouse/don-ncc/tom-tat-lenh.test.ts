import { describe, expect, it } from 'vitest'
import { tomTatLenh, type LenhRow } from './tom-tat-lenh'

const HOM_NAY = '2026-09-15'

const don = (p: Partial<LenhRow> = {}): LenhRow => ({
  lines_done: 0,
  lines_total: 3,
  expected_at: null,
  next_shipment: null,
  ...p,
})

describe('tomTatLenh — đếm dòng còn chờ về', () => {
  it('cộng phần còn thiếu qua mọi đơn của lệnh', () => {
    const r = tomTatLenh(
      [don({ lines_done: 1, lines_total: 3 }), don({ lines_done: 0, lines_total: 4 })],
      HOM_NAY,
    )
    expect(r.don).toBe(2)
    expect(r.conLai).toBe(2 + 4)
  })

  it('về đủ hết thì còn 0, không phải null hay âm', () => {
    const r = tomTatLenh([don({ lines_done: 3, lines_total: 3 })], HOM_NAY)
    expect(r.conLai).toBe(0)
  })

  it('NHẬN DƯ không đẩy số về âm — "còn -1 dòng" là vô nghĩa', () => {
    // Kho nhận vượt kèm lý do thì lines_done vượt lines_total.
    const r = tomTatLenh([don({ lines_done: 5, lines_total: 3 })], HOM_NAY)
    expect(r.conLai).toBe(0)
  })

  it('lệnh rỗng thì mọi số về 0, không vỡ', () => {
    expect(tomTatLenh([], HOM_NAY)).toEqual({
      don: 0,
      conLai: 0,
      ganNhat: null,
      quaHen: 0,
    })
  })
})

describe('tomTatLenh — ngày hàng về', () => {
  it('ĐỢT GIAO thắng hạn đơn: đợt là cam kết cho một lô, hạn đơn chỉ là mốc chung', () => {
    const r = tomTatLenh(
      [don({ expected_at: '2026-09-30', next_shipment: { date: '2026-09-18' } })],
      HOM_NAY,
    )
    expect(r.ganNhat).toBe('2026-09-18')
  })

  it('đơn CHƯA chia đợt vẫn tính theo hạn đơn — bỏ qua là nó biến mất khỏi tầm mắt', () => {
    const r = tomTatLenh([don({ expected_at: '2026-09-22T00:00:00Z' })], HOM_NAY)
    expect(r.ganNhat).toBe('2026-09-22')
  })

  it('lấy ngày SỚM NHẤT trong cả lệnh', () => {
    const r = tomTatLenh(
      [
        don({ next_shipment: { date: '2026-09-25' } }),
        don({ next_shipment: { date: '2026-09-17' } }),
        don({ expected_at: '2026-09-20' }),
      ],
      HOM_NAY,
    )
    expect(r.ganNhat).toBe('2026-09-17')
  })

  it('không đơn nào có ngày thì ganNhat null — hiện "chưa hẹn", không hiện 01/01', () => {
    const r = tomTatLenh([don(), don()], HOM_NAY)
    expect(r.ganNhat).toBeNull()
    expect(r.quaHen).toBe(0)
  })
})

describe('tomTatLenh — quá hẹn', () => {
  it('đếm mọi mốc đã qua ngày hôm nay', () => {
    const r = tomTatLenh(
      [
        don({ next_shipment: { date: '2026-09-07' } }),
        don({ next_shipment: { date: '2026-09-10' } }),
        don({ next_shipment: { date: '2026-09-19' } }),
      ],
      HOM_NAY,
    )
    expect(r.quaHen).toBe(2)
  })

  it('đúng ngày hôm nay KHÔNG tính là quá hẹn', () => {
    const r = tomTatLenh([don({ next_shipment: { date: HOM_NAY } })], HOM_NAY)
    expect(r.quaHen).toBe(0)
  })

  it('hạn đơn quá ngày cũng tính, không chỉ đợt giao', () => {
    const r = tomTatLenh([don({ expected_at: '2026-09-01' })], HOM_NAY)
    expect(r.quaHen).toBe(1)
  })
})
