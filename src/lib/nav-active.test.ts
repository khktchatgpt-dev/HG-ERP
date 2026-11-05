import { describe, expect, it } from 'vitest'
import { navActive } from './nav-active'

const CUA_TOI = '/phan-cong-viec?muc=cua-toi'
const GIAO = '/phan-cong-viec?muc=giao'

describe('mục menu đang sáng (B2, 05/11/2026)', () => {
  it('href thường: tiền tố hoặc chính xác như cũ', () => {
    expect(
      navActive({ pathname: '/mua-hang/don/abc', muc: null, href: '/mua-hang/don' }),
    ).toBe(true)
    expect(
      navActive({ pathname: '/mua-hang/don', muc: null, href: '/mua-hang', exact: true }),
    ).toBe(false)
    expect(navActive({ pathname: '/', muc: null, href: '/' })).toBe(true)
    expect(navActive({ pathname: '/mua-hang', muc: null, href: '/' })).toBe(false)
  })

  it('hai mục cùng đường dẫn: chỉ mục có muc trùng URL sáng', () => {
    expect(navActive({ pathname: '/phan-cong-viec', muc: 'giao', href: GIAO })).toBe(true)
    expect(navActive({ pathname: '/phan-cong-viec', muc: 'giao', href: CUA_TOI })).toBe(
      false,
    )
    expect(
      navActive({ pathname: '/phan-cong-viec', muc: 'cua-toi', href: CUA_TOI }),
    ).toBe(true)
  })

  it('URL không có muc (vào từ chuông ?viec=): mục defaultTab sáng, mục kia không', () => {
    expect(
      navActive({ pathname: '/phan-cong-viec', muc: null, href: GIAO, defaultTab: true }),
    ).toBe(true)
    expect(navActive({ pathname: '/phan-cong-viec', muc: null, href: CUA_TOI })).toBe(
      false,
    )
  })

  it('đường dẫn khác thì không sáng dù muc trùng', () => {
    expect(
      navActive({ pathname: '/mua-hang', muc: 'giao', href: GIAO, defaultTab: true }),
    ).toBe(false)
  })
})
