import { describe, expect, it } from 'vitest'
import {
  demTheoLan,
  khopTimKiem,
  laneOf,
  soNgayToi,
  whyOf,
  xepTrongLan,
  type HangVeRow,
} from './kho-hang-ve'

const TODAY = '2026-09-16'

const row = (p: Partial<HangVeRow> & { key: string }): HangVeRow => ({
  po_id: 'po-' + p.key,
  po_code: 'PO-' + p.key,
  supplier_name: 'NCC',
  lsx_code: null,
  shipment_id: null,
  seq: null,
  arrived: false,
  date: null,
  line_count: null,
  total_qty: null,
  lines_done: 0,
  lines_total: 1,
  ...p,
})

describe('laneOf', () => {
  it('không có ngày → chưa hẹn', () => expect(laneOf(null, TODAY)).toBe('no_eta'))
  it('trước hôm nay → quá hẹn', () => expect(laneOf('2026-09-12', TODAY)).toBe('late'))
  it('đúng hôm nay → hôm nay', () => expect(laneOf('2026-09-16', TODAY)).toBe('today'))
  it('sau hôm nay → sắp tới', () => expect(laneOf('2026-09-18', TODAY)).toBe('soon'))
})

describe('soNgayToi', () => {
  it('đếm đúng qua ranh giới tháng', () => {
    expect(soNgayToi('2026-10-01', '2026-09-30')).toBe(1)
    expect(soNgayToi('2026-09-12', TODAY)).toBe(-4)
  })
})

describe('demTheoLan — số trên chip là lời hứa', () => {
  it('tổng các làn = tổng dòng, mỗi dòng đúng một làn', () => {
    const rows = [
      row({ key: '1', date: '2026-09-12' }),
      row({ key: '2', date: '2026-09-16' }),
      row({ key: '3', date: '2026-09-16', arrived: true }),
      row({ key: '4', date: '2026-09-19' }),
      row({ key: '5' }),
      row({ key: '6' }),
    ]
    const c = demTheoLan(rows, TODAY)
    expect(c).toEqual({ late: 1, today: 2, soon: 1, no_eta: 2, all: 6 })
    expect(c.late + c.today + c.soon + c.no_eta).toBe(c.all)
  })
})

describe('whyOf — dòng phụ nói điều cần biết', () => {
  it('trễ nói số ngày trễ, tone stop, kèm đợt', () => {
    expect(whyOf({ date: '2026-09-12', arrived: false, seq: 1 }, TODAY)).toEqual({
      text: 'trễ 4 ngày · đợt 1',
      tone: 'stop',
    })
  })
  it('xe đã tới hôm nay → warn, không nói "còn 0 ngày"', () => {
    expect(whyOf({ date: TODAY, arrived: true, seq: 2 }, TODAY)).toEqual({
      text: 'NCC báo xe đã tới · đợt 2',
      tone: 'warn',
    })
  })
  it('trễ mà xe đã tới: trễ đứng trước, tone stop thắng', () => {
    const r = whyOf({ date: '2026-09-15', arrived: true, seq: null }, TODAY)
    expect(r.text).toBe('trễ 1 ngày · NCC báo xe đã tới')
    expect(r.tone).toBe('stop')
  })
  it('chưa hẹn ngày nói thẳng', () => {
    expect(whyOf({ date: null, arrived: false, seq: null }, TODAY).text).toBe(
      'chưa chốt ngày giao',
    )
  })
})

describe('xepTrongLan', () => {
  it('ngày sớm trước, cùng ngày thì xe tới trước, rồi theo mã', () => {
    const rows = [
      row({ key: 'c', date: '2026-09-18' }),
      row({ key: 'b', date: '2026-09-17' }),
      row({ key: 'a', date: '2026-09-17', arrived: true }),
      row({ key: 'z' }),
    ]
    expect(rows.sort(xepTrongLan).map((r) => r.key)).toEqual(['a', 'b', 'c', 'z'])
  })
})

describe('khopTimKiem', () => {
  const r = row({ key: '0044', supplier_name: 'Vạn Vi Thành', lsx_code: 'LSX 07/26-14' })
  it('khớp mã đơn, NCC, lệnh — không phân biệt hoa thường', () => {
    expect(khopTimKiem(r, 'po-0044')).toBe(true)
    expect(khopTimKiem(r, 'vi thành')).toBe(true)
    expect(khopTimKiem(r, '07/26')).toBe(true)
    expect(khopTimKiem(r, 'sơn')).toBe(false)
  })
  it('rỗng thì khớp tất cả', () => expect(khopTimKiem(r, '  ')).toBe(true))
})
