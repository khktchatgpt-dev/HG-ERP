// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { ToastProvider } from '@/components/kit'
import type { DeNghiChiTiet } from '@/modules/dept/warehouse/de-nghi.service'
import { DuyetDeNghiScreen } from './DuyetDeNghiScreen'

/**
 * DUYỆT ĐỀ NGHỊ MUA (0236 · Đ2, bản vẽ DN-2) — dữ liệu theo tờ giấy Kho vật tư
 * gửi Zalo 13/10/2026 (rút gọn 2 dòng).
 */

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh }) }))
const api = vi.fn()
vi.mock('@/lib/api', async (orig) => ({
  ...(await orig<typeof import('@/lib/api')>()),
  api: (...a: unknown[]) => api(...a),
}))
afterEach(() => {
  cleanup()
  api.mockReset()
  refresh.mockReset()
})

const P: DeNghiChiTiet = {
  id: 'dn1',
  code: 'DNM-2026-0001',
  status: 'pending',
  department: 'Kho vật tư',
  requested_by: 'u-hao',
  need_by: '2026-10-17',
  note: 'Cấp phục vụ sản xuất',
  production_order_id: null,
  submitted_at: '2026-10-13T06:12:00Z',
  approved_at: null,
  rejected_at: null,
  rejected_reason: null,
  cancelled_at: null,
  cancel_reason: null,
  created_by: 'u-hao',
  created_at: '2026-10-13T06:10:00Z',
  updated_at: '2026-10-13T06:12:00Z',
  requested_by_name: 'Lê Khắc Hào',
  approved_by_name: null,
  rejected_by_name: null,
  lsx_code: null,
  lines: [
    { id: 'l1', line_no: 1, material_id: 'm1', code: 'BHL0006', name: 'Găng tay len 50gr', unit: 'Đôi', qty: 80, approved_qty: null, unit_price: 5000, purpose: 'Phục vụ sản xuất', note: null, po_line_id: null, ton: 0, gia_gan_nhat: null }, // prettier-ignore
    { id: 'l2', line_no: 2, material_id: null, code: null, name: 'Giẻ lau', unit: 'Kg', qty: 20, approved_qty: null, unit_price: null, purpose: 'Tổ sơn', note: null, po_line_id: null, ton: null, gia_gan_nhat: null }, // prettier-ignore
  ],
}

const dung = (p: DeNghiChiTiet = P, canApprove = true) =>
  render(
    <ToastProvider>
      <DuyetDeNghiScreen phieu={p} canApprove={canApprove} />
    </ToastProvider>,
  )

describe('DuyetDeNghiScreen', () => {
  it('bày đủ cho người duyệt: tên · số · tồn (tô khi 0) · mục đích · dự kiến; dòng chưa giá nói rõ', () => {
    dung()
    expect(screen.getByText('Găng tay len 50gr')).toBeTruthy()
    expect(screen.getByText(/tồn 0/)).toBeTruthy()
    expect(screen.getByText('chưa có giá')).toBeTruthy()
    expect(screen.getAllByText(/400\.000 đ/).length).toBeGreaterThan(0)
  })

  it('sửa số 80 → 50 rồi duyệt: chỉ gửi dòng bị sửa', async () => {
    api.mockResolvedValue({ ok: true })
    dung()
    const o = screen.getByLabelText('Số duyệt BHL0006')
    fireEvent.change(o, { target: { value: '50' } })
    fireEvent.blur(o)
    expect(screen.getByText(/đề nghị 80/)).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: /Duyệt \(sửa 1 dòng\)/ })[0])
    await waitFor(() => expect(api).toHaveBeenCalled())
    expect(api.mock.calls[0]).toEqual([
      '/api/dept/warehouse/de-nghi/dn1/duyet',
      {
        method: 'POST',
        body: { decision: 'approve', lines: [{ id: 'l1', approved_qty: 50 }] },
      },
    ])
  })

  it('từ chối bắt lý do ≥ 3 ký tự rồi mới gửi', async () => {
    api.mockResolvedValue({ ok: true })
    dung()
    fireEvent.click(screen.getAllByRole('button', { name: 'Từ chối' })[0])
    const hop = screen.getByRole('alertdialog')
    const gui = within(hop).getByRole('button', {
      name: /Gửi từ chối/,
    }) as HTMLButtonElement
    expect(gui.disabled).toBe(true)
    fireEvent.change(within(hop).getByLabelText('Lý do từ chối'), {
      target: { value: 'Kiểm lại tồn găng tay' },
    })
    fireEvent.click(within(hop).getByRole('button', { name: /Gửi từ chối/ }))
    await waitFor(() => expect(api).toHaveBeenCalled())
    expect(api.mock.calls[0][1].body).toEqual({
      decision: 'reject',
      reason: 'Kiểm lại tồn găng tay',
    })
  })

  it('không có quyền duyệt / phiếu đã duyệt: chỉ xem, không nút', () => {
    dung(P, false)
    expect(screen.queryByRole('button', { name: /^Duyệt/ })).toBeNull()
    expect(screen.getByText(/không duyệt được/)).toBeTruthy()
    cleanup()
    dung({ ...P, status: 'approved', approved_at: '2026-10-13T07:02:00Z', approved_by_name: 'Alex', lines: [{ ...P.lines[0], approved_qty: 50 }] }) // prettier-ignore
    expect(screen.queryByRole('button', { name: 'Từ chối' })).toBeNull()
    expect(screen.getByText(/Alex duyệt lúc/)).toBeTruthy()
    expect(screen.getByText('50')).toBeTruthy()
  })
})
