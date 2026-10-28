// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { ApiError } from '@/lib/api'
import { DEFAULT_DOC_TEMPLATES } from '@/lib/doc-templates'
import type { VatTuTon } from '@/lib/kho-chon-vat-tu'
import { XuatScreen } from './XuatScreen'

/**
 * LỖI CŨ CHE CÂU CHẶN MỚI (bắt khi chạy kịch bản thử Kho bằng admin 28/10/2026):
 * lần ghi trước bị máy chủ từ chối → thanh đáy "Chưa ghi sổ được: …". Sửa phiếu
 * thành sai ở chỗ khác rồi bấm Ghi sổ lần nữa thì thanh đáy PHẢI nói chỗ sai mới,
 * không được giữ câu của máy chủ lần trước. Cùng lỗi đã vá ở Cập nhật số thực tế.
 */

const api = vi.fn()
vi.mock('@/lib/api', async (orig) => ({
  ...(await orig<typeof import('@/lib/api')>()),
  api: (...a: unknown[]) => api(...a),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  // Mở từ Tồn kho theo lệnh: lệnh chọn sẵn.
  useSearchParams: () => new URLSearchParams('lsx=l-mx9'),
}))
afterEach(() => {
  cleanup()
  api.mockReset()
})

const TON: VatTuTon[] = [
  { id: 'm513', code: 'NH-0513', name: 'Nhôm vuông 20 x 20 T1.0', unit: 'Cây', qty_ok: 753, ke: 'NHOM-A', nhom: 'Nhôm' }, // prettier-ignore
]

describe('Xuất hàng · lỗi máy chủ lần trước không che câu chặn mới', () => {
  it('máy chủ từ chối → sửa số về 0 → thanh đáy nói "chưa dòng nào có số", không còn lỗi cũ', async () => {
    api.mockImplementation((url: string, init?: { method?: string }) =>
      init?.method === 'POST'
        ? Promise.reject(
            new ApiError(409, 'Vượt tồn khả dụng — phần này đang giữ cho LSX khác'),
          )
        : Promise.resolve({ rows: [] }),
    )
    render(
      <XuatScreen
        lsx={[{ id: 'l-mx9', code: '09/26-27 - MX', customer_name: 'MERXX', order_codes: [], status: 'approved', ship_date: null }]} // prettier-ignore
        to={['Tổ Hàn']}
        phong={['Kho']}
        tonSan={TON}
        today="2026-10-28"
        nguoiLap="Lê Khắc Hào"
        canEdit
        company={{}}
        tpl={DEFAULT_DOC_TEMPLATES.PXK}
      />,
    )
    fireEvent.click(screen.getByRole('radio', { name: 'Hàn' }))
    const tim = screen.getByRole('combobox', { name: 'Tìm vật tư để thêm dòng' })
    fireEvent.focus(tim)
    fireEvent.change(tim, { target: { value: 'NH-0513' } })
    fireEvent.keyDown(tim, { key: 'Enter' })
    const so = document.getElementById('xuat-qty-0') as HTMLInputElement
    fireEvent.change(so, { target: { value: '120' } })
    fireEvent.blur(so)

    const thanh = () => screen.getByRole('group', { name: 'Ghi sổ phiếu xuất' })
    fireEvent.click(within(thanh()).getByRole('button', { name: 'Ghi sổ' }))
    expect(
      await within(thanh()).findByText(/Chưa ghi sổ được: Vượt tồn khả dụng/),
    ).toBeTruthy()

    // Lần 2: số về 0 → chặn tại máy, câu mới thay câu cũ.
    fireEvent.change(so, { target: { value: '0' } })
    fireEvent.blur(so)
    fireEvent.click(within(thanh()).getByRole('button', { name: 'Ghi sổ' }))
    expect(within(thanh()).queryByText(/Vượt tồn khả dụng/)).toBeNull()
    expect(within(thanh()).getByText(/Chưa dòng nào có số Lần này/)).toBeTruthy()
  })
})
