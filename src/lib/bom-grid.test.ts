import { describe, it, expect } from 'vitest'
import { buildGridText, cellText, colLetter, GRID_MAX_ROWS_PER_SHEET } from './bom-grid'

describe('colLetter', () => {
  it('đánh chữ cái cột như Excel', () => {
    expect(colLetter(0)).toBe('A')
    expect(colLetter(25)).toBe('Z')
    expect(colLetter(26)).toBe('AA')
    expect(colLetter(27)).toBe('AB')
  })
})

describe('cellText', () => {
  it('giữ số nguyên dạng, ngày về ISO', () => {
    expect(cellText(1.4)).toBe('1.4')
    expect(cellText(new Date('2026-08-17T00:00:00Z'))).toBe('2026-08-17')
  })

  it('đổi dấu | trong nội dung để không phá cột', () => {
    expect(cellText('Nhôm | sơn')).toBe('Nhôm / sơn')
  })

  it('gộp xuống dòng và khoảng trắng thừa', () => {
    expect(cellText('Chân\ntrước   sau')).toBe('Chân trước sau')
  })

  it('ô rỗng và NaN ra chuỗi rỗng', () => {
    expect(cellText(null)).toBe('')
    expect(cellText(undefined)).toBe('')
    expect(cellText(NaN)).toBe('')
  })
})

describe('buildGridText', () => {
  it('đánh số dòng THẬT và bỏ dòng trống', () => {
    const g = buildGridText([{ name: 'BOM', rows: [['Stt', 'Tên'], [], ['1', 'Chân']] }])
    expect(g.text).toContain('1 | Stt | Tên')
    expect(g.text).toContain('3 | 1 | Chân')
    // Dòng 2 trống bị lược, nhưng dòng 3 vẫn mang số 3.
    expect(g.text).not.toContain('2 |')
  })

  it('giữ ô trống Ở GIỮA, chỉ cắt ô trống ở đuôi', () => {
    const g = buildGridText([{ name: 'S', rows: [['a', null, 'c', null, null]] }])
    expect(g.text).toContain('1 | a |  | c')
    expect(g.text.trimEnd().endsWith('c')).toBe(true)
  })

  it('bỏ hẳn sheet không có ô nào', () => {
    const g = buildGridText([
      { name: 'Trống', rows: [[], [null, null]] },
      { name: 'Có', rows: [['x']] },
    ])
    expect(g.sheets.map((s) => s.name)).toEqual(['Có'])
    expect(g.text).not.toContain('Trống')
  })

  it('báo rõ khi cắt bớt dòng, không nuốt im lặng', () => {
    const rows = Array.from({ length: GRID_MAX_ROWS_PER_SHEET + 5 }, (_, i) => [`r${i}`])
    const g = buildGridText([{ name: 'Dài', rows }])
    expect(g.truncated).toHaveLength(1)
    expect(g.truncated[0]).toContain(`${GRID_MAX_ROWS_PER_SHEET}/${rows.length}`)
  })

  it('không cắt gì thì truncated rỗng', () => {
    const g = buildGridText([{ name: 'S', rows: [['a']] }])
    expect(g.truncated).toEqual([])
    expect(g.sheets).toEqual([{ name: 'S', emitted: 1 }])
  })
})
