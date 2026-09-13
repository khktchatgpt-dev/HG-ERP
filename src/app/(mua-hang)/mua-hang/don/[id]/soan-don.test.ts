import { describe, expect, it } from 'vitest'
import {
  columnsToShipments,
  lsxJoinedLabel,
  pendingNeeds,
  planColumnsFromShipments,
  planLeft,
} from './soan-don'

describe('columnsToShipments', () => {
  it('bỏ cột chưa có ngày hoặc không có số, sắp theo ngày', () => {
    const out = columnsToShipments([
      { date: '2026-09-20', qty: { 0: 100, 1: '' } },
      { date: '', qty: { 0: 50 } },
      { date: '2026-09-10', qty: { 1: 30 } },
      { date: '2026-09-25', qty: { 0: 0 } },
    ])
    expect(out).toEqual([
      { expected_date: '2026-09-10', lines: [{ line_index: 1, qty: 30 }] },
      { expected_date: '2026-09-20', lines: [{ line_index: 0, qty: 100 }] },
    ])
  })
})

describe('planColumnsFromShipments', () => {
  it('đợt đã lưu → cột theo chỉ số dòng, bỏ đợt huỷ và dòng không còn trên đơn', () => {
    const cols = planColumnsFromShipments(
      [
        { status: 'planned', expected_date: '2026-09-10', lines: [{ po_line_id: 'b', qty: 40 }, { po_line_id: 'zzz', qty: 9 }] }, // prettier-ignore
        { status: 'cancelled', expected_date: '2026-09-11', lines: [{ po_line_id: 'a', qty: 1 }] }, // prettier-ignore
      ],
      ['a', 'b', undefined],
    )
    expect(cols).toEqual([{ date: '2026-09-10', qty: { 1: 40 } }])
    expect(planLeft(cols, 1, 100)).toBe(60)
    expect(planLeft(cols, 0, 100)).toBe(100)
  })
})

describe('pendingNeeds', () => {
  it('chỉ nhu cầu còn thiếu và chưa có trên đơn', () => {
    const needs = [
      { material_id: 'a', material_code: 'A', material_name: 'A', unit: 'kg', qty_needed: 10, available: 0, suggest: 10 }, // prettier-ignore
      { material_id: 'b', material_code: 'B', material_name: 'B', unit: 'kg', qty_needed: 10, available: 10, suggest: 0 }, // prettier-ignore
      { material_id: 'c', material_code: 'C', material_name: 'C', unit: 'kg', qty_needed: 5, available: 0, suggest: 5 }, // prettier-ignore
    ]
    expect(pendingNeeds(needs, [{ material_id: 'c' }]).map((n) => n.material_id)).toEqual(
      ['a'],
    )
  })
})

describe('lsxJoinedLabel', () => {
  it('lệnh chính trước, phụ sau; không lệnh chính thì null', () => {
    const lsxs = [
      { id: '1', code: 'LSX-04' },
      { id: '2', code: 'LSX-02' },
    ]
    expect(lsxJoinedLabel('1', ['2'], lsxs)).toBe('LSX-04 + LSX-02')
    expect(lsxJoinedLabel('', ['2'], lsxs)).toBeNull()
  })
})
