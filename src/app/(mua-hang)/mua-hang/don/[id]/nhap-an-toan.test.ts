// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import type { PoHeader } from '@/app/(mua-hang)/mua-hang/don/_lib/po-draft'
import type { Line } from '@/app/(mua-hang)/mua-hang/don/_lib/po-line'
import {
  DRAFT_MAX,
  DRAFT_TTL_MS,
  draftLabel,
  isLeavingClick,
  readDrafts,
  removeDraft,
  upsertDraft,
  type DraftSnap,
} from './nhap-an-toan'

const K = 'hg.mua-hang.don.nhap:moi:-:-:-'
const snap = (...codes: string[]): DraftSnap => ({
  header: { supplierId: 'ncc' } as unknown as PoHeader,
  lines: codes.map((code) => ({ code, name: code }) as unknown as Line),
  shipCols: [],
})
const at = (min: number) => new Date(Date.UTC(2026, 9, 2, 8, min))

beforeEach(() => localStorage.clear())

describe('nháp đơn mua — nhiều phiên một khoá (02/10/2026)', () => {
  it('hai phiên ghi hai bản riêng, không đè nhau; mới nhất trước', () => {
    upsertDraft(K, 'A', snap('VT-1'), at(1))
    upsertDraft(K, 'B', snap('VT-2', 'VT-3'), at(2))
    const ds = readDrafts(K, at(3).getTime())
    expect(ds.map((d) => [d.id, d.lines.length])).toEqual([
      ['B', 2],
      ['A', 1],
    ])
  })

  it('cùng phiên ghi lại thì THAY bản cũ của chính nó', () => {
    upsertDraft(K, 'A', snap('VT-1'), at(1))
    upsertDraft(K, 'A', snap('VT-1', 'VT-9'), at(2))
    expect(readDrafts(K, at(3).getTime())).toHaveLength(1)
    expect(readDrafts(K, at(3).getTime())[0].lines).toHaveLength(2)
  })

  it('đơn chưa có dòng không giữ; xoá trắng dòng là bỏ bản của phiên', () => {
    upsertDraft(K, 'A', snap(), at(1))
    expect(readDrafts(K)).toEqual([])
    upsertDraft(K, 'A', snap('VT-1'), at(1))
    upsertDraft(K, 'A', snap(), at(2))
    expect(readDrafts(K, at(3).getTime())).toEqual([])
  })

  it(`giữ tối đa ${DRAFT_MAX} bản, rơi bản cũ nhất`, () => {
    for (let i = 0; i < DRAFT_MAX + 2; i++) upsertDraft(K, `S${i}`, snap('VT'), at(i))
    const ids = readDrafts(K, at(30).getTime()).map((d) => d.id)
    expect(ids).toHaveLength(DRAFT_MAX)
    expect(ids).not.toContain('S0')
    expect(ids[0]).toBe(`S${DRAFT_MAX + 1}`)
  })

  it('quá hạn thì không mời khôi phục', () => {
    upsertDraft(K, 'A', snap('VT-1'), at(0))
    expect(readDrafts(K, at(0).getTime() + DRAFT_TTL_MS + 1)).toEqual([])
  })

  it('removeDraft chỉ xoá đúng phiên', () => {
    upsertDraft(K, 'A', snap('VT-1'), at(1))
    upsertDraft(K, 'B', snap('VT-2'), at(2))
    removeDraft(K, 'A')
    expect(readDrafts(K, at(3).getTime()).map((d) => d.id)).toEqual(['B'])
  })

  it('đọc được nháp bản 1 (một object trơn) — không mất nháp đang có lúc lên bản', () => {
    localStorage.setItem(K, JSON.stringify({ ...snap('VT-1'), at: at(1).toISOString() }))
    const ds = readDrafts(K, at(2).getTime())
    expect(ds).toHaveLength(1)
    expect(ds[0].id).toBe('ban-cu')
    // Phiên mới ghi thêm thì bản cũ vẫn còn.
    upsertDraft(K, 'N', snap('VT-2'), at(3))
    expect(readDrafts(K, at(4).getTime()).map((d) => d.id)).toEqual(['N', 'ban-cu'])
  })

  it('nhãn bản nháp đủ nhận ra đơn nào', () => {
    upsertDraft(K, 'A', snap('VIT0210', 'NH-0569', 'BAO0716'), at(1))
    expect(draftLabel(readDrafts(K, at(2).getTime())[0])).toBe(
      '3 dòng · VIT0210, NH-0569, +1',
    )
  })
})

describe('isLeavingClick — cú bấm nào là rời màn', () => {
  const here = { origin: 'http://x.test', pathname: '/mua-hang/don/moi' }
  const e = { button: 0, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, defaultPrevented: false } // prettier-ignore
  const a = (
    href: string,
    extra: Partial<{ target: string; hasDownload: boolean }> = {},
  ) => ({
    href,
    target: '',
    hasDownload: false,
    ...extra,
  })
  it('link nội bộ sang trang khác → rời', () => {
    expect(isLeavingClick(e, a('/mua-hang/don'), here)).toBe(true)
  })
  it('không phải rời: cùng trang / tab mới / Ctrl+click / tải file / link ngoài', () => {
    expect(isLeavingClick(e, a('/mua-hang/don/moi#dong-hang'), here)).toBe(false)
    expect(isLeavingClick(e, a('/mua-hang/don', { target: '_blank' }), here)).toBe(false)
    expect(isLeavingClick({ ...e, ctrlKey: true }, a('/mua-hang/don'), here)).toBe(false)
    expect(isLeavingClick(e, a('/api/files/1', { hasDownload: true }), here)).toBe(false)
    expect(isLeavingClick(e, a('https://google.com/'), here)).toBe(false)
  })
})
