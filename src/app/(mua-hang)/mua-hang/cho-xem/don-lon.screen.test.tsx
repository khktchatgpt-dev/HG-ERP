// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import type { HopXem, XemDon } from '@/lib/cho-xem'
import { a11yViolations } from '@/test/a11y'
import { ChoXemScreen } from './ChoXemScreen'

/**
 * ĐƠN GIÁ TRỊ LỚN TRONG HỘP "CHỜ TÔI XEM" (10/11/2026). PO-2026-0254 (133,2 tr gồm
 * VAT, ngưỡng 50 tr) đúng luật Q2 không có ô tích — nhưng ô để TRỐNG không một chữ,
 * chủ dự án tưởng màn lỗi: "không thấy ô tích chọn để nhấn gửi". Nay ô đó là nút
 * chữ "xem", đầu nhóm nói vì sao, và ô trống của dòng khác không nuốt cú bấm.
 */

const api = vi.fn()
vi.mock('@/lib/api', async (orig) => ({
  ...(await orig<typeof import('@/lib/api')>()),
  api: (...a: unknown[]) => api(...a),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/mua-hang/cho-xem',
}))

const AT = '2026-11-10T05:30:00.000Z'
const don = (p: Partial<XemDon>): XemDon => ({
  id: 'x',
  code: 'PO-X',
  href: '/mua-hang/don/x',
  ncc: 'NCC',
  ncc_day_du: 'CÔNG TY NCC',
  loai: 'Phụ kiện',
  materials: [],
  lsx: '02/26-27 - ROSCO',
  lenh_xuat: '2027-03-17',
  ngoai_lenh: null,
  expected_at: '2026-11-12',
  owner_id: 'huy',
  owner_name: 'Nguyễn Đình Huy',
  lap_at: '2026-11-10T03:30:00.000Z',
  sua_at: '2026-11-10T05:27:00.000Z',
  hop_dong: null,
  ghi_chu: null,
  ncc_da_dat: 0,
  currency: 'VND',
  tien_hang: 0,
  vat_rate: 8,
  vat: 0,
  value: 0,
  big: false,
  submitted_at: '2026-11-10T05:27:00.000Z',
  thanh_toan: null,
  mark: null,
  nhap: true,
  chan: null,
  tra_lai: null,
  dong: [],
  ...p,
})

const LON = don({
  id: 'po-254',
  code: 'PO-2026-0254',
  href: '/mua-hang/don/po-254',
  ncc: 'THANH THUÝ',
  ncc_day_du: 'CÔNG TY TNHH TM VÀ DỊCH VỤ TỔNG HỢP THANH THUÝ',
  materials: ['Tấm DURAflex Low Carbon 20mm'],
  tien_hang: 123_360_000,
  vat: 9_868_800,
  value: 133_228_800,
  big: true,
})
const NHO = don({
  id: 'po-252',
  code: 'PO-2026-0252',
  href: '/mua-hang/don/po-252',
  owner_name: 'Nguyễn Thị Nga',
  tien_hang: 12_985_440,
  vat: 1_038_835,
  value: 14_024_275,
})
const THIEU = don({
  id: 'po-158',
  code: 'PO-2026-0158',
  href: '/mua-hang/don/po-158',
  expected_at: null,
  chan: 'Chưa có hẹn giao',
  value: 22_236_984,
})

const box = (items: XemDon[]): HopXem => ({
  items,
  duyet_thay: [],
  nguong: { VND: 50_000_000 },
  at: AT,
})

// Mã đơn hiện cả ở lưới (link) lẫn khung chi tiết — lấy đúng dòng lưới qua link.
const dongCua = (code: string) => screen.getByRole('link', { name: code }).closest('tr')!

beforeEach(() => api.mockReset().mockResolvedValue({}))
afterEach(cleanup)

describe('đơn giá trị lớn trong hộp Chờ tôi xem', () => {
  it('đơn lớn: không ô tích nhưng có nút "xem" nói bước kế; đơn nhỏ vẫn tích được', () => {
    render(<ChoXemScreen box={box([NHO, LON, THIEU])} />)
    const lon = dongCua('PO-2026-0254')
    expect(within(lon).queryByRole('checkbox')).toBeNull()
    const nut = within(lon).getByRole('button', { name: /giá trị lớn, không tích được/ })
    expect(nut.textContent).toBe('xem')
    expect(nut.getAttribute('title')).toMatch(/Đã xem — trình GĐ/)
    expect(
      within(dongCua('PO-2026-0252')).getByRole('checkbox', {
        name: 'Tích PO-2026-0252',
      }),
    ).toBeTruthy()
  })

  it('đầu nhóm nói con số ngưỡng và cách trình — không bắt người dùng đoán', () => {
    render(<ChoXemScreen box={box([NHO, LON])} />)
    expect(
      screen.getByText(
        /1 đơn từ 50 triệu\s+không tích được — bấm dòng rồi “Đã xem — trình GĐ”/,
      ),
    ).toBeTruthy()
  })

  it('bấm "xem" chọn đơn lớn, rồi "Đã xem — trình GĐ" trình đúng đơn đó', async () => {
    render(<ChoXemScreen box={box([NHO, LON])} />)
    // mặc định chọn sẵn đơn làm được đầu tiên (0252) — bấm "xem" đổi sang 0254
    expect(screen.getByRole('region', { name: 'Chi tiết PO-2026-0252' })).toBeTruthy()
    fireEvent.click(
      within(dongCua('PO-2026-0254')).getByRole('button', { name: /giá trị lớn/ }),
    )
    expect(screen.getByRole('region', { name: 'Chi tiết PO-2026-0254' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Đã xem — trình GĐ' }))
    await waitFor(() => expect(api).toHaveBeenCalledTimes(1))
    expect(api).toHaveBeenCalledWith('/api/dept/supply/pos/po-254/review', {
      method: 'POST',
      body: { note: null, tu: 'draft' },
    })
  })

  it('ô đầu dòng để trống (nháp còn thiếu) không nuốt cú bấm — bấm vẫn chọn dòng', () => {
    render(<ChoXemScreen box={box([NHO, THIEU])} />)
    const o = dongCua('PO-2026-0158').querySelector('td')!
    expect(o.childElementCount).toBe(0)
    fireEvent.click(o)
    expect(screen.getByRole('region', { name: 'Chi tiết PO-2026-0158' })).toBeTruthy()
  })

  // Chỉ soi LƯỚI (phần sửa 10/11). Khung chi tiết còn lỗi `heading-order` có từ
  // trước (h4 ngay dưới h1) — ngoài phạm vi lần sửa này.
  it('lưới không lỗi a11y (axe)', async () => {
    const { container } = render(<ChoXemScreen box={box([NHO, LON, THIEU])} />)
    expect(await a11yViolations(container.querySelector('.cx-luoi')!)).toEqual([])
  })
})
