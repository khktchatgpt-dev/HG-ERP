import { describe, expect, it } from 'vitest'
import {
  ADJ_CAUSE_KEYS,
  causeBlock,
  causeLabel,
  causeNeedsLsx,
  causeShowsLsx,
  defaultLsxPick,
  linkedLsxIds,
} from './po-adjust-cause'
import { readFileSync } from 'node:fs'

describe('po-adjust-cause', () => {
  it('nhãn: khoá lạ / null là "Chưa phân loại"', () => {
    expect(causeLabel('khach_doi')).toBe('Khách đổi đơn')
    expect(causeLabel(null)).toBe('Chưa phân loại')
    expect(causeLabel('xyz')).toBe('Chưa phân loại')
  })

  it('chỉ "Khách đổi đơn" bắt lệnh; Kỹ thuật bày ô lệnh nhưng không bắt', () => {
    expect(causeNeedsLsx('khach_doi')).toBe(true)
    expect(causeNeedsLsx('ky_thuat')).toBe(false)
    expect(causeShowsLsx('ky_thuat')).toBe(true)
    expect(causeShowsLsx('ncc_doi')).toBe(false)
  })

  it('lệnh gắn đơn: chính → gộp thêm → chia dòng, không trùng', () => {
    expect(linkedLsxIds('A', ['B', 'A'], ['C', 'B'])).toEqual(['A', 'B', 'C'])
    expect(linkedLsxIds(undefined, [], ['C', 'C'])).toEqual(['C'])
    expect(linkedLsxIds(null, [], [])).toEqual([])
  })

  it('chọn sẵn chỉ khi đơn gắn đúng một lệnh', () => {
    expect(defaultLsxPick(['A'])).toEqual(['A'])
    expect(defaultLsxPick(['A', 'B'])).toEqual([])
    expect(defaultLsxPick([])).toEqual([])
  })

  it('câu chặn chỉ vào ô đầu tiên còn thiếu', () => {
    expect(causeBlock({ cause: null, lsxIds: [], note: '' })?.field).toBe('cause')
    expect(
      causeBlock({ cause: 'khach_doi', lsxIds: [], note: 'giảm 86 bộ' })?.field,
    ).toBe('lsx')
    expect(causeBlock({ cause: 'khach_doi', lsxIds: ['A'], note: 'abc' })?.field).toBe(
      'note',
    )
    expect(
      causeBlock({ cause: 'khach_doi', lsxIds: ['A'], note: 'giảm 86 bộ' }),
    ).toBeNull()
    expect(causeBlock({ cause: 'ncc_doi', lsxIds: [], note: 'tăng giá mút' })).toBeNull()
  })

  it('danh sách khoá khớp check constraint của migration 0227', () => {
    const sql = readFileSync(
      'supabase/migrations/0227_po_dieu_chinh_nguyen_nhan.sql',
      'utf8',
    )
    const m = sql.match(/cause in \(([^)]*)\)/)
    const keys = m![1].split(',').map((s) => s.trim().replace(/'/g, ''))
    expect(keys).toEqual([...ADJ_CAUSE_KEYS])
  })
})
