import { describe, it, expect } from 'vitest'
import {
  waitingDays,
  waitingTone,
  isBulkApprovable,
  comparePending,
  matchesFilter,
  summarizeBulk,
} from './approval-helpers'
import { BIG_APPROVAL_VND } from '@/lib/exec-ops'

const NOW = '2026-07-20T10:00:00Z'

describe('waitingDays', () => {
  it('đếm số ngày trọn đã chờ', () => {
    expect(waitingDays('2026-07-20T09:00:00Z', NOW)).toBe(0)
    expect(waitingDays('2026-07-18T10:00:00Z', NOW)).toBe(2)
    expect(waitingDays('2026-07-16T09:00:00Z', NOW)).toBe(4)
  })
  it('created_at ở tương lai → 0 (không âm)', () => {
    expect(waitingDays('2026-07-25T00:00:00Z', NOW)).toBe(0)
  })
  it('ngày không hợp lệ → 0', () => {
    expect(waitingDays('not-a-date', NOW)).toBe(0)
  })
})

describe('waitingTone', () => {
  it('phân ngưỡng gray/amber/red', () => {
    expect(waitingTone(0)).toBe('gray')
    expect(waitingTone(1)).toBe('gray')
    expect(waitingTone(2)).toBe('amber')
    expect(waitingTone(3)).toBe('amber')
    expect(waitingTone(4)).toBe('red')
    expect(waitingTone(10)).toBe('red')
  })
})

describe('isBulkApprovable', () => {
  it('LSX luôn duyệt nhanh được', () => {
    expect(isBulkApprovable({ kind: 'lsx' })).toBe(true)
  })
  it('PO dưới ngưỡng: được; đúng/vượt ngưỡng: bị chặn', () => {
    expect(isBulkApprovable({ kind: 'po', total: BIG_APPROVAL_VND - 1 })).toBe(true)
    expect(isBulkApprovable({ kind: 'po', total: BIG_APPROVAL_VND })).toBe(false)
    expect(isBulkApprovable({ kind: 'po', total: BIG_APPROVAL_VND + 1 })).toBe(false)
  })
})

describe('comparePending', () => {
  it('PO giá trị lớn lên trước, rồi chờ lâu nhất trước', () => {
    const items = [
      { id: 'a', big: false, created_at: '2026-07-19T00:00:00Z' },
      { id: 'b', big: true, created_at: '2026-07-18T00:00:00Z' },
      { id: 'c', big: false, created_at: '2026-07-10T00:00:00Z' },
      { id: 'd', big: true, created_at: '2026-07-19T00:00:00Z' },
    ]
    const order = [...items].sort(comparePending).map((i) => i.id)
    // big trước (b trước d vì cũ hơn), rồi non-big theo cũ→mới (c trước a)
    expect(order).toEqual(['b', 'd', 'c', 'a'])
  })
})

describe('matchesFilter', () => {
  const lsx = { kind: 'lsx' as const, big: false }
  const po = { kind: 'po' as const, big: false }
  const bigPo = { kind: 'po' as const, big: true }
  it('all khớp mọi thứ', () => {
    expect(matchesFilter(lsx, 'all')).toBe(true)
    expect(matchesFilter(bigPo, 'all')).toBe(true)
  })
  it('lsx / po lọc theo loại', () => {
    expect(matchesFilter(lsx, 'lsx')).toBe(true)
    expect(matchesFilter(po, 'lsx')).toBe(false)
    expect(matchesFilter(po, 'po')).toBe(true)
    expect(matchesFilter(lsx, 'po')).toBe(false)
  })
  it('big chỉ khớp PO giá trị lớn', () => {
    expect(matchesFilter(bigPo, 'big')).toBe(true)
    expect(matchesFilter(po, 'big')).toBe(false)
    expect(matchesFilter(lsx, 'big')).toBe(false)
  })
})

describe('summarizeBulk', () => {
  it('đếm LSX/PO và cộng tổng tiền (chỉ PO)', () => {
    const r = summarizeBulk([
      { kind: 'lsx' },
      { kind: 'po', total: 1_000_000 },
      { kind: 'po', total: 2_500_000 },
      { kind: 'lsx' },
    ])
    expect(r).toEqual({ lsx: 2, po: 2, total: 3_500_000 })
  })
  it('rỗng → 0 hết', () => {
    expect(summarizeBulk([])).toEqual({ lsx: 0, po: 0, total: 0 })
  })
})
