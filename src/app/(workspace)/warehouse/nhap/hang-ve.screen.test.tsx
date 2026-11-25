// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { ToastProvider } from '@/components/kit'
import type { HangVeRow } from '@/lib/kho-hang-ve'
import type { SapDatRow } from '@/lib/kho-lich-hang-ve'
import { HangVeScreen } from './HangVeScreen'

/**
 * KHO › HÀNG VỀ (Kho đợt 2 · Bước 1, bản vẽ duyệt 12/10/2026) — dựng màn từ dữ
 * liệu đóng băng lấy từ DB thật ngày 12/10/2026 (5 trong 29 đơn đang về + hộp
 * PO-2026-0100), soi đúng những điều bản vẽ hứa.
 */

const replace = vi.fn()
const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh: vi.fn(), replace }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/warehouse/nhap',
}))
afterEach(() => {
  cleanup()
  replace.mockReset()
  push.mockReset()
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

function dung(them: Partial<Parameters<typeof HangVeScreen>[0]> = {}) {
  render(
    <ToastProvider>
      <HangVeScreen
        rows={ROWS}
        sapDat={[]}
        today={TODAY}
        canEdit
        truncatedAt={null}
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

  it('bấm mã đơn sang trang đơn của Kho (không sang khu Mua hàng, không mở hộp)', () => {
    dung()
    fireEvent.click(screen.getByRole('button', { name: 'PO-2026-0108' }))
    expect(push).toHaveBeenCalledWith('/warehouse/don-mua/id-PO-2026-0108')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('không có quyền ghi sổ kho: Nhận hàng khoá mềm, nói phòng giữ quyền', () => {
    dung({ canEdit: false })
    tab(/^T3 13\/10/)
    fireEvent.click(dongCua('PO-2026-0115'))
    const nut = within(pane()).getByRole('button', { name: /Nhận hàng PO-2026-0115/ })
    expect(nut.getAttribute('aria-disabled')).toBe('true')
    expect(nut.getAttribute('title')).toMatch(/Chỉ phòng Kho/)
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

  it('cột Người mua (Cung ứng) luôn hiện, tên đủ — cả khung 1.068px (laptop 1280 trừ menu)', () => {
    const goc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 1068 }) // prettier-ignore
    try {
      dung()
      const heads = screen.getAllByRole('columnheader').map((h) => h.textContent)
      expect(heads).toContain('Người mua')
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

/**
 * PHỤ TRÁCH NHÓM VẬT TƯ (B1, bản vẽ 27qPqf6o…, 24/11/2026): nhân viên Kho mở màn
 * là "Của tôi"; thủ kho mở là "Tất cả" và thấy cột "Kho giữ". Chỉ là bộ lọc.
 */
describe('Kho › Hàng về · phụ trách nhóm vật tư', () => {
  const NGUOI = [
    { id: 'hao', name: 'Lê Khắc Hào', thu_kho: true },
    { id: 'ha', name: 'Hà Nguyễn Nữ', thu_kho: false },
  ]
  const giu: Record<string, string[]> = {
    'PO-2026-0108': ['ha'],
    'PO-2026-0100': ['ha', 'hao'],
    'PO-2026-0115': ['hao'],
    'PO-2026-0085': ['hao'],
    ĐH02HGTĐ: ['hao'],
  }
  const rows = ROWS.map((x) => ({ ...x, giu: giu[x.po_code], nhom_vt: ['Bao bì'] }))
  const seg = () => screen.getByRole('radiogroup', { name: 'Người Kho giữ đơn' })

  it('nhân viên mở là "Của tôi": chỉ đơn có nhóm của mình, đơn hai người hiện ở cả hai', () => {
    dung({ rows, nguoiKho: NGUOI, meId: 'ha' })
    tab(/Tất cả/)
    const toi = within(seg()).getByRole('radio', { name: /Của tôi/ })
    expect(toi.getAttribute('aria-checked')).toBe('true')
    expect(toi.textContent).toBe('Của tôi2')
    expect(screen.queryByRole('button', { name: 'PO-2026-0115' })).toBeNull()
    expect(screen.getByRole('button', { name: 'PO-2026-0100' })).toBeTruthy()
    expect(within(seg()).getByRole('radio', { name: /Lê Khắc Hào/ }).textContent).toBe('Lê Khắc Hào4')
    fireEvent.click(within(seg()).getByRole('radio', { name: /Tất cả/ }))
    expect(screen.getByRole('button', { name: 'PO-2026-0115' })).toBeTruthy()
  })

  it('thủ kho mở là "Tất cả", có cột "Kho giữ" ghi tên người', () => {
    dung({ rows, nguoiKho: NGUOI, meId: 'hao' })
    tab(/Tất cả/)
    expect(within(seg()).getByRole('radio', { name: /Tất cả/ }).getAttribute('aria-checked')).toBe('true')
    const heads = screen.getAllByRole('columnheader').map((h) => h.textContent)
    expect(heads).toContain('Kho giữ')
    expect(within(dongCua('PO-2026-0100')).getByText('Hà Nguyễn Nữ · Lê Khắc Hào')).toBeTruthy()
  })

  it('khung 1.068px (laptop 1280): không thêm cột "Kho giữ" — tên người giữ vào tooltip mã đơn', () => {
    const goc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 1068 }) // prettier-ignore
    try {
      dung({ rows, nguoiKho: NGUOI, meId: 'hao' })
      tab(/Tất cả/)
      const heads = screen.getAllByRole('columnheader').map((h) => h.textContent)
      expect(heads).not.toContain('Kho giữ')
      expect(screen.getByRole('button', { name: 'PO-2026-0100' }).getAttribute('title')).toMatch(/Kho giữ: Hà Nguyễn Nữ · Lê Khắc Hào/) // prettier-ignore
    } finally {
      if (goc) Object.defineProperty(HTMLElement.prototype, 'clientWidth', goc)
    }
  })

  it('ô lịch mở ra chọn theo đơn CỦA TÔI: cả kho có đơn quá hẹn mà của tôi không có → không đứng ở Quá hẹn (25/11)', () => {
    const chiTuan = ROWS.map((x) => ({ ...x, giu: x.po_code === 'PO-2026-0115' ? ['ha'] : ['hao'] }))
    dung({ rows: chiTuan, nguoiKho: NGUOI, meId: 'ha' })
    expect(within(lich()).getByRole('tab', { name: /Quá hẹn/ }).getAttribute('aria-selected')).toBe('false') // prettier-ignore
    expect(screen.getByRole('button', { name: 'PO-2026-0115' })).toBeTruthy()
  })

  it('cột Nhóm vật tư bày nhãn gọn, tên đủ ở tooltip (25/11: "không biết loại đơn hàng gì")', () => {
    const vai = rows.map((x) => ({ ...x, nhom_vt: ['Vải - da - chỉ - phụ liệu may', 'Mút - xốp - nệm - gòn'] }))
    dung({ rows: vai, nguoiKho: NGUOI, meId: 'hao' })
    tab(/Tất cả/)
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toContain('Nhóm vật tư')
    const o = within(dongCua('PO-2026-0108')).getByText('Vải · Mút')
    expect(o.getAttribute('title')).toBe('Vải - da - chỉ - phụ liệu may, Mút - xốp - nệm - gòn')
  })

  it('ô lọc Nhóm vật tư: số mỗi nhóm = số đơn có nhóm đó; chọn nhóm chỉ còn đơn có nhóm đó', () => {
    const nhom: Record<string, string[]> = {
      'PO-2026-0108': ['Vải - da - chỉ - phụ liệu may', 'Mút - xốp - nệm - gòn'],
      'PO-2026-0100': ['Mút - xốp - nệm - gòn'],
    }
    const ds = rows.map((x) => ({ ...x, nhom_vt: nhom[x.po_code] ?? ['Gỗ - ván - chi tiết gỗ mua ngoài'] })) // prettier-ignore
    dung({ rows: ds, nguoiKho: NGUOI, meId: 'hao' })
    tab(/Tất cả/)
    const o = screen.getByRole('combobox', { name: 'Nhóm vật tư' }) as HTMLSelectElement
    expect([...o.options].map((x) => x.textContent)).toEqual([
      'Mọi nhóm vật tư',
      'Gỗ (3)',
      'Mút (2)',
      'Vải (1)',
    ])
    fireEvent.change(o, { target: { value: 'Mút - xốp - nệm - gòn' } })
    expect(screen.getByRole('button', { name: 'PO-2026-0108' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'PO-2026-0100' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'PO-2026-0115' })).toBeNull()
  })

  it('chưa có ai phụ trách (không truyền người Kho): không có dải lọc, màn như cũ', () => {
    dung()
    expect(screen.queryByRole('radiogroup', { name: 'Người Kho giữ đơn' })).toBeNull()
  })
})
