// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { KiemKyHien, KiemThangHien } from '@/modules/dept/warehouse/nxt.service'
import { DongChuaChot, KiemKyHop } from './kiem-ky'

/**
 * KIỂM TRƯỚC KHI CHỐT KỲ (B1, bản vẽ 13/11/2026 khung 1 + 2). Số rút từ sổ thật
 * 13/11/2026 khi xem tháng 10: 13/15 lệnh nhận hàng chưa có phiếu xuất, BAO0766
 * chưa có giá, 107 dòng xuất cho lệnh, 51 dòng KK thừa.
 */
afterEach(cleanup)

const thang = (t: string, p: Partial<KiemThangHien> = {}): KiemThangHien => ({
  thang: t,
  den: `${t}-30`,
  tonAm: [],
  lenhNhan: 0,
  lenhChuaXuat: [],
  maThieuGia: [],
  dongThieuTyGia: 0,
  dongXuat: 0,
  dongXuatTheoCot: { choLenh: 0, kkThieu: 0, xuatKhac: 0 },
  dongKkThua: 0,
  gtXuat: 0,
  gtTonCuoi: 0,
  ...p,
})

const vt = (code: string, name = `Vật tư ${code}`) => ({ id: code, code, name })

const thang10: KiemKyHien = {
  den: '2026-10-31',
  dotMo: [],
  soChan: 0,
  tong: { lenhChuaXuat: 13, maThieuGia: 5, dongThieuTyGia: 0 },
  thangs: [
    thang('2026-09', {
      maThieuGia: [vt('BAO0692'), vt('BAO0693'), vt('CN1552'), vt('VT-NK-001')],
      dongXuat: 107,
      dongXuatTheoCot: { choLenh: 0, kkThieu: 107, xuatKhac: 0 },
      gtXuat: 4_270_680_476,
      gtTonCuoi: 77_223_916,
    }),
    thang('2026-10', {
      den: '2026-10-31',
      lenhNhan: 15,
      lenhChuaXuat: [
        { id: 'l1', code: '02/26-27 - ROSCO' },
        { id: 'l2', code: '09/26-27 - MX' },
      ],
      maThieuGia: [vt('BAO0766', 'BB bàn Elos')],
      dongXuat: 107,
      dongXuatTheoCot: { choLenh: 107, kkThieu: 0, xuatKhac: 0 },
      dongKkThua: 51,
      gtXuat: 338_798_111,
      gtTonCuoi: 4_118_042_091,
    }),
  ],
}

describe('Dòng "Chưa chốt" trên Báo cáo tháng', () => {
  it('đếm bằng chính số của hộp kiểm và mở hộp', () => {
    const onMo = vi.fn()
    render(<DongChuaChot kk={thang10} onMo={onMo} />)
    const dong = screen.getByRole('status')
    expect(dong.textContent).toContain('13 lệnh nhận hàng chưa có phiếu xuất')
    expect(dong.textContent).toContain('5 mã chưa có giá')
    expect(dong.textContent).not.toContain('điều kiện chặn')
    fireEvent.click(screen.getByRole('button', { name: 'Danh sách kiểm' }))
    expect(onMo).toHaveBeenCalled()
  })

  it('không còn gì thì nói thẳng', () => {
    render(
      <DongChuaChot
        kk={{ ...thang10, tong: { lenhChuaXuat: 0, maThieuGia: 0, dongThieuTyGia: 0 } }}
        onMo={() => {}}
      />,
    )
    expect(screen.getByRole('status').textContent).toContain('không còn gì phải soát')
  })
})

describe('Hộp danh sách kiểm (B1 — chỉ đọc)', () => {
  it('Q6: tháng trước còn mở thì nói chốt luôn; B1 không có nút Chốt', () => {
    render(<KiemKyHop kk={thang10} onClose={() => {}} />)
    const hop = screen.getByRole('dialog', { name: 'Chốt sổ kho đến hết 31/10/2026' })
    expect(hop.textContent).toContain(
      'Tháng 09/2026 chưa chốt — chốt lần này khoá cả 09, 10/2026, mỗi tháng một bản chốt.',
    )
    expect(within(hop).queryByRole('button', { name: /^Chốt/ })).toBeNull()
    // ✕ ở đầu hộp + nút Đóng ở chân — chân hộp không còn nút nào khác.
    expect(within(hop).getAllByRole('button', { name: 'Đóng' })).toHaveLength(2)
  })

  it('đạt gộp một dòng; lệnh chưa xuất kèm tên lệnh và đường sang Tồn theo lệnh', () => {
    render(<KiemKyHop kk={thang10} onClose={() => {}} />)
    const ds = screen.getByRole('list', { name: 'Kiểm trước khi chốt' })
    const dong = within(ds).getAllByRole('listitem')
    expect(dong[0].textContent).toContain('0 mã tồn âm cuối tháng')
    expect(dong[1].textContent).toContain('2 / 15 lệnh nhận hàng trong tháng mà chưa có phiếu xuất') // prettier-ignore
    expect(dong[1].textContent).toContain('02/26-27 - ROSCO, 09/26-27 - MX')
    expect(
      within(dong[1]).getByRole('link', { name: 'Tồn theo lệnh' }).getAttribute('href'),
    ).toBe('/warehouse/ton?xem=lenh')
  })

  it('mã chưa có giá: ≤ 3 mã bày luôn, nhiều hơn thì bấm Xem', () => {
    render(<KiemKyHop kk={thang10} onClose={() => {}} />)
    expect(screen.getByText('BAO0766')).toBeTruthy()
    expect(screen.queryByText('CN1552')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Xem 4 mã' }))
    expect(screen.getByText('CN1552')).toBeTruthy()
  })

  it('tóm tắt bản chốt từng tháng, cột xuất ghi rõ loại khi chỉ có một loại', () => {
    render(<KiemKyHop kk={thang10} onClose={() => {}} />)
    const hang = screen.getAllByRole('row')
    expect(hang[1].textContent).toContain('09/2026')
    expect(hang[1].textContent).toContain('107 (KK thiếu)')
    expect(hang[2].textContent).toContain('107 (cho lệnh)')
    expect(hang[2].textContent).toContain('51')
    expect(hang[2].textContent).toContain('338.798.111')
    expect(hang[2].textContent).toContain('4.118.042.091')
  })

  it('chặn: mã tồn âm và đợt kiểm kê đang đếm có mốc trong kỳ, kèm đường gỡ', () => {
    const kk: KiemKyHien = {
      ...thang10,
      soChan: 2,
      dotMo: [
        {
          id: 'kk9',
          code: 'KK-2026-0009',
          status: 'counting',
          freeze_ngay: '2026-10-28',
        },
      ],
      thangs: [
        thang('2026-10', { den: '2026-10-31', tonAm: [vt('BUL0085'), vt('BUL0089')] }),
      ],
    }
    render(<KiemKyHop kk={kk} onClose={() => {}} />)
    const dong = within(screen.getByRole('list', { name: 'Kiểm trước khi chốt' })).getAllByRole('listitem') // prettier-ignore
    expect(dong[0].textContent).toContain('2 mã tồn âm cuối 31/10')
    expect(dong[1].textContent).toContain('KK-2026-0009 đang đếm, chốt sổ 28/10/2026')
    expect(
      within(dong[1]).getByRole('link', { name: 'Mở đợt' }).getAttribute('href'),
    ).toBe('/warehouse/kiem-ke/kk9')
    expect(screen.queryByText(/0 mã tồn âm/)).toBeNull()
  })
})
