import { describe, expect, it } from 'vitest'
import {
  applyPaste,
  blockers,
  changedDays,
  fillWeek,
  initialDraft,
  isoWeek,
  parseQty,
  payloadForDay,
  rowTotal,
  weekLabel,
} from './chi-tieu.shared'
import type { ChiTieuRow } from '@/modules/dept/production/targets.service'

/**
 * Chỉ tiêu ngày theo tuần (11/11/2026): đọc số VN, Σ tuần gõ thắng suy, câu
 * chặn, chỉ ghi ngày ≥ hôm nay có ô đổi, không xoá cặp không bày, "→ tuần".
 */

const DAYS = [
  '2026-11-09',
  '2026-11-10',
  '2026-11-11',
  '2026-11-12',
  '2026-11-13',
  '2026-11-14',
  '2026-11-15',
]
const TODAY = '2026-11-11'
const phoi: ChiTieuRow = {
  team_id: 'tp',
  team_name: 'Tổ Phôi',
  stage: 'phoi',
  stage_label: 'Phôi',
  unit: 'chi tiết',
}
const han: ChiTieuRow = {
  team_id: 'th',
  team_name: 'Tổ Hàn',
  stage: 'han',
  stage_label: 'Hàn',
  unit: 'cụm',
}
const ROWS = [phoi, han]
const k = (r: ChiTieuRow, d: string) => `${r.team_id}|${r.stage}|${d}`

describe('tuần + số', () => {
  it('số tuần ISO và nhãn', () => {
    expect(isoWeek('2026-11-09')).toBe(46)
    expect(weekLabel(DAYS)).toEqual({ so: 46, khoang: '09–15/11' })
    expect(weekLabel(['2026-10-26', '', '', '', '', '', '2026-11-01']).khoang).toBe(
      '26/10–01/11',
    )
    expect(weekLabel(['2026-12-28', '', '', '', '', '', '2027-01-03']).khoang).toBe(
      '28/12/2026–03/01/2027',
    )
  })
  it('parseQty: nghìn VN, phẩy thập phân, trống, rác', () => {
    expect(parseQty('1.960')).toBe(1960)
    expect(parseQty('12,5')).toBe(12.5)
    expect(parseQty('0')).toBe(0)
    expect(parseQty('  ')).toBeNull()
    expect(parseQty('8oo')).toBeNaN()
    expect(parseQty('-3')).toBeNaN()
  })
})

describe('Σ tuần', () => {
  it('ô gõ thắng số suy cùng ngày; ≈ khi còn chứa suy', () => {
    const derived = new Map([
      [k(phoi, '2026-11-11'), 1960],
      [k(phoi, '2026-11-12'), 2580],
    ])
    expect(rowTotal(phoi, DAYS, { [k(phoi, '2026-11-12')]: '2.400' }, derived)).toEqual({
      sum: 4360,
      approx: true,
      empty: false,
    })
    expect(rowTotal(han, DAYS, {}, derived)).toEqual({
      sum: 0,
      approx: false,
      empty: true,
    })
    expect(
      rowTotal(
        phoi,
        DAYS,
        { [k(phoi, '2026-11-11')]: '0', [k(phoi, '2026-11-12')]: '0' },
        derived,
      ),
    ).toEqual({
      sum: 0,
      approx: false,
      empty: false,
    })
  })
})

describe('chặn + ghi', () => {
  it('câu chặn chỉ đúng ô', () => {
    const b = blockers(ROWS, DAYS, { [k(han, '2026-11-12')]: '8oo' })
    expect(b).toEqual([
      { key: k(han, '2026-11-12'), text: 'Tổ Hàn · T5: “8oo” không phải số ≥ 0' },
    ])
  })
  it('changedDays: chỉ ngày ≥ hôm nay có ô đổi', () => {
    const initial = initialDraft([
      { team_department_id: 'tp', stage: 'phoi', date: '2026-11-09', qty: 100 },
      { team_department_id: 'tp', stage: 'phoi', date: '2026-11-12', qty: 100 },
    ])
    const draft = {
      ...initial,
      [k(phoi, '2026-11-09')]: '',
      [k(phoi, '2026-11-12')]: '150',
      [k(han, '2026-11-14')]: '0',
    }
    expect(changedDays(ROWS, DAYS, TODAY, draft, initial)).toEqual([
      '2026-11-12',
      '2026-11-14',
    ])
  })
  it('payload một ngày: ô có số của hàng bày + cặp đã lưu không bày', () => {
    const saved = [
      { team_department_id: 'tx', stage: 'may', date: '2026-11-12', qty: 40 },
      { team_department_id: 'tx', stage: 'may', date: '2026-11-13', qty: 41 },
    ]
    const p = payloadForDay(
      '2026-11-12',
      ROWS,
      { [k(phoi, '2026-11-12')]: '1.500', [k(han, '2026-11-12')]: '' },
      saved,
    )
    expect(p).toEqual([
      { team_department_id: 'tp', stage: 'phoi', qty: 1500 },
      { team_department_id: 'tx', stage: 'may', qty: 40 },
    ])
  })
})

describe('→ tuần + dán', () => {
  it('chép ô đầu có số sang ngày trống còn lại, không đè, không lùi quá khứ', () => {
    const d = fillWeek(phoi, DAYS, TODAY, {
      [k(phoi, '2026-11-12')]: '200',
      [k(phoi, '2026-11-14')]: '0',
    })
    expect(d[k(phoi, '2026-11-11')]).toBe('200')
    expect(d[k(phoi, '2026-11-13')]).toBe('200')
    expect(d[k(phoi, '2026-11-14')]).toBe('0')
    expect(d[k(phoi, '2026-11-15')]).toBe('200')
    expect(d[k(phoi, '2026-11-10')]).toBeUndefined()
    expect(fillWeek(han, DAYS, TODAY, {})).toEqual({})
  })
  it('dán vùng từ ô, bỏ qua ngày đã qua', () => {
    const d = applyPaste(
      [
        ['10', '20'],
        ['30', '40'],
      ],
      0,
      1,
      ROWS,
      DAYS,
      TODAY,
      {},
    )
    expect(d[k(phoi, '2026-11-10')]).toBeUndefined()
    expect(d[k(phoi, '2026-11-11')]).toBe('20')
    expect(d[k(han, '2026-11-11')]).toBe('40')
  })
})
