// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ToastProvider } from '@/components/kit'
import { DeNghiScreen } from './DeNghiScreen'
import { phieuMoi } from './tai-phieu'
import type { PhieuForm } from './de-nghi.shared'

/**
 * ĐỀ NGHỊ MUA VẬT TƯ — màn lập phiếu (0236 · Đ1, bản vẽ DN-1). Dữ liệu theo tờ
 * giấy anh Hào gửi Zalo 13/10/2026.
 */

const replace = vi.fn()
const refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace, refresh }),
}))
const api = vi.fn()
vi.mock('@/lib/api', async (orig) => ({
  ...(await orig<typeof import('@/lib/api')>()),
  api: (...a: unknown[]) => api(...a),
}))
afterEach(() => {
  cleanup()
  api.mockReset()
  replace.mockReset()
  refresh.mockReset()
})

const dung = (phieu: PhieuForm, canManage = true) =>
  render(
    <ToastProvider>
      <DeNghiScreen phieu={phieu} lsx={[]} canManage={canManage} />
    </ToastProvider>,
  )

const daGui: PhieuForm = {
  ...phieuMoi('Lê Khắc Hào'),
  id: 'dn1',
  code: 'DNM-2026-0001',
  status: 'pending',
  submitted_at: '2026-10-13T06:12:00Z',
  created_at: '2026-10-13T06:10:00Z',
  lines: [
    { key: 'l1', material_id: 'm-keo', code: 'KEO0030', name: 'Băng keo trong 4F7', unit: 'Cuộn', ton: 36, qty: 200, unit_price: 5500, vat_rate: 8, purpose: 'Đóng gói', note: '', gia_goi_y: null }, // prettier-ignore
  ],
}

describe('DeNghiScreen', () => {
  it('phiếu mới: chưa có dòng thì nói vướng gì và khoá nút gửi', () => {
    dung(phieuMoi('Lê Khắc Hào'))
    expect(
      screen.getByRole('button', {
        name: /Chưa gửi được: Phiếu chưa có dòng vật tư nào/,
      }),
    ).toBeTruthy()
    const gui = screen.getAllByRole('button', { name: /Gửi lãnh đạo duyệt/ })
    expect(gui.some((b) => (b as HTMLButtonElement).disabled)).toBe(true)
  })

  it('dòng chưa có mã: gõ tên + ĐVT + SL → gửi được; lưu tạo phiếu rồi gửi duyệt', async () => {
    api.mockResolvedValueOnce({ id: 'dn9', code: 'DNM-2026-0009' }).mockResolvedValueOnce({ ok: true }) // prettier-ignore
    dung(phieuMoi('Lê Khắc Hào'))
    fireEvent.click(screen.getByRole('button', { name: /Dòng chưa có mã/ }))
    const ten = screen.getByLabelText('Tên vật tư dòng 1')
    fireEvent.change(ten, { target: { value: 'Giẻ lau' } })
    fireEvent.blur(ten)
    const dvt = screen.getByLabelText('ĐVT dòng 1')
    fireEvent.change(dvt, { target: { value: 'Kg' } })
    fireEvent.blur(dvt)
    const sl = screen.getByLabelText('Số lượng Giẻ lau')
    fireEvent.change(sl, { target: { value: '20' } })
    fireEvent.blur(sl)
    expect(screen.getAllByText('chưa có mã').length).toBeGreaterThan(0)
    const gui = screen.getAllByRole('button', { name: /Gửi lãnh đạo duyệt/ })
    fireEvent.click(gui[gui.length - 1])
    await waitFor(() => expect(api).toHaveBeenCalledTimes(2))
    expect(api.mock.calls[0][0]).toBe('/api/dept/warehouse/de-nghi')
    expect(api.mock.calls[0][1].body.lines).toEqual([
      { material_id: null, name: 'Giẻ lau', unit: 'Kg', qty: 20, unit_price: null, vat_rate: 0, purpose: null, note: null }, // prettier-ignore
    ])
    expect(api.mock.calls[1][0]).toBe('/api/dept/warehouse/de-nghi/dn9/gui')
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/warehouse/de-nghi/dn9'))
  })

  it('đã gửi: chỉ xem, có Rút về nháp + Chép đường dẫn, nói đang chờ duyệt', () => {
    dung(daGui)
    expect(screen.queryByLabelText(/Số lượng/)).toBeNull()
    expect(screen.getByRole('button', { name: /Rút về nháp/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Chép đường dẫn/ })).toBeTruthy()
    expect(screen.getByText(/Đã gửi lúc/)).toBeTruthy()
  })

  it('bị từ chối: hiện người từ chối + lý do để Kho sửa', () => {
    dung({
      ...daGui,
      status: 'draft',
      rejected_at: '2026-10-13T08:00:00Z',
      rejected_by_name: 'Alex',
      rejected_reason: 'Kiểm lại tồn găng tay',
    })
    expect(screen.getByText(/Kiểm lại tồn găng tay/)).toBeTruthy()
    expect(screen.getByText(/Alex từ chối/)).toBeTruthy()
  })
})
