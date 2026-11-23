// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { HangCuaDonData } from '../../nhap/tai-hang-cua-don'
import { DonMuaScreen, type PhanLenh } from './DonMuaScreen'

/**
 * KHO · TRANG MỘT ĐƠN (23/11/2026, thay hộp "Hàng của đơn"). Dữ liệu đóng băng
 * PO-2026-0100 lấy từ DB thật 12/10/2026 — cùng ca hộp cũ đã canh.
 */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/warehouse/don-mua/id-PO-2026-0100',
}))
afterEach(cleanup)

const TODAY = '2026-10-12'
const PO100: HangCuaDonData = {
  po: {
    id: 'id-PO-2026-0100',
    code: 'PO-2026-0100',
    status: 'partial',
    supplier_name: 'CÔNG TY TNHH SX & TM DV TÂN THÀNH LONG',
    lsx_code: '09/26-27 - MX',
    extra_lsx: ['10/26-27 - MX'],
    expected_at: '2026-10-12',
    assignee_name: 'Đặng Thị Thanh Nga',
  },
  lines: [
    { id: 'l1', code: 'NK-0143', name: 'Pat nhựa gắn sắt', unit: 'Cái', ordered: 816, received: 816, open: 0, closed_short: false, dots: [1] }, // prettier-ignore
    { id: 'l4', code: 'PKN0404', name: 'Nút chân 30x60x10, nâu', unit: 'Cái', ordered: 500, received: 0, open: 500, closed_short: false, dots: [2] }, // prettier-ignore
  ],
  free_lines: 0,
  shipments: [
    { id: 'dot-1', seq: 1, date: '2026-10-12', status: 'planned', note: null, lines: [{ po_line_id: 'l1', qty: 816 }] }, // prettier-ignore
    { id: 'dot-2', seq: 2, date: '2026-10-22', status: 'planned', note: null, lines: [{ po_line_id: 'l4', qty: 500 }] }, // prettier-ignore
  ],
  issues: [],
  docs: [{ doc_id: 'd99', code: 'PNK-2026-0099', kind: 'receipt', at: '2026-10-06', qty_total: 4969, reversed_by: null }], // prettier-ignore
}

function dung(them: Partial<Parameters<typeof DonMuaScreen>[0]> = {}) {
  render(
    <DonMuaScreen
      data={PO100}
      phan={null}
      lenhLink={null}
      tab="dong"
      today={TODAY}
      canEdit
      {...them}
    />,
  )
}
const pane = () => screen.getByRole('toolbar', { name: 'Thao tác' })
const tab = (ten: RegExp) => fireEvent.click(screen.getByRole('tab', { name: ten }))

describe('Kho · trang một đơn', () => {
  it('Nhận hàng mở đúng đợt kế tiếp (đợt 1 đã nhập đủ trước)', () => {
    dung()
    const nhan = within(pane()).getByRole('link', { name: /Nhận hàng/ })
    expect(nhan.getAttribute('href')).toBe('/warehouse/nhap/id-PO-2026-0100?dot=dot-2')
    expect(screen.getByText('Đợt 2 · 22/10')).toBeTruthy()
    expect(screen.getByText('Về một phần')).toBeTruthy()
  })

  it('tab Đợt giao: đợt 1 "đã nhập đủ trước hạn"; tab Phiếu: ngày theo giờ VN', () => {
    dung()
    tab(/^Đợt giao/)
    expect(screen.getByText('đã nhập đủ trước hạn')).toBeTruthy()
    tab(/^Phiếu nhập/)
    expect(screen.getByRole('link', { name: 'PNK-2026-0099' })).toBeTruthy()
    expect(screen.getByText('06/10')).toBeTruthy()
  })

  it('mở từ trang lệnh: cột phần của lệnh + đường quay về lệnh', () => {
    const phan: PhanLenh = {
      lsx_id: 'l09',
      code: '09/26-27 - MX',
      lenh_chinh: null,
      gop: ['10/26-27 - MX'],
      dong: {
        l1: { dat: 816, ve: 816, chia: false },
        l4: { dat: 200, ve: 0, chia: true },
      },
    }
    dung({ phan, lenhLink: { id: 'l09', code: '09/26-27 - MX' } })
    expect(screen.getByRole('columnheader', { name: 'Phần của 09-MX' })).toBeTruthy()
    expect(screen.getByText('cả dòng')).toBeTruthy()
    expect(screen.getByText(/200 đặt · 0 đã nhận/)).toBeTruthy()
    expect(screen.getByRole('link', { name: '09/26-27 - MX' }).getAttribute('href')).toBe(
      '/warehouse/nhap/theo-lenh/l09',
    )
  })

  it('không có quyền ghi kho: Nhận hàng khoá, nói phòng giữ quyền', () => {
    dung({ canEdit: false })
    const nut = within(pane()).getByRole('button', { name: /Nhận hàng/ })
    expect(nut.getAttribute('aria-disabled')).toBe('true')
    expect(nut.getAttribute('title')).toMatch(/Chỉ phòng Kho/)
  })
})
