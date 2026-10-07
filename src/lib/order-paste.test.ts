import { describe, it, expect } from 'vitest'
import { isoWeekEnd, parseOrderPaste, parseQtyCell, parseShipCell } from './order-paste'
import { shipWeekLabel } from './ship-week'

describe('isoWeekEnd / parseShipCell — nghịch đảo nhãn tuần', () => {
  it('w47.26 → chủ nhật tuần 47/2026, nhãn tính ngược khớp', () => {
    const d = parseShipCell('w47.26')!
    expect(d).toBe('2026-11-22')
    expect(shipWeekLabel(d)).toBe('w47.26')
  })
  it('W01.27 (tuần 1 chứa 4/1) và 53.26 đều ra đúng tuần', () => {
    expect(shipWeekLabel(parseShipCell('W01.27')!)).toBe('w01.27')
    expect(shipWeekLabel(parseShipCell('53.26')!)).toBe('w53.26')
    expect(isoWeekEnd(1, 2027)).toBe('2027-01-10')
  })
  it('dd/mm/yyyy và yyyy-mm-dd nhận thẳng; rác → null', () => {
    expect(parseShipCell('20/11/2026')).toBe('2026-11-20')
    expect(parseShipCell('2026-11-20')).toBe('2026-11-20')
    expect(parseShipCell('ETD theo ORT')).toBeNull()
    expect(parseShipCell('w60.26')).toBeNull()
  })
})

describe('parseQtyCell — số nguyên kiểu VN', () => {
  it('"1.390" = 1390 · "1,200" = 1200 · "12" · "1 200"', () => {
    expect(parseQtyCell('1.390')).toBe(1390)
    expect(parseQtyCell('1,200')).toBe(1200)
    expect(parseQtyCell('12')).toBe(12)
    expect(parseQtyCell('1 200')).toBe(1200)
  })
  it('chữ → null', () => {
    expect(parseQtyCell('abc')).toBeNull()
  })
})

describe('parseOrderPaste — dán cột từ sổ order HG', () => {
  it('có tiêu đề: nhận cột theo tên, bỏ dòng tiêu đề', () => {
    const out = parseOrderPaste(
      'ART.No\tQUANTITY\tSHIPMENT\n21611-217\t1.200\tw37.26\n21611-218\t60\t20/11/2026',
    )
    expect(out.errors).toEqual([])
    expect(out.rows).toEqual([
      {
        line: 2,
        code: '21611-217',
        qty: 1200,
        unit_price: null,
        ship_date: '2026-09-13',
        note: null,
      },
      {
        line: 3,
        code: '21611-218',
        qty: 60,
        unit_price: null,
        ship_date: '2026-11-20',
        note: null,
      },
    ])
  })
  it('không tiêu đề: đoán mã · SL · giá · tuần theo hình dạng ô', () => {
    const out = parseOrderPaste(
      'CH0283HG-AL\t100\t37.73\tw47.26\nCH0284HG-AL\t250\t30.19\tw47.26',
    )
    expect(out.errors).toEqual([])
    expect(out.rows[0]).toMatchObject({
      code: 'CH0283HG-AL',
      qty: 100,
      unit_price: 37.73,
      ship_date: '2026-11-22',
    })
    expect(out.rows[1]).toMatchObject({
      code: 'CH0284HG-AL',
      qty: 250,
      unit_price: 30.19,
    })
  })
  it('chỉ mã + SL (hai cột) → giá/tuần null', () => {
    const out = parseOrderPaste('SP1\t10\nSP2\t20')
    expect(out.rows.map((r) => [r.code, r.qty, r.unit_price])).toEqual([
      ['SP1', 10, null],
      ['SP2', 20, null],
    ])
  })
  it('dòng hỏng báo đúng dòng, dòng khác vẫn vào; dòng trống bỏ qua', () => {
    const out = parseOrderPaste(
      'Mã\tSL\tTuần\nSP1\t10\tw37.26\n\nSP2\tabc\tw37.26\nSP3\t5\tw99.26',
    )
    expect(out.rows.map((r) => r.code)).toEqual(['SP1'])
    expect(out.errors.map((e) => e.line)).toEqual([4, 5])
    expect(out.errors[0].reason).toContain('Số lượng')
    expect(out.errors[1].reason).toContain('Tuần giao')
  })
  it('dấu `;` thay TAB cũng tách được', () => {
    const out = parseOrderPaste('SP1;12;15.5')
    expect(out.rows[0]).toMatchObject({ code: 'SP1', qty: 12, unit_price: 15.5 })
  })
})
