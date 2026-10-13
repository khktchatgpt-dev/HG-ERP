// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { ToastProvider } from '@/components/ui/Toast'
import type { SignBox, SignItem } from '@/modules/core/exec/exec.service'
import { ApprovalCenterScreen } from './ApprovalCenterScreen'

/** Hộp ký phân loại (H2, bản vẽ HK-1, Q23–Q28). */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}))
afterEach(cleanup)

const it0 = (x: Partial<SignItem>): SignItem => ({
  kind: 'po',
  id: 'x',
  code: 'X',
  party: 'NCC',
  facts: [],
  currency: 'VND',
  value: 1_000_000,
  waiting_days: 0,
  submitted_at: '2026-10-14T01:00:00Z',
  submitted_by: null,
  warnings: [],
  big: false,
  href: '#',
  owner_id: 'u1',
  owner_name: 'Huy',
  ...x,
})
const po = (x: Partial<SignItem>) =>
  it0({
    po: { supplier_short: 'NCC', loai: null, materials: ['Băng keo'], lsx_code: null, expected_at: '2026-10-20', eta_late_days: 0, lsx_done: false }, // prettier-ignore
    ...x,
  })
const items: SignItem[] = [
  po({ id: 'p1', code: 'PO-2026-0159', value: 233_095_541, big: true, waiting_days: 5 }),
  po({ id: 'p2', code: 'PO-2026-0164', value: 12_184_000 }),
  po({ id: 'p3', code: 'PO-2026-0165', value: 6_000_459 }),
  it0({ kind: 'dnm', id: 'd1', code: 'DNM-2026-0004', party: 'Kho vật tư', value: 1_402_500, waiting_days: 3, dnm: { so_dong: 9, chua_ma: 1, thieu_gia: 0 } }), // prettier-ignore
  it0({ kind: 'lsx', id: 'l1', code: 'LSX 11/26-27 MX', party: 'MERXX', currency: 'USD', value: 50_000 }), // prettier-ignore
]
const box: SignBox = {
  items,
  stats: {
    total: items.length,
    oldest_days: 5,
    value: [{ currency: 'VND', value: 252_682_500 }],
  },
  decided_today: { approved: 0, rejected: 0 },
  thresholds: { VND: 50_000_000, USD: 2_000 },
  emptiness: { pos_total: 10, lsx_total: 5 },
}
const dung = (initialKind: 'all' | 'dnm' = 'all') =>
  render(
    <ToastProvider>
      <ApprovalCenterScreen box={box} initialKind={initialKind} />
    </ToastProvider>,
  )
const nhom = () =>
  screen.getAllByRole('rowheader').map((h) => h.querySelector('.ten')?.textContent ?? '')
const tabs = () => screen.getByRole('tablist', { name: 'Phòng trình phiếu' })

describe('Hộp ký — tab ngang theo phòng', () => {
  it('mặc định mở tab Cung ứng; số trên tab đếm theo phòng', () => {
    dung()
    const tl = tabs()
    expect(within(tl).getByRole('tab', { name: /^Cung ứng/ }).getAttribute('aria-selected')).toBe('true') // prettier-ignore
    const so = (re: RegExp) => within(tl).getByRole('tab', { name: re }).querySelector('.hk-badge')?.textContent // prettier-ignore
    expect([so(/^Cung ứng/), so(/^Kho/), so(/^Sản xuất/), so(/^Bán hàng/), so(/^Tất cả phòng/)]).toEqual(['3', '1', '1', '0', '5']) // prettier-ignore
    expect(nhom()).toEqual(['Đơn mua NCC'])
    // Một loại → tiêu đề cột thật của đơn mua
    expect(screen.getByRole('columnheader', { name: 'Nhà cung cấp' })).toBeTruthy()
    // Phiếu chờ 5 ngày đứng đầu khối
    expect(screen.getAllByRole('link', { name: /^PO-/ })[0].textContent).toBe(
      'PO-2026-0159',
    )
  })

  it('?loai=dnm mở thẳng tab Kho; tab có phiếu gấp báo "cần ký trước"', () => {
    dung('dnm')
    expect(nhom()).toEqual(['Đề nghị mua vật tư'])
    expect(within(tabs()).getByRole('tab', { name: /^Kho/ }).textContent).toContain('1 cần ký trước') // prettier-ignore
  })

  it('tab Tất cả phòng: khối "Cần ký trước" rồi mỗi loại một khối theo thứ tự phòng', () => {
    dung()
    fireEvent.click(within(tabs()).getByRole('tab', { name: /^Tất cả phòng/ }))
    expect(nhom()).toEqual([
      'Cần ký trước',
      'Cung ứng · Đơn mua NCC',
      'Kho · Đề nghị mua vật tư',
      'Sản xuất · Lệnh sản xuất',
    ])
  })

  it('ký nhanh chỉ trong một khối: tích cả khối đơn mua bỏ phiếu giá trị lớn; tích phiếu khác loại thì bỏ chọn cũ', () => {
    dung()
    fireEvent.click(within(tabs()).getByRole('tab', { name: /^Tất cả phòng/ }))
    fireEvent.click(
      screen.getByRole('checkbox', { name: /Chọn 2 phiếu ký nhanh trong khối Cung ứng/ }),
    )
    expect(screen.getByText(/2 đơn mua đã chọn/)).toBeTruthy()
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Chọn phiếu DNM-2026-0004 để ký nhanh' }),
    )
    expect(screen.getByText(/1 đề nghị mua đã chọn/)).toBeTruthy()
  })

  it('lệnh SX không có ô tích — mở ra đọc rồi ký riêng', () => {
    dung()
    fireEvent.click(within(tabs()).getByRole('tab', { name: /^Sản xuất/ }))
    expect(nhom()).toEqual(['Lệnh sản xuất'])
    expect(screen.queryByRole('checkbox', { name: /LSX 11\/26-27 MX/ })).toBeNull()
  })

  it('tab không có phiếu nói rõ còn phiếu ở phòng khác', () => {
    dung()
    fireEvent.click(within(tabs()).getByRole('tab', { name: /^Bán hàng/ }))
    expect(screen.getByText('Phòng Bán hàng không có phiếu chờ bạn ký')).toBeTruthy()
    expect(screen.getByText(/Còn 5 phiếu ở phòng khác/)).toBeTruthy()
  })
})
