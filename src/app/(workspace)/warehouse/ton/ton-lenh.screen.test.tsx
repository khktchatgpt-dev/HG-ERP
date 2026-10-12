// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { ToastProvider } from '@/components/kit'
import { TonLenhScreen } from './TonLenhScreen'
import type { LenhDong, MaChiTiet } from './ton-lenh.shared'

/**
 * TỒN KHO THEO LỆNH (Kho đợt 2 · Bước 5, bản vẽ B5-1…B5-3). Dữ liệu đóng băng từ
 * DB thật 12/10/2026 (rút gọn): YOTRIO quá hạn xuất 10/10, 06-MX có mã chung với
 * YOTRIO / 09-MX, 05-MX đã xong mà sổ chưa ghi xuất.
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/warehouse/ton',
  useSearchParams: () => new URLSearchParams('xem=lenh'),
}))
afterEach(cleanup)

const RO = (p: Partial<LenhDong['ro']>) => ({ con: false, han: false, xong: false, all: true, ...p }) // prettier-ignore
const LENH: LenhDong[] = [
  { id: 'yo', code: '01/26-27 - YOTRIO', khach: 'YOTRIO GROUP', xong: false, ship_date: '2026-10-10', xuat_cuoi: null, ma_ve: 41, xuat_du: 0, con_kho: 28, thieu: 2, het: 13, ro: RO({ con: true, han: true }) }, // prettier-ignore
  { id: 'mx6', code: '06/26-27 - MX', khach: 'MERXX HANDELS GMBH', xong: false, ship_date: '2026-11-29', xuat_cuoi: '2026-10-02', ma_ve: 113, xuat_du: 87, con_kho: 21, thieu: 1, het: 5, ro: RO({ con: true }) }, // prettier-ignore
  { id: 'mx8', code: '08/26-27 - MX', khach: 'MERXX HANDELS GMBH', xong: false, ship_date: '2026-11-29', xuat_cuoi: null, ma_ve: 12, xuat_du: 0, con_kho: 0, thieu: 0, het: 12, ro: RO({}) }, // prettier-ignore
  { id: 'mx5', code: '05/26-27 - MX', khach: 'MERXX HANDELS GMBH', xong: true, ship_date: '2026-09-13', xuat_cuoi: null, ma_ve: 3, xuat_du: 0, con_kho: 0, thieu: 0, het: 3, ro: RO({ xong: true }) }, // prettier-ignore
]
const c = (
  p: Partial<MaChiTiet> & Pick<MaChiTiet, 'material_id' | 'code'>,
): MaChiTiet => ({
  lsx_id: 'mx6',
  name: 'tên ' + p.code,
  unit: 'Cái',
  ve: 100,
  xuat: 0,
  con: 100,
  chia: 100,
  ton: 100,
  chung: [],
  ...p,
})
const CHI_TIET: MaChiTiet[] = [
  c({ material_id: 'a', code: 'BAO0483', ve: 8030, xuat: 7070, con: 960, chia: 960, ton: 1020, chung: ['09/26-27 - MX'] }), // prettier-ignore
  c({ material_id: 'b', code: 'THE0020', ve: 3930, xuat: 3050, con: 880, chia: 750, ton: 750 }), // prettier-ignore
  c({ material_id: 'd', code: 'NK-0044', con: 824, chia: 0, ton: 824, chung: ['01/26-27 - YOTRIO'] }), // prettier-ignore
  c({ material_id: 'e', code: 'BAO0689', ve: 380, xuat: 380, con: 0, chia: 0, ton: 0 }),
]

const dung = (ro: 'con' | 'han' | 'xong' | 'all' = 'con', mo: string | null = null) =>
  render(
    <ToastProvider>
      <TonLenhScreen lenh={LENH} chiTiet={CHI_TIET} ro={ro} mo={mo} today="2026-10-12" />
    </ToastProvider>,
  )

describe('TonLenhScreen', () => {
  it('rổ mặc định "Kho còn hàng của lệnh": 2 lệnh, YOTRIO ghi quá 2 ngày, nút Xuất cho lệnh', () => {
    dung()
    const bang = screen.getByRole('table')
    expect(within(bang).getAllByRole('row').length).toBe(1 + 2 + 1) // đầu + 2 lệnh + chân
    expect(within(bang).getByText('quá 2 ngày')).toBeTruthy()
    const nut = within(bang).getAllByRole('link', { name: /Xuất cho lệnh/ })
    expect(nut[0].getAttribute('href')).toBe('/warehouse/xuat?lsx=yo')
    expect(screen.getByRole('button', { name: /Tất cả\s*4/ })).toBeTruthy()
  })

  it('rổ "Lệnh xong chưa ghi xuất": 05-MX, có lời giải thích, KHÔNG có nút xuất', () => {
    dung('xong')
    const bang = screen.getByRole('table')
    expect(within(bang).getByText('05/26-27 - MX')).toBeTruthy()
    expect(within(bang).queryByRole('link', { name: /Xuất/ })).toBeNull()
    expect(screen.getByText(/Ghi xuất bù bây giờ sẽ làm/)).toBeTruthy()
  })

  it('ngăn chi tiết 06-MX: còn 2 mã (1 thiếu, 1 chung), kho hết nói vì sao, đã xuất đủ 1', () => {
    dung('con', 'mx6')
    const hop = screen.getByRole('dialog')
    expect(within(hop).getByText('thiếu 130')).toBeTruthy()
    expect(within(hop).getByText('chung 09-MX')).toBeTruthy()
    fireEvent.click(within(hop).getByRole('tab', { name: /Kho hết/ }))
    expect(within(hop).getByText('Kho còn 824, đang chia cho 01-YOTRIO')).toBeTruthy()
    fireEvent.click(within(hop).getByRole('tab', { name: /Đã xuất đủ/ }))
    expect(within(hop).getByText('BAO0689')).toBeTruthy()
    expect(within(hop).getByRole('link', { name: /Xuất cho lệnh này/ }).getAttribute('href')).toBe('/warehouse/xuat?lsx=mx6') // prettier-ignore
  })

  it('tìm không ra lệnh nào → Empty có lý do + nút xem tất cả', () => {
    dung()
    fireEvent.change(screen.getByPlaceholderText('Tìm lệnh, khách…'), {
      target: { value: 'không-có' },
    })
    expect(screen.getByText(/Không lệnh nào khớp/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Xem tất cả lệnh/ })).toBeTruthy()
  })
})
