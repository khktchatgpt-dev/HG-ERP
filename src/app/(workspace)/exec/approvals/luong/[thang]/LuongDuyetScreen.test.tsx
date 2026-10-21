// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ToastProvider } from '@/components/kit/Toast'
import { tongTheoKhoi } from '@/lib/luong/tong-duyet'
import type { DuyetLuongTrang } from '@/modules/dept/hr/luong/duyet-luong.service'
import { LuongDuyetScreen } from './LuongDuyetScreen'

/** Màn duyệt bảng lương của sếp (bản vẽ 21/10/2026) — dựng bằng số tổng kỳ 9 thật. */
const api = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('@/lib/api', () => ({
  api: (...a: unknown[]) => api(...a),
  ApiError: class extends Error {},
}))
afterEach(() => {
  cleanup()
  api.mockReset()
})

const { khoi, cong } = tongTheoKhoi(
  [
    { to: 'Tổ Phôi', tong: 195_381_709, thucLinh: 191_598_829 },
    { to: 'Kho', tong: 62_483_296, thucLinh: 60_305_296 },
  ],
  new Map([
    ['Tổ Phôi', 'ttsx'],
    ['Kho', 'gtsx'],
  ]),
  null,
)

const t = (x: Partial<DuyetLuongTrang> = {}): DuyetLuongTrang => ({
  thang: '2026-10',
  ky: { tu: '2026-09-26', den: '2026-10-25' },
  bang: {
    trangThai: 'submitted',
    lanTinh: 2,
    guiLuc: '2026-10-26T10:30:00Z',
    guiBoi: 'Đặng Như Phụng',
    duyetLuc: null,
    duyetBoi: null,
    chiLuc: null,
    lyDoTraLai: null,
  },
  khoi,
  cong,
  so: {
    nguoi: 2,
    tong: cong.tong,
    thucLinh: cong.thucLinh,
    bhNld: 3_780_840,
    coBh: 2,
    truocNguoi: null,
    truocThucLinh: null,
  },
  dieuKien: [{ ma: 'ho_so', ten: 'Hồ sơ lương', ok: true, chiTiet: 'đủ 2/2' }],
  ghiChuGui: 'Thêm bồi dưỡng Kho 10,15 tr',
  suKien: [
    { viec: 'submit', boi: 'Đặng Như Phụng', luc: '2026-10-26T10:30:00Z', ghiChu: null },
  ],
  quyen: { duyet: true, lyDo: null },
  ...x,
})

const dung = (x?: Partial<DuyetLuongTrang>) =>
  render(
    <ToastProvider>
      <LuongDuyetScreen t={t(x)} />
    </ToastProvider>,
  )

describe('LuongDuyetScreen', () => {
  it('bày tổng theo khối → tổ và ghi chú người gửi', () => {
    dung()
    expect(screen.getByText('Trực tiếp sản xuất')).toBeTruthy()
    expect(screen.getByText('Tổ Phôi')).toBeTruthy()
    expect(screen.getAllByText('191.598.829').length).toBeGreaterThan(0)
    expect(screen.getByText('Thêm bồi dưỡng Kho 10,15 tr')).toBeTruthy()
    expect(screen.getAllByText(/kỳ trước: chưa có trong ERP/).length).toBe(2)
  })

  it('trả lại bắt ghi lý do rồi mới gửi', async () => {
    dung()
    fireEvent.click(screen.getByText('Trả lại…'))
    fireEvent.click(screen.getByText('Trả lại cho người gửi'))
    expect(api).not.toHaveBeenCalled()
    expect(screen.getByText('Ghi lý do trước khi trả lại.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Lý do trả lại'), {
      target: { value: 'Kiểm lại tăng ca Tổ Phôi' },
    })
    fireEvent.click(screen.getByText('Trả lại cho người gửi'))
    expect(api).toHaveBeenCalledWith('/api/dept/hr/luong/bang/2026-10', {
      method: 'POST',
      body: { viec: 'quyet', dongY: false, lyDo: 'Kiểm lại tăng ca Tổ Phôi' },
    })
  })

  it('đã duyệt / tự mình gửi → không có nút, nói lý do tại chỗ', () => {
    dung({
      quyen: { duyet: false, lyDo: 'Đã duyệt bởi Vũ Phương Thảo.' },
    })
    expect(screen.queryByText('Duyệt bảng lương')).toBeNull()
    expect(screen.getByText('Đã duyệt bởi Vũ Phương Thảo.')).toBeTruthy()
  })

  it('chưa có bảng → rỗng nói lý do và việc tiếp', () => {
    dung({ bang: null, khoi: [], so: { ...t().so, nguoi: 0 } })
    expect(screen.getByText('Chưa có bảng lương kỳ 10/2026 để duyệt')).toBeTruthy()
  })
})
