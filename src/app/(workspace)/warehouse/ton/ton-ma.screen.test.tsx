// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { TonKhoScreen, type TonRow } from './TonKhoScreen'
import type { RoTon } from './ro-ton'

/**
 * TỒN KHO · THEO MÃ trên khung Kho lối ERP (B1, bản vẽ K-1). Dữ liệu rút từ màn
 * thật 14/10/2026: BAO0205 (của lệnh 02-ROSCO), BAO0326 dưới mức.
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

const dung = () =>
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
    />,
  )

describe('TonKhoScreen (khung Kho lối ERP)', () => {
  it('tám rổ là ô đếm, số nói một lần; bấm rổ đổi URL', () => {
    dung()
    const ro = screen.getByRole('group', { name: 'Rổ tồn kho' })
    expect(within(ro).getAllByRole('button').length).toBe(8)
    fireEvent.click(within(ro).getByRole('button', { name: /Dưới mức/ }))
    expect(push).toHaveBeenCalledWith('/warehouse/ton?ro=low', { scroll: false })
  })

  it('không nút trên dòng: chọn dòng rồi "Xuất" ở Action Pane mở phiếu xuất của mã', () => {
    dung()
    const pane = screen.getByRole('toolbar', { name: 'Thao tác' })
    expect(within(pane).getByRole('button', { name: /Xuất mã này/ }).getAttribute('aria-disabled')).toBe('true') // prettier-ignore
    const bang = screen.getByRole('table', { name: 'Tồn kho theo mã' })
    expect(within(bang).queryByRole('link')).toBeNull()
    fireEvent.click(within(bang).getByText('BAO0205'))
    expect(within(pane).getByRole('link', { name: /Xuất BAO0205/ }).getAttribute('href')).toBe('/warehouse/xuat?ma=BAO0205') // prettier-ignore
  })

  it('mã dưới mức: Còn dùng đỏ kèm "dưới 30"', () => {
    dung()
    expect(screen.getByText('dưới 30')).toBeTruthy()
  })

  it('▸ mở chi tiết dưới dòng: kệ, của lệnh, biến động gộp theo phiếu', async () => {
    api.mockResolvedValue({
      ke: [{ material_id: 'a', bin_id: 'k', bin_code: 'BB-H', bin_name: null, bin_kind: null, stock_status: 'ok', qty: 200 }], // prettier-ignore
      bienDong: [
        { id: '1', created_at: '2026-10-11T03:00:00Z', direction: 'in', qty: 120, stock_status: 'ok', reason_code: 'N1', doc_id: 'd1', doc_code: 'PNK-2026-0126', lenh_code: null }, // prettier-ignore
        { id: '2', created_at: '2026-10-11T03:00:00Z', direction: 'in', qty: 80, stock_status: 'ok', reason_code: 'N1', doc_id: 'd1', doc_code: 'PNK-2026-0126', lenh_code: null }, // prettier-ignore
      ],
    })
    dung()
    fireEvent.click(screen.getByRole('button', { name: 'Mở chi tiết BAO0205' }))
    expect(api).toHaveBeenCalledWith('/api/dept/warehouse/stock/a')
    expect(await screen.findByRole('link', { name: 'PNK-2026-0126' })).toBeTruthy()
    expect(screen.getByText('+200')).toBeTruthy() // 120 + 80 gộp một phiếu
    expect(screen.getByText('02/26-27 - ROSCO')).toBeTruthy()
    // 200 − 150 của lệnh = 50 tồn chung (tile "Tồn chung" cũng có chữ này)
    const exp = document.querySelector('.kh-exp') as HTMLElement
    expect(within(exp).getByText('Tồn chung').nextSibling?.textContent).toBe('50')
  })
})
