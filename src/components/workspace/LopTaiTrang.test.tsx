// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { baoDangTai } from '@/lib/tai-trang'
import { TOI_DA_MS, TRE_HIEN_MS, LopTaiTrang, diTrangToi } from './LopTaiTrang'

/**
 * LỚP CHỜ TẢI TRANG (11/11/2026, chủ dự án: "cần hiệu ứng loading chứ không phải
 * thanh tiến trình, vì thanh tiến trình người dùng vẫn nhấn tiếp được").
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

/** Bấm một link thật trong DOM — chặn điều hướng mặc định của happy-dom sau khi lớp chờ đã nghe. */
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
const pha = () => document.querySelector<HTMLElement>('.hg-ltt')!.dataset.pha

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

describe('LopTaiTrang', () => {
  it('bấm link → CHẶN BẤM NGAY (cho), sau một nhịp mờ màn + vòng quay (chay); URL đổi → gỡ ngay', () => {
    const { rerender } = render(<LopTaiTrang />)
    expect(pha()).toBe('tat')
    bam('/mua-hang/yeu-cau')
    expect(pha()).toBe('cho') // lớp trong suốt đã phủ — cú bấm thứ hai không tới link
    act(() => vi.advanceTimersByTime(TRE_HIEN_MS + 1))
    expect(pha()).toBe('chay')
    expect(document.querySelector('[role="status"]')!.textContent).toBe('Đang tải trang…')

    nav.pathname = '/mua-hang/yeu-cau'
    rerender(<LopTaiTrang />)
    expect(pha()).toBe('tat')
    expect(document.querySelector('[role="status"]')!.textContent).toBe('')
  })

  it('điều hướng xong trước nhịp chờ thì không mờ màn chút nào', () => {
    const { rerender } = render(<LopTaiTrang />)
    bam('/mua-hang/ncc')
    nav.pathname = '/mua-hang/ncc'
    rerender(<LopTaiTrang />)
    act(() => vi.advanceTimersByTime(TRE_HIEN_MS + 1))
    expect(pha()).toBe('tat')
  })

  it('nút tải file (/api/…) không phủ lớp chờ — URL không đổi, lớp chờ sẽ treo', () => {
    render(<LopTaiTrang />)
    bam('/api/dept/supply/hop-report')
    expect(pha()).toBe('tat')
  })

  it('URL không bao giờ đổi (điều hướng hỏng) → chốt an toàn tự gỡ, không giam người dùng', () => {
    render(<LopTaiTrang />)
    bam('/mua-hang/vat-tu')
    act(() => vi.advanceTimersByTime(TRE_HIEN_MS + 1))
    expect(pha()).toBe('chay')
    act(() => vi.advanceTimersByTime(TOI_DA_MS))
    expect(pha()).toBe('tat')
  })

  it('router.push trong mã (useRouterBao → baoDangTai) cũng phủ lớp chờ, đổi ?… cũng tính', () => {
    const { rerender } = render(<LopTaiTrang />)
    act(() => baoDangTai('/mua-hang/don?trang=2'))
    expect(pha()).toBe('cho')
    act(() => vi.advanceTimersByTime(TRE_HIEN_MS + 1))
    expect(pha()).toBe('chay')
    nav.search = 'trang=2'
    rerender(<LopTaiTrang />)
    expect(pha()).toBe('tat')
  })

  it('báo đi tới đúng URL đang đứng: không phủ (không có gì để chờ)', () => {
    render(<LopTaiTrang />)
    act(() => baoDangTai('/mua-hang/don'))
    expect(pha()).toBe('tat')
  })
})
