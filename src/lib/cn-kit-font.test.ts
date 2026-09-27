import { describe, expect, it } from 'vitest'
import { cn } from './utils'

/**
 * `cn` GIỮ cỡ chữ kit khi đi cùng lớp màu (28/09/2026). Trước khi khai báo nhóm
 * `font-size` cho tailwind-merge, `cn('text-k-sm text-[var(--ink-3)]')` xoá mất
 * `text-k-sm` — mọi ô `Cell muted`, nhãn nhóm, chữ phụ rơi về cỡ nền.
 */
describe('cn — thang cỡ chữ text-k-* là CỠ CHỮ, không phải màu', () => {
  it('giữ cỡ chữ khi có lớp màu token', () => {
    expect(cn('text-k-sm text-[var(--ink-3)]')).toBe('text-k-sm text-[var(--ink-3)]')
    expect(cn('text-k-label font-semibold', 'text-[var(--stop)]')).toContain('text-k-label')
  })
  it('hai cỡ chữ kit thì cái sau thắng; cỡ chữ Tailwind thường cũng bị đè đúng', () => {
    expect(cn('text-k-sm', 'text-k-label')).toBe('text-k-label')
    expect(cn('text-sm', 'text-k-body')).toBe('text-k-body')
  })
  it('hai màu thì cái sau thắng — không đụng cỡ chữ', () => {
    expect(cn('text-k-sm text-[var(--ink-3)]', 'text-[var(--stop)]')).toBe(
      'text-k-sm text-[var(--stop)]',
    )
  })
})
