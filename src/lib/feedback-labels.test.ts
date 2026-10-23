import { describe, expect, it } from 'vitest'
import {
  columnOf,
  deriveTitle,
  extractMentions,
  guessTopic,
  weekStartOf,
} from './feedback-labels'

describe('guessTopic — đoán chủ đề theo trang đang mở', () => {
  it.each([
    ['/sales/orders/123', 'sales'],
    ['http://localhost:3000/products/abc?tab=bom', 'technical'],
    ['/cat-phoi', 'technical'],
    ['/to/viec', 'production'],
    ['/kehoach-sx', 'production'],
    ['/admin/users', 'system'],
    ['/tai-khoan', 'system'],
    ['/tasks/9', 'tasks'],
    ['/gop-y?id=1', null],
    ['/', null],
    ['', null],
  ])('%s → %s', (url, topic) => expect(guessTopic(url)).toBe(topic))

  it('không nhầm tiền tố: /tools không phải /to', () => {
    expect(guessTopic('/tools')).toBeNull()
  })
})

describe('deriveTitle', () => {
  it('lấy dòng đầu có chữ, cắt 90 ký tự', () => {
    expect(deriveTitle('\n\n  Nút lưu bị mờ  \nchi tiết')).toBe('Nút lưu bị mờ')
    expect(deriveTitle('a'.repeat(120))).toHaveLength(88)
    expect(deriveTitle('   ')).toBe('Góp ý')
  })
})

describe('weekStartOf', () => {
  it('thứ Hai của tuần, kể cả Chủ nhật', () => {
    expect(weekStartOf(new Date(2026, 9, 20))).toBe('2026-10-19') // thứ Ba
    expect(weekStartOf(new Date(2026, 9, 25))).toBe('2026-10-19') // Chủ nhật
    expect(weekStartOf(new Date(2026, 9, 19))).toBe('2026-10-19') // thứ Hai
  })
})

describe('columnOf', () => {
  it('done + đã ổn → cột ảo', () => {
    expect(columnOf({ status: 'done', confirmed_ok_at: null })).toBe('done')
    expect(columnOf({ status: 'done', confirmed_ok_at: '2026-10-20' })).toBe('done_confirmed')
    expect(columnOf({ status: 'new', confirmed_ok_at: '2026-10-20' })).toBe('new')
  })
})

describe('extractMentions', () => {
  const people = [
    { id: 'a', name: 'An' },
    { id: 'b', name: 'Nguyễn Văn An' },
    { id: 'c', name: 'Hoa' },
  ]
  it('khớp không dấu, tên dài trước, không trùng', () => {
    expect(extractMentions('@nguyen van an xem giúp, @Hoa nữa', people)).toEqual(['b', 'c'])
    expect(extractMentions('gửi @An', people)).toEqual(['a'])
    expect(extractMentions('không nhắc ai', people)).toEqual([])
  })
})
