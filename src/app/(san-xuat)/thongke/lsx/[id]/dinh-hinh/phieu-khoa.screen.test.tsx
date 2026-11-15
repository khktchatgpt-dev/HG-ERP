// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { PhieuKhoa, phieuHref } from './phieu-khoa'

afterEach(cleanup)

/** Câu gỡ khoá bảng chi tiết / lộ trình chỉ thẳng tới phiếu ở Sổ theo ngày (15/11/2026). */
describe('PhieuKhoa', () => {
  it('mỗi mã phiếu là link tới Sổ theo ngày lọc đúng phiếu', () => {
    render(<PhieuKhoa nos={['PBS-2026-0034', 'PBS-2026-0035']} />)
    expect(
      screen.getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')]),
    ).toEqual([
      ['PBS-2026-0034', '/thongke/da-ghi?phieu=PBS-2026-0034'],
      ['PBS-2026-0035', '/thongke/da-ghi?phieu=PBS-2026-0035'],
    ])
  })

  it('nhiều phiếu thì bày 6 mã đầu + đếm phần còn lại', () => {
    const nos = Array.from({ length: 8 }, (_, i) => `PBS-2026-00${40 + i}`)
    const { container } = render(<PhieuKhoa nos={nos} />)
    expect(screen.getAllByRole('link')).toHaveLength(6)
    expect(container.textContent).toContain('… 2 phiếu nữa')
  })

  it('không có phiếu thì không bày gì', () => {
    const { container } = render(<PhieuKhoa nos={[]} />)
    expect(container.textContent).toBe('')
  })

  it('phieuHref mã hoá ký tự lạ', () => {
    expect(phieuHref('PBS 1')).toBe('/thongke/da-ghi?phieu=PBS%201')
  })
})
