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
import { ToastProvider } from '@/components/ui/Toast'
import type { TgNcc } from '@/lib/tra-gia'
import type { TraGiaMon } from '@/modules/dept/supply/tra-gia.service'
import { TraGiaScreen } from './TraGiaScreen'

/**
 * TRA GIÁ VẬT TƯ — số thật chạy trên DB 28/10/2026: nhôm phi 25 dày 1.0 có 5 mã
 * của 3 NCC (Quang Minh 108.000 · Ngô Sơn 113.000 · Đoàn Gia 113.000 đ/kg).
 */

const api = vi.fn()
vi.mock('@/lib/api', async (orig) => ({
  ...(await orig<typeof import('@/lib/api')>()),
  api: (...a: unknown[]) => api(...a),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/mua-hang/tra-gia',
}))

const N = (p: Partial<TgNcc>): TgNcc => ({
  supplier_id: 'qm',
  supplier_name: 'CÔNG TY TNHH NHÔM THÉP QUANG MINH',
  gia: 108000,
  dv: 'kg',
  currency: 'VND',
  quy: null,
  at: '2026-10-03',
  po_id: 'po-113',
  po_code: 'PO-2026-0113',
  status: 'received',
  chot: true,
  so_duoc: true,
  ma: ['NH-0003', 'NH-0573', 'NH-0574'],
  ten: 'Nhôm phi 25x1li dài 5.65m',
  bien: null,
  so_dong: 3,
  ...p,
})

const PHI25: Omit<TraGiaMon, 'text' | 'sl' | 'dvt'> = {
  trang_thai: 'ok',
  quy_cach: {
    key: 'kim|Nhôm|tròn|25|1|',
    label: 'Nhôm ống phi 25 · dày 1.0',
    loai: 'kim',
    dv: 'kg',
  },
  so_ma: 5,
  nhom: 'Nhôm định hình - tấm',
  ncc: [
    N({}),
    N({ supplier_id: 'ns', supplier_name: 'Công Ty TNHH Sản xuất thương mại Ngô Sơn', gia: 113000, at: '2026-10-14', po_code: 'PO-2026-0178', ma: ['NH-0607', 'NH-0608'] }), // prettier-ignore
    N({ supplier_id: 'dg', supplier_name: 'Công Ty TNHH Nhôm Đoàn Gia', gia: 113000, at: '2026-09-18', po_code: 'PO-2026-0077', ma: ['NH-0003'] }), // prettier-ignore
  ],
  re_nhat: 108000,
  dv_so: 'kg',
  ung_vien: [],
  so_ung_vien: 0,
  goi_y: [],
  goi_y_theo: null,
  danh_muc: null,
}

const MO_HO: Omit<TraGiaMon, 'text' | 'sl' | 'dvt'> = {
  ...PHI25,
  trang_thai: 'mo_ho',
  quy_cach: null,
  ncc: [],
  re_nhat: null,
  dv_so: null,
  so_ma: 0,
  ung_vien: [
    { key: 'k10', label: 'Thép hộp 20×40 · dày 1.0', so_ncc: 2, so_dong: 2 },
    { key: 'k08', label: 'Thép hộp 20×40 · dày 0.8', so_ncc: 1, so_dong: 3 },
  ],
  so_ung_vien: 2,
}

type Body = {
  thang: number
  items: { text: string; sl: number | null; key: string | null }[]
}
/** Giả route: "thép hộp 20x40" chưa có khoá → mơ hồ; còn lại ra nhôm phi 25. */
function traLoi(_url: string, init: { body: Body }) {
  return Promise.resolve({
    tu_ngay: '2026-04-28',
    den_ngay: '2026-10-28',
    so_dong: 707,
    mon: init.body.items.map((it) => ({
      ...(it.text.startsWith('thép hộp') && !it.key ? MO_HO : PHI25),
      text: it.text,
      sl: it.sl,
      dvt: null,
    })),
  })
}

beforeEach(() => {
  localStorage.clear()
  api.mockImplementation(traLoi)
})
afterEach(() => {
  cleanup()
  api.mockReset()
})

const dung = () =>
  render(
    <ToastProvider>
      <TraGiaScreen meId="u1" />
    </ToastProvider>,
  )
const go = (text: string) => {
  const o = screen.getByLabelText('Thêm món cần tra giá')
  fireEvent.change(o, { target: { value: text } })
  fireEvent.keyDown(o, { key: 'Enter' })
}
const facts = () => document.body.textContent ?? ''

describe('TraGiaScreen', () => {
  it('trống thì nói việc tiếp; gõ một món → gọi route tra giá, ra 3 NCC, rẻ nhất Quang Minh', async () => {
    dung()
    expect(screen.getByText('Danh sách tra giá đang trống')).toBeTruthy()
    go('nhôm phi 25 x1.0')
    await screen.findByText('Nhôm ống phi 25 · dày 1.0')
    expect(api).toHaveBeenCalledWith('/api/dept/supply/tra-gia', {
      method: 'POST',
      body: {
        thang: 6,
        items: [{ text: 'nhôm phi 25 x1.0', sl: null, dvt: null, key: null }],
      },
    })
    const qm = screen.getByRole('radio', {
      name: /Chọn CÔNG TY TNHH NHÔM THÉP QUANG MINH/,
    })
    expect((qm as HTMLInputElement).checked).toBe(true)
    expect(screen.getByText('rẻ nhất')).toBeTruthy()
    expect(screen.getAllByText('+4,6%')).toHaveLength(2)
    expect(facts()).toContain('khớp 5 mã')
  })

  it('nhập SL → thành tiền theo NCC chọn; đổi NCC thì tổng đổi theo; xem theo NCC', async () => {
    dung()
    go('nhôm phi 25 x1.0')
    await screen.findByText('Nhôm ống phi 25 · dày 1.0')
    fireEvent.change(screen.getByLabelText('Số lượng Nhôm ống phi 25 · dày 1.0'), { target: { value: '650' } }) // prettier-ignore
    await waitFor(() => expect(facts()).toContain('70.200.000 đ'))
    fireEvent.click(screen.getByRole('radio', { name: /Chọn Công Ty TNHH Sản xuất thương mại Ngô Sơn/ })) // prettier-ignore
    await waitFor(() => expect(facts()).toContain('73.450.000 đ'))

    fireEvent.click(screen.getByRole('button', { name: 'Theo NCC' }))
    const bang = screen.getByRole('table', { name: 'So sánh giá theo nhà cung cấp' })
    const hang = within(bang).getAllByRole('row')
    // Hàng đầu sau tiêu đề = NCC đang được chọn.
    expect(hang[1].textContent).toContain('Sản xuất thương mại Ngô Sơn')
    expect(hang[1].textContent).toContain('73.450.000')
  })

  it('ghi giá hỏi được: vào so sánh, rẻ hơn thì thành NCC chọn; không lưu lên server', async () => {
    dung()
    go('nhôm phi 25 x1.0')
    await screen.findByText('Nhôm ống phi 25 · dày 1.0')
    fireEvent.click(screen.getByRole('button', { name: '+ Ghi giá hỏi được' }))
    const hop = screen.getByRole('dialog', { name: 'Ghi giá hỏi được' })
    const nutThem = within(hop).getByRole('button', { name: 'Thêm vào so sánh' })
    expect(nutThem.getAttribute('aria-disabled')).toBe('true')
    fireEvent.change(within(hop).getByLabelText('Nhà cung cấp'), { target: { value: 'Nhôm Hoàng Vũ' } }) // prettier-ignore
    fireEvent.change(within(hop).getByLabelText('Giá'), { target: { value: '105.000' } })
    fireEvent.click(nutThem)
    expect(screen.queryByRole('dialog')).toBeNull()
    const r = screen.getByRole('radio', {
      name: /Chọn Nhôm Hoàng Vũ/,
    }) as HTMLInputElement
    expect(r.checked).toBe(true)
    expect(screen.getByText(/^hỏi giá /)).toBeTruthy()
    expect(api).toHaveBeenCalledTimes(1)
  })

  it('món mơ hồ: chọn một quy cách → tra lại riêng món đó với khoá đã chọn', async () => {
    dung()
    go('thép hộp 20x40')
    const nut = await screen.findByRole('button', {
      name: 'Thép hộp 20×40 · dày 1.0 · 2 NCC',
    })
    expect(screen.getByText('Khớp 2 quy cách đã từng mua.')).toBeTruthy()
    fireEvent.click(nut)
    await waitFor(() => expect(api).toHaveBeenCalledTimes(2))
    expect(api.mock.calls[1][1].body.items[0]).toMatchObject({
      text: 'thép hộp 20x40',
      key: 'k10',
    })
  })

  it('nháp trên máy: mở lại màn thì danh sách còn và giá được tra lại', async () => {
    const { unmount } = dung()
    go('nhôm phi 25 x1.0')
    await screen.findByText('Nhôm ống phi 25 · dày 1.0')
    unmount()
    api.mockClear()
    dung()
    await screen.findByText('Nhôm ống phi 25 · dày 1.0')
    expect(api).toHaveBeenCalledTimes(1)
    expect(api.mock.calls[0][1].body.items[0].text).toBe('nhôm phi 25 x1.0')
  })

  it('dán từ Excel: đọc tiêu đề + số kiểu Việt Nam, thêm cả loạt một lượt tra', async () => {
    dung()
    fireEvent.click(screen.getAllByRole('button', { name: 'Dán từ Excel' })[0])
    const hop = screen.getByRole('dialog', { name: 'Dán danh sách từ Excel' })
    fireEvent.change(within(hop).getByLabelText('Dữ liệu dán từ Excel'), {
      target: {
        value:
          'Tên vật tư\tSL\nNhôm phi 25 x1.0\t1.200\nTổng cộng\t\nNhôm vuông 20x20 1.0\t650',
      },
    })
    fireEvent.click(within(hop).getByRole('button', { name: 'Thêm 2 món' }))
    await waitFor(() => expect(api).toHaveBeenCalledTimes(1))
    expect(api.mock.calls[0][1].body.items.map((i: { sl: number }) => i.sl)).toEqual([
      1200, 650,
    ])
  })
})

describe('TraGiaScreen — Xuất Excel', () => {
  it('danh sách trống: nút khoá, bấm thì nói lý do tại chỗ', () => {
    dung()
    const nut = screen.getByRole('button', { name: 'Xuất Excel' })
    expect(nut.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(nut)
    expect(screen.getByRole('status').textContent).toContain('Chưa có món nào để xuất')
  })

  it('gửi chữ món + NCC đang chọn + giá hỏi; tải file theo tên server đặt', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Blob(['xlsx']), {
        status: 200,
        headers: {
          'content-disposition': `attachment; filename="Tra-gia-vat-tu_28-10-2026.xlsx"; filename*=UTF-8''Tra-gia-vat-tu_28-10-2026.xlsx`,
        },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
    dung()
    go('nhôm phi 25 x1.0')
    await screen.findByText('Nhôm ống phi 25 · dày 1.0')
    fireEvent.click(screen.getByRole('radio', { name: /Chọn Công Ty TNHH Sản xuất thương mại Ngô Sơn/ })) // prettier-ignore
    fireEvent.click(screen.getByRole('button', { name: 'Xuất Excel' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/dept/supply/tra-gia/excel')
    expect(JSON.parse(init.body)).toEqual({
      thang: 6,
      items: [
        { text: 'nhôm phi 25 x1.0', sl: null, dvt: null, key: null, chon: 'ns', hoi: [] },
      ],
    })
    await screen.findByText('Đã xuất Excel')
    vi.unstubAllGlobals()
  })
})
