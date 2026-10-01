import { describe, expect, it } from 'vitest'
import { etaDays, isOpenTrip, tripProblem, tripStatus } from './chuyen-hang'

const t = (
  over: Partial<{
    cancelled_at: string | null
    arrived_at: string | null
    sent_on: string
  }> = {},
) => ({
  cancelled_at: null,
  arrived_at: null,
  sent_on: '2026-09-30',
  ...over,
})

describe('tripStatus', () => {
  it('huỷ thắng mọi thứ', () => {
    expect(
      tripStatus(t({ cancelled_at: '2026-10-01T02:00:00Z' }), [
        { status: 'received', last_receipt_on: '2026-10-02' },
      ]),
    ).toBe('huy')
  })

  it('mọi đơn có phiếu nhập từ ngày gửi trở đi → đã về kho', () => {
    expect(
      tripStatus(t(), [
        { status: 'partial', last_receipt_on: '2026-10-02' },
        { status: 'received', last_receipt_on: null },
      ]),
    ).toBe('da_ve_kho')
  })

  it('phiếu nhập TRƯỚC ngày gửi là của lần giao khác — chưa tính', () => {
    expect(tripStatus(t(), [{ status: 'partial', last_receipt_on: '2026-09-25' }])).toBe(
      'dang_di',
    )
  })

  it('một đơn chưa có phiếu → chưa về kho; đã ghi xe tới thì "đã tới xưởng"', () => {
    const pos = [
      { status: 'confirmed', last_receipt_on: null },
      { status: 'received', last_receipt_on: '2026-10-02' },
    ]
    expect(tripStatus(t(), pos)).toBe('dang_di')
    expect(tripStatus(t({ arrived_at: '2026-10-02T03:00:00Z' }), pos)).toBe('da_toi')
  })

  it('chuyến không còn đơn nào thì không tự coi là đã về', () => {
    expect(tripStatus(t(), [])).toBe('dang_di')
  })

  it('chuyến mở = đang đi hoặc đã tới', () => {
    expect(isOpenTrip('dang_di')).toBe(true)
    expect(isOpenTrip('da_toi')).toBe(true)
    expect(isOpenTrip('da_ve_kho')).toBe(false)
    expect(isOpenTrip('huy')).toBe(false)
  })
})

describe('etaDays', () => {
  it('còn / trễ / không có ngày', () => {
    expect(etaDays('2026-10-02', '2026-10-01')).toBe(1)
    expect(etaDays('2026-09-29', '2026-10-01')).toBe(-2)
    expect(etaDays(null, '2026-10-01')).toBeNull()
  })
})

describe('tripProblem', () => {
  const ok = {
    mode: 'chanh' as const,
    carrier_name: 'Chành xe Hùng Vịnh',
    sent_on: '2026-09-30',
    eta: '2026-10-02',
    po_ids: ['a'],
  }
  it('đủ thì null', () => expect(tripProblem(ok)).toBeNull())
  it('thiếu tên chành', () =>
    expect(tripProblem({ ...ok, carrier_name: ' ' })).toBe('Ghi tên chành hoặc nhà xe'))
  it('dự kiến tới trước ngày gửi', () =>
    expect(tripProblem({ ...ok, eta: '2026-09-29' })).toBe(
      'Ngày dự kiến tới trước ngày gửi',
    ))
  it('không có đơn', () =>
    expect(tripProblem({ ...ok, po_ids: [] })).toBe(
      'Chọn ít nhất một đơn đi trong chuyến',
    ))
})
