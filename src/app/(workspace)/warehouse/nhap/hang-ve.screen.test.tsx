// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { ToastProvider } from '@/components/kit'
import type { HangVeRow } from '@/lib/kho-hang-ve'
import { HangVeScreen } from './HangVeScreen'
import type { HangCuaDonData } from './tai-hang-cua-don'

/**
 * KHO › HÀNG VỀ (Kho đợt 2 · Bước 1, bản vẽ duyệt 12/10/2026) — dựng màn từ dữ
 * liệu đóng băng lấy từ DB thật ngày 12/10/2026 (5 trong 29 đơn đang về + hộp
 * PO-2026-0100), soi đúng những điều bản vẽ hứa.
 */

const replace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/warehouse/nhap',
}))
afterEach(() => {
  cleanup()
  replace.mockReset()
})

const TODAY = '2026-10-12'
const r = (p: Partial<HangVeRow> & Pick<HangVeRow, 'po_code' | 'bucket'>): HangVeRow => ({
  po_id: 'id-' + p.po_code,
  supplier_name: 'CÔNG TY TNHH NCC',
  lsx_code: '02/26-27 - ROSCO',
  extra_lsx: [],
  template: 'accessory',
  expected_at: null,
  lines_done: 0,
  lines_total: 1,
  owner_name: 'Đặng Thị Thanh Nga',
  dot: null,
  ...p,
})
const ROWS: HangVeRow[] = [
  r({ po_code: 'ĐH02HGTĐ', bucket: 'overdue', expected_at: '2026-09-05', template: 'wood', lines_total: 0, lsx_code: '01/26-27 - YOTRIO' }), // prettier-ignore
  r({ po_code: 'PO-2026-0108', bucket: 'overdue', expected_at: '2026-10-02' }),
  r({
    po_code: 'PO-2026-0100',
    bucket: 'today',
    expected_at: '2026-10-12',
    lsx_code: '09/26-27 - MX',
    extra_lsx: ['10/26-27 - MX'],
    lines_done: 6,
    lines_total: 7,
    dot: { so_dot: 2, ke_tiep: { id: 'dot-2', seq: 2, date: '2026-10-22', arrived: false }, da_nhap_truoc: [1] }, // prettier-ignore
  }),
  r({ po_code: 'PO-2026-0115', bucket: 'week', expected_at: '2026-10-13', template: 'aluminium', lsx_code: '01/26-27 - GIGA' }), // prettier-ignore
  r({ po_code: 'PO-2026-0085', bucket: 'later', expected_at: '2610-10-03', lines_done: 2, lines_total: 3 }), // prettier-ignore
]

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
  docs: [{ doc_id: 'd99', code: 'PNK-2026-0099', kind: 'receipt', at: '2026-10-06', qty_total: 4969, reversed_by: null }], // prettier-ignore
}

function dung(them: Partial<Parameters<typeof HangVeScreen>[0]> = {}) {
  render(
    <ToastProvider>
      <HangVeScreen
        rows={ROWS}
        today={TODAY}
        canEdit
        truncatedAt={null}
        hangCuaDon={null}
        {...them}
      />
    </ToastProvider>,
  )
}
const dongCua = (ma: string) => screen.getByRole('button', { name: ma }).closest('tr')!

describe('Kho › Hàng về', () => {
  it('bấm ô "Quá hẹn" thì chỉ còn đơn quá hẹn', () => {
    dung()
    fireEvent.click(screen.getByRole('button', { name: /Quá hẹn/ }))
    expect(screen.queryByRole('button', { name: 'PO-2026-0100' })).toBeNull()
    expect(screen.getByRole('button', { name: 'PO-2026-0108' })).toBeTruthy()
    expect(screen.getByText('2 / 5 đơn')).toBeTruthy()
  })

  it('PO-0100: nói đợt 1 đã nhập trước, Nhận hàng mở đúng đợt 2', () => {
    dung()
    const tr = dongCua('PO-2026-0100')
    expect(within(tr).getByText(/đợt 1 đã về/)).toBeTruthy()
    expect(within(tr).getByText('Đợt 2/2 · 22/10')).toBeTruthy()
    expect(within(tr).getByText('+1')).toBeTruthy()
    const nhan = within(tr).getByRole('link', { name: /Nhận hàng/ })
    expect(nhan.getAttribute('href')).toBe('/warehouse/nhap/id-PO-2026-0100?dot=dot-2')
  })

  it('đơn chỉ có dòng theo mã SP: không có nút Nhận hàng, nút khoá nói lý do', () => {
    dung()
    const tr = dongCua('ĐH02HGTĐ')
    expect(within(tr).queryByRole('link', { name: /Nhận hàng/ })).toBeNull()
    expect(within(tr).getByRole('button', { name: 'Ngoài sổ kho' })).toBeTruthy()
  })

  it('hẹn năm 2610 gắn nhãn "ngày lạ", không tô trễ', () => {
    dung()
    const tr = dongCua('PO-2026-0085')
    expect(within(tr).getByText('ngày lạ')).toBeTruthy()
    expect(within(tr).getByText('03/10/2610')).toBeTruthy()
    expect(within(tr).queryByText(/trễ/)).toBeNull()
  })

  it('bấm mã đơn mở hộp bằng ?don= (không sang khu Mua hàng)', () => {
    dung()
    fireEvent.click(screen.getByRole('button', { name: 'PO-2026-0108' }))
    expect(replace).toHaveBeenCalledWith('/warehouse/nhap?don=id-PO-2026-0108', {
      scroll: false,
    })
  })

  it('không có quyền ghi sổ kho: Nhận hàng khoá mềm', () => {
    dung({ canEdit: false })
    const nut = within(dongCua('PO-2026-0115')).getByRole('button', { name: /Nhận hàng/ })
    expect(nut.getAttribute('aria-disabled')).toBe('true')
  })

  it('hộp Hàng của đơn: nói đã nhập trước, ngày phiếu theo giờ VN, Nhận hàng đúng đợt', () => {
    dung({ hangCuaDon: PO100 })
    const hop = screen.getByRole('dialog')
    expect(within(hop).getByText(/Đợt 1 hẹn 12\/10/)).toBeTruthy()
    expect(within(hop).getByText('đã nhập đủ trước hạn')).toBeTruthy()
    expect(within(hop).getByText('06/10')).toBeTruthy()
    const nhan = within(hop).getByRole('link', { name: /Nhận hàng/ })
    expect(nhan.getAttribute('href')).toBe('/warehouse/nhap/id-PO-2026-0100?dot=dot-2')
  })
})
