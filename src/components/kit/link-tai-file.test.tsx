// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { laTaiFile } from './link-tai-file'
import { Btn } from './Primitives'

/**
 * NÚT TẢI FILE (`/api/…`) LÀ `<a>` THƯỜNG (11/11/2026): qua `next/link` máy chủ
 * dựng file Excel / zip hai lần. Thay `next/link` bằng bản đánh dấu để biết nút
 * nào đi qua nó.
 */
vi.mock('next/link', () => ({
  default: ({
    children,
    ...p
  }: { children: React.ReactNode } & Record<string, unknown>) => (
    <a data-next-link="1" {...p}>
      {children}
    </a>
  ),
}))
afterEach(cleanup)

describe('laTaiFile', () => {
  it('chỉ /api/… là tải file', () => {
    expect(laTaiFile('/api/dept/supply/hop-report')).toBe(true)
    expect(laTaiFile('/mua-hang/don')).toBe(false)
    expect(laTaiFile('/print/lsx/1')).toBe(false)
    expect(laTaiFile('/apis-la-trang')).toBe(false)
  })
})

describe('Btn href', () => {
  it('/api/… → <a> thường, không qua next/link', () => {
    render(<Btn href="/api/dept/supply/hop-report">Excel họp</Btn>)
    const a = screen.getByRole('link', { name: 'Excel họp' })
    expect(a.getAttribute('href')).toBe('/api/dept/supply/hop-report')
    expect(a.hasAttribute('data-next-link')).toBe(false)
  })
  it('trang nội bộ → vẫn next/link', () => {
    render(<Btn href="/mua-hang/don">Đơn mua</Btn>)
    expect(screen.getByRole('link', { name: 'Đơn mua' }).hasAttribute('data-next-link')).toBe(true) // prettier-ignore
  })
})
