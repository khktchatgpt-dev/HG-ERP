// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { TonKhoScreen, type TonRow } from './TonKhoScreen'
import type { RoTon } from './ro-ton'

/**
 * TỒN KHO · THEO MÃ — B3 "Kho cho người mới" (bản vẽ B1, 27/10/2026): một ô Lọc
 * thay tám ô rổ, lưới 6 cột, khung mã đang chọn bên phải. Dữ liệu rút từ màn thật
 * 14/10/2026: BAO0205 (của lệnh 02-ROSCO), BAO0326 dưới mức.
 */
const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/warehouse/ton',
  useSearchParams: () => new URLSearchParams(''),
}))
const api = vi.fn()
vi.mock('@/lib/api', () => ({
  api: (...a: unknown[]) => api(...a),
  apiErrorText: (_e: unknown, f: string) => f,
}))
afterEach(() => {
  cleanup()
  push.mockReset()
  api.mockReset()
})

const row = (p: Partial<TonRow> & Pick<TonRow, 'material_id' | 'code'>): TonRow => ({
  name: 'tên ' + p.code,
  unit: 'Cái',
  qty_ok: 100,
  on_hand: p.qty_ok ?? 100,
  qty_qc: 0,
  qty_blocked: 0,
  reserved: 0,
  available: 100,
  shelf_location: 'BB-H',
  is_low: false,
  min_stock: 0,
  ...p,
})
const ROWS = [
  row({ material_id: 'a', code: 'BAO0205', qty_ok: 200, available: 200 }),
  row({ material_id: 'b', code: 'BAO0326', qty_ok: 20, available: 20, is_low: true, min_stock: 30 }), // prettier-ignore
]
const COUNTS: Record<RoTon, number> = { has: 169, chung: 10, low: 5, out: 13312, qc: 0, blocked: 0, short: 39, all: 13481 } // prettier-ignore

const dung = (laTruong = true) =>
  render(
    <TonKhoScreen
      rows={ROWS}
      cuaLenh={{ a: [{ lsx_id: 'l1', code: '02/26-27 - ROSCO', qty: 150 }] }}
      counts={COUNTS}
      total={169}
      trang={1}
      soTrang={4}
      ro="has"
      q=""
      nhom=""
      nhomOptions={['Bao bì - đóng gói - tem nhãn']}
      laTruong={laTruong}
      canEdit
    />,
  )

describe('TonKhoScreen (B3 Tồn kho gọn)', () => {
  it('tám rổ gom vào MỘT ô Lọc kèm số; đổi lọc đổi URL', () => {
    dung()
    expect(screen.queryByRole('group', { name: 'Rổ tồn kho' })).toBeNull()
    const loc = screen.getByRole('combobox', { name: 'Lọc tồn kho' }) as HTMLSelectElement
    expect(loc.options).toHaveLength(8)
    expect(loc.options[0].text).toBe('Đang có tồn (169)')
    fireEvent.change(loc, { target: { value: 'low' } })
    expect(push).toHaveBeenCalledWith('/warehouse/ton?ro=low', { scroll: false })
  })

  it('lưới 6 cột, không nút trên dòng; chọn dòng thì nút Xuất / Cập nhật mở đúng mã', () => {
    api.mockResolvedValue({ ke: [], bienDong: [] })
    dung()
    const bang = screen.getByRole('table', { name: 'Tồn kho theo mã' })
    expect(
      within(bang)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['Mã', 'Tên vật tư', 'ĐVT', 'Kệ', 'Dùng được', 'Của lệnh'])
    expect(within(bang).queryByRole('button')).toBeNull()
    const pane = screen.getByRole('toolbar', { name: 'Thao tác' })
    expect(within(pane).getByRole('button', { name: /Xuất mã này/ }).getAttribute('aria-disabled')).toBe('true') // prettier-ignore
    fireEvent.click(within(bang).getByText('BAO0205'))
    expect(within(pane).getByRole('link', { name: /Xuất BAO0205/ }).getAttribute('href')).toBe('/warehouse/xuat?ma=BAO0205') // prettier-ignore
    // 28/10/2026: Cập nhật số thực tế mở NGAY trong khung mã, không sang màn khác.
    fireEvent.click(within(pane).getByRole('button', { name: /Cập nhật số thực tế/ }))
    expect(screen.getByRole('form', { name: 'Cập nhật số thực tế BAO0205' })).toBeTruthy()
    expect(push).not.toHaveBeenCalled()
  })

  it('mã dưới mức: Dùng được đỏ kèm "dưới 30"', () => {
    dung()
    expect(screen.getByText('dưới 30')).toBeTruthy()
  })

  it('khung phải: chưa chọn thì nói chọn gì; chọn thì bày kệ, của lệnh, biến động gộp theo phiếu', async () => {
    api.mockResolvedValue({
      ke: [{ material_id: 'a', bin_id: 'k', bin_code: 'BB-H', bin_name: null, bin_kind: null, stock_status: 'ok', qty: 200 }], // prettier-ignore
      bienDong: [
        { id: '1', created_at: '2026-10-11T03:00:00Z', direction: 'in', qty: 120, stock_status: 'ok', reason_code: 'N1', doc_id: 'd1', doc_code: 'PNK-2026-0126', lenh_code: null }, // prettier-ignore
        { id: '2', created_at: '2026-10-11T03:00:00Z', direction: 'in', qty: 80, stock_status: 'ok', reason_code: 'N1', doc_id: 'd1', doc_code: 'PNK-2026-0126', lenh_code: null }, // prettier-ignore
      ],
    })
    dung()
    expect(screen.getByText('Chọn một mã trong bảng')).toBeTruthy()
    fireEvent.click(screen.getByText('BAO0205'))
    expect(api).toHaveBeenCalledWith('/api/dept/warehouse/stock/a')
    const khung = screen.getByRole('complementary', { name: 'Mã đang chọn BAO0205' })
    expect(await within(khung).findByRole('link', { name: 'PNK-2026-0126' })).toBeTruthy()
    expect(within(khung).getByText('+200')).toBeTruthy() // 120 + 80 gộp một phiếu
    expect(within(khung).getByText('02/26-27 - ROSCO')).toBeTruthy()
    // 200 − 150 của lệnh = 50 tồn chung
    expect(within(khung).getByText('Tồn chung').nextSibling?.textContent).toBe('50')
    // Hàng của lệnh → nút xuất mở sẵn lệnh + mã
    expect(within(khung).getByRole('link', { name: 'Xuất cho lệnh 02-ROSCO' }).getAttribute('href')).toBe('/warehouse/xuat?lsx=l1&ma=BAO0205') // prettier-ignore
  })
})

/**
 * CẬP NHẬT SỐ THỰC TẾ NGAY TRONG KHUNG MÃ (28/10/2026 — chủ dự án: "sao không cho
 * cập nhật trực tiếp tại màn này"). Cùng luật + cùng route với màn riêng.
 */
describe('TonKhoScreen · cập nhật số thực tế trong khung mã', () => {
  const moKhoi = () => {
    fireEvent.click(screen.getByText('BAO0205'))
    const khung = screen.getByRole('complementary', { name: 'Mã đang chọn BAO0205' })
    fireEvent.click(within(khung).getByRole('button', { name: 'Cập nhật số thực tế' }))
    return screen.getByRole('form', { name: 'Cập nhật số thực tế BAO0205' })
  }
  const go = (f: HTMLElement, v: string) =>
    fireEvent.change(within(f).getByLabelText('Đếm được BAO0205'), {
      target: { value: v },
    })

  it('đếm thiếu hàng của lệnh → hỏi tổ đã lấy (chọn sẵn lệnh); ghi gửi đúng route, báo phiếu tại khung', async () => {
    api.mockImplementation((url: string, init?: { method?: string }) =>
      init?.method === 'POST'
        ? Promise.resolve({ trang_thai: 'da_ghi', code: 'KK-2026-0010', doc_code: 'KK-2026-0011', xuat_bu: [{ code: 'PXK-2026-0030', lsx_code: '02/26-27 - ROSCO' }] }) // prettier-ignore
        : Promise.resolve({ ke: [], bienDong: [] }),
    )
    dung()
    const f = moKhoi()
    go(f, '150')
    expect(within(f).getByText('−50')).toBeTruthy()
    expect((within(f).getByLabelText('Lệnh xuất bù BAO0205') as HTMLSelectElement).value).toBe('l1') // prettier-ignore
    expect(within(f).getByRole('button', { name: 'Ghi — đổi tồn ngay' })).toBeTruthy()
    fireEvent.submit(f)
    const khung = screen.getByRole('complementary', { name: 'Mã đang chọn BAO0205' })
    expect(await within(khung).findByText(/Đã ghi KK-2026-0011 và phiếu xuất bù PXK-2026-0030 cho 02\/26-27 - ROSCO/)).toBeTruthy() // prettier-ignore
    expect(api).toHaveBeenCalledWith('/api/dept/warehouse/cap-nhat-ton', {
      method: 'POST',
      body: {
        ly_do_chung: 'giao_kho',
        ghi_chu: null,
        lines: [{ material_id: 'a', counted_qty: 150, ly_do: null, ghi_chu: null, xuat_bu_lsx_id: 'l1' }], // prettier-ignore
      },
    })
    expect(screen.queryByRole('form', { name: 'Cập nhật số thực tế BAO0205' })).toBeNull()
  })

  it('chưa gõ / khớp máy thì chặn tại chỗ, không gửi; không phải trưởng kho thì nút nói "Gửi trưởng kho duyệt"', () => {
    api.mockResolvedValue({ ke: [], bienDong: [] })
    dung(false)
    const f = moKhoi()
    expect(within(f).getByRole('button', { name: 'Gửi trưởng kho duyệt' })).toBeTruthy()
    fireEvent.submit(f)
    expect(within(f).getByRole('alert').textContent).toBe('Chưa gõ số đếm được')
    go(f, '200')
    fireEvent.submit(f)
    expect(within(f).getByRole('alert').textContent).toBe(
      'Khớp với máy — không có gì để ghi',
    )
    expect(api).not.toHaveBeenCalledWith(
      '/api/dept/warehouse/cap-nhat-ton',
      expect.anything(),
    )
  })
})
