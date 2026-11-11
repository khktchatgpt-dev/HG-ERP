// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { TOI_DA_MS, TRE_HIEN_MS, ThanhTaiTrang, diTrangToi } from './ThanhTaiTrang'

/**
 * THANH TẢI TRANG (11/11/2026, chủ dự án: "chuyển trang hầu hết không có
 * loading, người dùng nhấn nhiều lần").
 */

const nav = { pathname: '/mua-hang/don', search: '' }
vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
}))

const O = { button: 0, mod: false, target: '', download: false }
const DANG = new URL('https://erp.test/mua-hang/don?trang=2')

describe('diTrangToi — cú bấm nào là đi trang', () => {
  it('link nội bộ sang trang khác / đổi bộ lọc: có', () => {
    expect(diTrangToi('/mua-hang/yeu-cau', O, DANG)).toBe(true)
    expect(diTrangToi('/mua-hang/don?trang=3', O, DANG)).toBe(true)
    expect(diTrangToi('https://erp.test/mua-hang/ncc', O, DANG)).toBe(true)
  })
  it('không có điều hướng để chờ: không', () => {
    expect(diTrangToi('/mua-hang/don?trang=2', O, DANG)).toBe(false) // đúng URL đang đứng
    expect(diTrangToi('/mua-hang/don?trang=2#dong-3', O, DANG)).toBe(false) // chỉ khác #
    expect(diTrangToi(null, O, DANG)).toBe(false)
  })
  it('tải file / phiếu in / ngoài miền / tab mới: không', () => {
    expect(diTrangToi('/api/dept/supply/hop-report', O, DANG)).toBe(false)
    expect(diTrangToi('/print/lsx/abc', O, DANG)).toBe(false)
    expect(diTrangToi('https://khac.test/x', O, DANG)).toBe(false)
    expect(diTrangToi('/mua-hang/ncc', { ...O, target: '_blank' }, DANG)).toBe(false)
    expect(diTrangToi('/mua-hang/ncc', { ...O, mod: true }, DANG)).toBe(false)
    expect(diTrangToi('/mua-hang/ncc', { ...O, button: 1 }, DANG)).toBe(false)
    expect(diTrangToi('/mua-hang/ncc', { ...O, download: true }, DANG)).toBe(false)
  })
})

/** Bấm một link thật trong DOM — chặn điều hướng mặc định của happy-dom sau khi thanh đã nghe. */
function bam(href: string, init: MouseEventInit = {}) {
  const a = document.createElement('a')
  a.setAttribute('href', href)
  a.addEventListener('click', (e) => e.preventDefault())
  document.body.appendChild(a)
  act(() => {
    a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init })) // prettier-ignore
  })
  a.remove()
}
const pha = () => document.querySelector<HTMLElement>('.hg-ttt')!.dataset.pha

beforeEach(() => {
  vi.useFakeTimers()
  nav.pathname = '/mua-hang/don'
  nav.search = ''
  window.history.replaceState(null, '', '/mua-hang/don')
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('ThanhTaiTrang', () => {
  it('bấm link → sau một nhịp ngắn thanh chạy; URL đổi → vụt tới đích rồi tắt', () => {
    const { rerender } = render(<ThanhTaiTrang />)
    expect(pha()).toBe('tat')
    bam('/mua-hang/yeu-cau')
    expect(pha()).toBe('tat') // chưa đủ TRE_HIEN_MS — điều hướng tức thì không nháy
    act(() => vi.advanceTimersByTime(TRE_HIEN_MS + 1))
    expect(pha()).toBe('chay')
    expect(document.querySelector('[role="status"]')!.textContent).toBe('Đang tải trang…')

    nav.pathname = '/mua-hang/yeu-cau'
    rerender(<ThanhTaiTrang />)
    expect(pha()).toBe('xong')
    act(() => vi.advanceTimersByTime(500))
    expect(pha()).toBe('tat')
    expect(document.querySelector('[role="status"]')!.textContent).toBe('')
  })

  it('điều hướng xong trước nhịp chờ thì thanh không hiện chút nào', () => {
    const { rerender } = render(<ThanhTaiTrang />)
    bam('/mua-hang/ncc')
    nav.pathname = '/mua-hang/ncc'
    rerender(<ThanhTaiTrang />)
    act(() => vi.advanceTimersByTime(TRE_HIEN_MS + 1))
    expect(pha()).toBe('tat')
  })

  it('nút tải file (/api/…) không làm thanh chạy — URL không đổi, thanh sẽ treo', () => {
    render(<ThanhTaiTrang />)
    bam('/api/dept/supply/hop-report')
    act(() => vi.advanceTimersByTime(TRE_HIEN_MS + 1))
    expect(pha()).toBe('tat')
  })

  it('URL không bao giờ đổi (điều hướng hỏng) → chốt an toàn tự tắt', () => {
    render(<ThanhTaiTrang />)
    bam('/mua-hang/vat-tu')
    act(() => vi.advanceTimersByTime(TRE_HIEN_MS + 1))
    expect(pha()).toBe('chay')
    act(() => vi.advanceTimersByTime(TOI_DA_MS + 500))
    expect(pha()).toBe('tat')
  })
})
