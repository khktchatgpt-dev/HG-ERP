import { describe, expect, it } from 'vitest'
import { lichDot, nhanDot, tomTatMa, type DotGiao } from './kho-dot-giao'

const dot = (p: Partial<DotGiao> & { id: string; seq: number }): DotGiao => ({
  expected_date: '2026-09-16',
  status: 'planned',
  lines: [],
  ...p,
})

const DOTS: DotGiao[] = [
  dot({
    id: 'd1',
    seq: 1,
    expected_date: '2026-09-07',
    status: 'received',
    lines: [{ po_line_id: 'A', qty: 100 }],
  }),
  dot({
    id: 'd2',
    seq: 2,
    expected_date: '2026-09-16',
    status: 'arrived',
    lines: [
      { po_line_id: 'B', qty: 50 },
      { po_line_id: 'C', qty: 20 },
    ],
  }),
  dot({
    id: 'd3',
    seq: 3,
    expected_date: '2026-09-19',
    lines: [
      { po_line_id: 'C', qty: 30 },
      { po_line_id: 'D', qty: 10 },
    ],
  }),
  dot({
    id: 'dx',
    seq: 4,
    expected_date: '2026-09-20',
    status: 'cancelled',
    lines: [{ po_line_id: 'E', qty: 1 }],
  }),
]

describe('nhanDot — dòng này thuộc đợt nào', () => {
  const m = nhanDot(['A', 'B', 'C', 'D', 'E', 'F'], DOTS, 'd2')
  it('dòng của đợt đang nhận → this, kèm SL của đợt', () =>
    expect(m.get('B')).toEqual({ kind: 'this', seq: 2, qty: 50 }))
  it('dòng vừa ở đợt này vừa ở đợt sau → this (đợt đang nhận thắng)', () =>
    expect(m.get('C')).toEqual({ kind: 'this', seq: 2, qty: 20 }))
  it('dòng chỉ ở đợt sau → other, kèm ngày và SL', () =>
    expect(m.get('D')).toEqual({
      kind: 'other',
      seq: 3,
      date: '2026-09-19',
      qty: 10,
      arrived: false,
    }))
  it('dòng chỉ ở đợt đã nhận → done', () =>
    expect(m.get('A')).toEqual({ kind: 'done', seq: 1, date: '2026-09-07' }))
  it('đợt huỷ không đếm; dòng không ở đợt nào → none', () => {
    expect(m.get('E')).toEqual({ kind: 'none' })
    expect(m.get('F')).toEqual({ kind: 'none' })
  })
  it('không đi từ đợt nào: dòng ở đợt sống sớm nhất → other', () => {
    const m2 = nhanDot(['C'], DOTS, null)
    expect(m2.get('C')).toEqual({
      kind: 'other',
      seq: 2,
      date: '2026-09-16',
      qty: 20,
      arrived: true,
    })
  })
})

describe('lichDot — lịch cả đơn', () => {
  it('xếp theo số đợt, bỏ đợt huỷ, gắn nhãn theo trạng thái và ngày', () => {
    const l = lichDot(DOTS, 'd2', '2026-09-16')
    expect(l.map((x) => [x.seq, x.label, x.tone, x.current])).toEqual([
      [1, 'đã nhận', 'done', false],
      [2, 'đang nhận', 'primary', true],
      [3, 'sắp tới', 'muted', false],
    ])
  })
  it('không đứng ở đợt nào: đợt quá hẹn nói quá hẹn, xe tới nói xe tới', () => {
    const l = lichDot(
      [
        dot({ id: 'a', seq: 1, expected_date: '2026-09-10' }),
        dot({ id: 'b', seq: 2, expected_date: '2026-09-16', status: 'arrived' }),
      ],
      null,
      '2026-09-16',
    )
    expect(l.map((x) => x.label)).toEqual(['quá hẹn', 'xe đã tới'])
  })
})

describe('tomTatMa', () => {
  it('2 mã đầu + n', () => {
    expect(tomTatMa(['A', 'B', 'C', 'D'])).toBe('A, B +2')
    expect(tomTatMa(['A'])).toBe('A')
    expect(tomTatMa([])).toBe('')
  })
})
