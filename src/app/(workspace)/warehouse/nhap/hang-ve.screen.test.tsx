// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { ToastProvider } from '@/components/kit'
import type { HangVeRow } from '@/lib/kho-hang-ve'
import type { SapDatRow } from '@/lib/kho-lich-hang-ve'
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
  su_co_mo: 0,
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
  issues: [],
  docs: [{ doc_id: 'd99', code: 'PNK-2026-0099', kind: 'receipt', at: '2026-10-06', qty_total: 4969, reversed_by: null }], // prettier-ignore
}

function dung(them: Partial<Parameters<typeof HangVeScreen>[0]> = {}) {
  render(
    <ToastProvider>
      <HangVeScreen
        rows={ROWS}
        sapDat={[]}
        today={TODAY}
        canEdit
        truncatedAt={null}
        hangCuaDon={null}
        suCo={null}
        {...them}
      />
    </ToastProvider>,
  )
}
const dongCua = (ma: string) => screen.getByRole('button', { name: ma }).closest('tr')!
// 27/10/2026: hàng tab mốc hẹn thay bằng dải lịch (mỗi ô một tab, có từng ngày).
const lich = () => screen.getByRole('tablist', { name: 'Lịch hàng về' })
const tab = (ten: RegExp) =>
  fireEvent.click(within(lich()).getByRole('tab', { name: ten }))
const pane = () => screen.getByRole('toolbar', { name: 'Thao tác' })

describe('Kho › Hàng về (khung Kho lối ERP · B2)', () => {
  it('mở ra đứng ở tab "Quá hẹn" (có đơn quá hẹn); tab Tất cả ra đủ 5', () => {
    dung()
    expect(screen.getByRole('button', { name: 'PO-2026-0108' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'PO-2026-0100' })).toBeNull()
    expect(screen.getByText('2 / 5 đơn')).toBeTruthy()
    tab(/^Tất cả/)
    expect(screen.getByText('5 / 5 đơn')).toBeTruthy()
  })

  it('PO-0100: nói đợt 1 đã nhập trước; chọn dòng → Nhận hàng mở đúng đợt 2', () => {
    dung()
    tab(/^Hôm nay/)
    const tr = dongCua('PO-2026-0100')
    expect(within(tr).getByText(/đợt 1 đã về/)).toBeTruthy()
    expect(within(tr).getByText('Đợt 2/2 · 22/10')).toBeTruthy()
    expect(within(tr).getByText('+1')).toBeTruthy()
    expect(within(tr).queryByRole('link')).toBeNull() // không nút trên dòng (K1)
    fireEvent.click(tr)
    const nhan = within(pane()).getByRole('link', { name: /Nhận hàng PO-2026-0100/ })
    expect(nhan.getAttribute('href')).toBe('/warehouse/nhap/id-PO-2026-0100?dot=dot-2')
  })

  it('đơn chỉ có dòng theo mã SP: Nhận hàng khoá, nói lý do', () => {
    dung()
    const tr = dongCua('ĐH02HGTĐ')
    expect(within(tr).getByText('ngoài sổ kho')).toBeTruthy()
    fireEvent.click(tr)
    const nut = within(pane()).getByRole('button', { name: /Nhận hàng ĐH02HGTĐ/ })
    expect(nut.getAttribute('aria-disabled')).toBe('true')
    expect(nut.getAttribute('title')).toMatch(/nghiệm thu ngoài sổ/)
  })

  it('hẹn năm 2610 gắn nhãn "ngày lạ", không tô trễ', () => {
    dung()
    tab(/^Sau đó/)
    const tr = dongCua('PO-2026-0085')
    expect(within(tr).getByText('ngày lạ')).toBeTruthy()
    expect(within(tr).getByText('03/10/2610')).toBeTruthy()
    expect(within(tr).queryByText(/ngày$/)).toBeNull()
  })

  it('bấm mã đơn mở hộp bằng ?don= (không sang khu Mua hàng)', () => {
    dung()
    fireEvent.click(screen.getByRole('button', { name: 'PO-2026-0108' }))
    expect(replace).toHaveBeenCalledWith('/warehouse/nhap?don=id-PO-2026-0108', {
      scroll: false,
    })
  })

  it('không có quyền ghi sổ kho: Nhận hàng khoá mềm, nói phòng giữ quyền', () => {
    dung({ canEdit: false })
    tab(/^T3 13\/10/)
    fireEvent.click(dongCua('PO-2026-0115'))
    const nut = within(pane()).getByRole('button', { name: /Nhận hàng PO-2026-0115/ })
    expect(nut.getAttribute('aria-disabled')).toBe('true')
    expect(nut.getAttribute('title')).toMatch(/Chỉ phòng Kho/)
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

describe('Kho › Hàng về · khung hẹp', () => {
  it('khung 800px: bỏ Loại hàng + Phụ trách + Trễ, đợt gọn, giá trị ẩn nằm ở tooltip mã đơn', () => {
    const goc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 800 }) // prettier-ignore
    try {
      dung()
      tab(/^Hôm nay/)
      const heads = screen.getAllByRole('columnheader').map((h) => h.textContent)
      expect(heads).not.toContain('Loại hàng')
      expect(heads).not.toContain('Phụ trách')
      expect(heads).not.toContain('Trễ')
      const tr = dongCua('PO-2026-0100')
      expect(within(tr).getByText('2/2 · 22/10')).toBeTruthy()
      expect(within(tr).getByRole('button', { name: 'PO-2026-0100' }).getAttribute('title')).toContain('Đặng Thị Thanh Nga') // prettier-ignore
    } finally {
      if (goc) Object.defineProperty(HTMLElement.prototype, 'clientWidth', goc)
    }
  })
})

/**
 * KHO NẮM ĐƠN MUA, KHÔNG CAN THIỆP (27/10/2026, bản vẽ 5iNGTXFg… Q4 + Q6): dải
 * lịch từng ngày, khối Sắp đặt chỉ xem, cột Phụ trách luôn hiện. Đơn sắp đặt theo
 * mẫu PO-2026-0185 Kimpack (GĐ duyệt 17/10, chờ NCC xác nhận).
 */
const SAP: SapDatRow = {
  po_id: 'id-PO-2026-0185',
  po_code: 'PO-2026-0185',
  supplier_name: 'KIMPACK PACKAGING JOINT STOCK COMPANY',
  lsx_code: '08/26-27 - MX',
  extra_lsx: [],
  template: 'carton',
  expected_at: '2026-10-14',
  bucket: 'week',
  lines_total: 10,
  owner_name: 'Đặng Thị Thanh Nga',
  approved_at: '2026-10-02',
}

describe('Kho › Hàng về · lịch 7 ngày + Sắp đặt (chỉ xem)', () => {
  it('dải lịch: số chính = đơn đang về theo ô, sắp đặt đếm riêng; ô 7 ngày tách từng ngày', () => {
    dung({ sapDat: [SAP] })
    const o = within(lich())
      .getAllByRole('tab')
      .map((t) => t.getAttribute('aria-label'))
    expect(o).toEqual([
      'Quá hẹn — 2 đơn đang về',
      'Hôm nay 12/10 — 1 đơn đang về',
      'T3 13/10 — 1 đơn đang về',
      'T4 14/10 — 0 đơn đang về, 1 đơn sắp đặt',
      'T5 15/10 — 0 đơn đang về',
      'T6 16/10 — 0 đơn đang về',
      'T7 17/10 — 0 đơn đang về',
      'CN 18/10 — 0 đơn đang về',
      'T2 19/10 — 0 đơn đang về',
      'Sau đó — 1 đơn đang về',
      'Tất cả — 5 đơn đang về, 1 đơn sắp đặt',
    ])
    // Quá hẹn đứng sẵn, dòng phụ nói khoảng trễ (bỏ ngày gõ nhầm năm).
    expect(within(lich()).getByRole('tab', { name: /^Quá hẹn/ }).getAttribute('aria-selected')).toBe('true') // prettier-ignore
    expect(within(lich()).getByText('trễ 10–37 ngày')).toBeTruthy()
  })

  it('bấm ô ngày: chỉ đơn hẹn ngày đó, nhóm mang tên ngày', () => {
    dung()
    tab(/^T3 13\/10/)
    expect(screen.getByRole('button', { name: 'PO-2026-0115' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'PO-2026-0108' })).toBeNull()
    const bang = screen.getByRole('table', { name: 'Đơn đang về' })
    expect(within(bang).getByText('T3 13/10')).toBeTruthy()
  })

  it('ô không có đơn đang về chỉ có sắp đặt: bày khối Sắp đặt, không bày "rỗng"', () => {
    dung({ sapDat: [SAP] })
    tab(/^T4 14\/10/)
    expect(screen.getByText('Sắp đặt')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'PO-2026-0185' })).toBeTruthy()
    expect(
      screen.getByText(/1 đơn sắp đặt chỉ để xem, không tính vào số trên/),
    ).toBeTruthy()
  })

  it('ô rỗng hẳn: nói lý do + nút sang ngày gần nhất có hàng', () => {
    dung()
    tab(/^T5 15\/10/)
    expect(screen.getByText('Không có đơn nào ở ô “T5 15/10”')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Xem Hôm nay 12/10 · 1 đơn' }))
    expect(screen.getByRole('button', { name: 'PO-2026-0100' })).toBeTruthy()
  })

  it('chọn đơn sắp đặt: Nhận hàng khoá, lý do nói TẠI CHỖ ai gỡ được; không có nút báo', () => {
    dung({ sapDat: [SAP] })
    tab(/^Tất cả/)
    const tr = dongCua('PO-2026-0185')
    expect(within(tr).getByText(/chờ NCC xác nhận/)).toBeTruthy()
    expect(within(tr).getByText(/· 10 ngày/)).toBeTruthy()
    expect(within(tr).getByText('10 dòng')).toBeTruthy()
    fireEvent.click(tr)
    const nut = within(pane()).getByRole('button', { name: /Nhận hàng PO-2026-0185/ })
    expect(nut.getAttribute('aria-disabled')).toBe('true')
    expect(screen.getByText(/Chưa nhận được/).closest('.kh-note')?.textContent).toMatch(
      /Đặng Thị Thanh Nga \(Cung ứng\) bấm “NCC xác nhận”/,
    )
    fireEvent.click(within(pane()).getByRole('button', { name: /Khác/ }))
    expect(within(pane()).getByRole('menuitem', { name: /Báo sự cố/ }).getAttribute('aria-disabled')).toBe('true') // prettier-ignore
  })

  it('cột Phụ trách luôn hiện, tên đủ — cả khung 1.068px (laptop 1280 trừ menu)', () => {
    const goc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 1068 }) // prettier-ignore
    try {
      dung()
      const heads = screen.getAllByRole('columnheader').map((h) => h.textContent)
      expect(heads).toContain('Phụ trách')
      expect(heads).not.toContain('Loại hàng')
      expect(within(dongCua('PO-2026-0108')).getByText('Đặng Thị Thanh Nga')).toBeTruthy()
    } finally {
      if (goc) Object.defineProperty(HTMLElement.prototype, 'clientWidth', goc)
    }
  })
})

describe('Kho › Hàng về · sự cố', () => {
  it('đơn có sự cố mở hiện nhãn "N sự cố"; Báo sự cố ở menu Khác mở ?su_co=', () => {
    dung({ rows: ROWS.map((x) => (x.po_code === 'PO-2026-0108' ? { ...x, su_co_mo: 1 } : x)) }) // prettier-ignore
    const tr = dongCua('PO-2026-0108')
    expect(within(tr).getByText('1 sự cố')).toBeTruthy()
    fireEvent.click(tr)
    // B4 (27/10/2026): việc phụ gom vào "Khác ▾" — một nút chính trên Action Pane.
    fireEvent.click(within(pane()).getByRole('button', { name: /Khác/ }))
    fireEvent.click(within(pane()).getByRole('menuitem', { name: /Báo sự cố/ }))
    expect(replace).toHaveBeenCalledWith('/warehouse/nhap?su_co=id-PO-2026-0108', {
      scroll: false,
    })
  })
})
