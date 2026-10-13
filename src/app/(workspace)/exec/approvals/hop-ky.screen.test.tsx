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
const dung = () =>
  render(
    <ToastProvider>
      <ApprovalCenterScreen box={box} initialKind="all" />
    </ToastProvider>,
  )

describe('Hộp ký phân loại', () => {
  it('khối "Cần ký trước" trên cùng (chờ ≥ 3 ngày), rồi mỗi loại một khối theo thứ tự phòng', () => {
    dung()
    const nhom = screen.getAllByRole('rowheader').map((h) => h.textContent ?? '')
    expect(nhom.map((t) => t.split(/\d/)[0].trim())).toEqual([
      'Cần ký trước',
      'Mua hàng · Đơn mua NCC',
      'Kho · Đề nghị mua vật tư',
      'Sản xuất · Lệnh sản xuất',
    ])
  })

  it('chip theo phòng đếm đúng và lọc được', () => {
    dung()
    const bar = screen.getByRole('toolbar', { name: 'Lọc phiếu chờ ký' })
    expect(within(bar).getByRole('button', { name: /Mua hàng/ }).textContent).toContain(
      '3',
    )
    fireEvent.click(within(bar).getByRole('button', { name: /^Kho/ }))
    const nhom = screen.getAllByRole('rowheader').map((h) => h.textContent ?? '')
    expect(nhom.some((t) => t.startsWith('Mua hàng'))).toBe(false)
    expect(nhom.some((t) => t.startsWith('Kho · Đề nghị mua'))).toBe(true)
  })

  it('ký nhanh chỉ trong một khối: tích cả khối đơn mua bỏ phiếu giá trị lớn; tích phiếu khác loại thì bỏ chọn cũ', () => {
    dung()
    fireEvent.click(
      screen.getByRole('checkbox', { name: /Chọn 2 phiếu ký nhanh trong khối Mua hàng/ }),
    )
    expect(screen.getByText(/2 đơn mua đã chọn/)).toBeTruthy()
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Chọn phiếu DNM-2026-0004 để ký nhanh' }),
    )
    expect(screen.getByText(/1 đề nghị mua đã chọn/)).toBeTruthy()
  })

  it('lệnh SX không có ô tích — mở ra đọc rồi ký riêng', () => {
    dung()
    expect(screen.queryByRole('checkbox', { name: /LSX 11\/26-27 MX/ })).toBeNull()
  })
})
