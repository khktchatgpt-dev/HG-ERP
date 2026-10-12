// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ToastProvider } from '@/components/kit'
import { docInfoSchema } from '@/modules/dept/warehouse/warehouse.schema'
import { GhiSoNccSheet, LY_DO_BO_SUNG_SO_NCC } from './ghi-so-ncc'

/**
 * GHI SỐ PHIẾU NCC NGAY TẠI DÒNG SỔ (Kho đợt 2 · Bước 2b). Soi payload gửi lên
 * route sửa thông tin: chỉ đổi số phiếu NCC, kèm lý do qua được zod của route —
 * lý do ngắn hơn 3 ký tự thì route trả 400 và hộp vô dụng mà test không hay.
 */

const refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh, replace: vi.fn() }),
}))
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

function dung(onClose = vi.fn()) {
  render(
    <ToastProvider>
      <GhiSoNccSheet
        doc={{ id: 'doc-128', code: 'PNK-2026-0128', po_code: 'PO-2026-0090' }}
        onClose={onClose}
      />
    </ToastProvider>,
  )
  return onClose
}

describe('GhiSoNccSheet', () => {
  it('nút Lưu khoá khi chưa gõ, mở ngay khi gõ (không đợi rời ô)', () => {
    dung()
    const luu = screen.getByRole('button', { name: /Lưu số phiếu/ })
    expect(
      luu.getAttribute('aria-disabled') === 'true' || luu.hasAttribute('disabled'),
    ).toBe(true)
    fireEvent.change(screen.getByLabelText('Số phiếu giao của NCC'), {
      target: { value: 'HH-1110' },
    })
    expect(
      luu.getAttribute('aria-disabled') === 'true' || luu.hasAttribute('disabled'),
    ).toBe(false)
  })

  it('PATCH đúng route, chỉ số phiếu NCC + lý do qua được zod của route', async () => {
    api.mockResolvedValue({ changed: 1 })
    const onClose = dung()
    fireEvent.change(screen.getByLabelText('Số phiếu giao của NCC'), {
      target: { value: '  HH-1110 ' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Lưu số phiếu/ }))
    await waitFor(() => expect(api).toHaveBeenCalled())
    const [url, init] = api.mock.calls[0] as [string, { method: string; body: unknown }]
    expect(url).toBe('/api/dept/warehouse/docs/doc-128/thong-tin')
    expect(init.method).toBe('PATCH')
    expect(init.body).toEqual({
      supplier_doc_no: 'HH-1110',
      reason: LY_DO_BO_SUNG_SO_NCC,
    })
    expect(docInfoSchema.safeParse(init.body).success).toBe(true)
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(refresh).toHaveBeenCalled()
  })

  it('server từ chối thì nói lý do trong hộp, không đóng', async () => {
    const { ApiError } = await import('@/lib/api')
    api.mockRejectedValue(
      new ApiError(400, 'Phiếu PNK-2026-0128 đã bị đảo — hết hiệu lực, không sửa nữa'),
    )
    const onClose = dung()
    fireEvent.change(screen.getByLabelText('Số phiếu giao của NCC'), {
      target: { value: 'X1' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Lưu số phiếu/ }))
    expect(await screen.findByText(/đã bị đảo/)).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
  })
})
