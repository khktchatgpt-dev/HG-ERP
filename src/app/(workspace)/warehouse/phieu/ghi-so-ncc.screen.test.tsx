// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { docInfoSchema } from '@/modules/dept/warehouse/warehouse.schema'
import { OSoNcc, LY_DO_BO_SUNG_SO_NCC } from './ghi-so-ncc'

/**
 * GHI SỐ PHIẾU NCC NGAY TRONG Ô CỦA DÒNG SỔ (Kho lối ERP · B4). Soi payload gửi
 * lên route sửa thông tin: chỉ đổi số phiếu NCC, kèm lý do qua được zod của
 * route — lý do ngắn hơn 3 ký tự thì route trả 400 mà test không hay.
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

const o = () => screen.getByLabelText('Số phiếu giao NCC của PNK-2026-0128')
function dung(onXong = vi.fn()) {
  render(<OSoNcc doc={{ id: 'doc-128', code: 'PNK-2026-0128' }} onXong={onXong} />)
  return onXong
}

describe('OSoNcc', () => {
  it('ô trống: Enter không gửi gì', () => {
    dung()
    fireEvent.keyDown(o(), { key: 'Enter' })
    expect(api).not.toHaveBeenCalled()
  })

  it('gõ rồi Enter: PATCH đúng route, chỉ số phiếu NCC + lý do qua được zod; xong thì báo màn + làm mới', async () => {
    api.mockResolvedValue({ changed: 1 })
    const onXong = dung()
    fireEvent.change(o(), { target: { value: '  HH-1110 ' } })
    fireEvent.keyDown(o(), { key: 'Enter' })
    await waitFor(() => expect(api).toHaveBeenCalled())
    const [url, init] = api.mock.calls[0] as [string, { method: string; body: unknown }]
    expect(url).toBe('/api/dept/warehouse/docs/doc-128/thong-tin')
    expect(init.method).toBe('PATCH')
    expect(init.body).toEqual({
      supplier_doc_no: 'HH-1110',
      reason: LY_DO_BO_SUNG_SO_NCC,
    })
    expect(docInfoSchema.safeParse(init.body).success).toBe(true)
    await waitFor(() => expect(onXong).toHaveBeenCalled())
    expect(refresh).toHaveBeenCalled()
    expect(await screen.findByText('HH-1110')).toBeTruthy()
  })

  it('server từ chối thì nói lý do ngay dưới ô, ô còn nguyên', async () => {
    const { ApiError } = await import('@/lib/api')
    api.mockRejectedValue(
      new ApiError(400, 'Phiếu PNK-2026-0128 đã bị đảo — hết hiệu lực, không sửa nữa'),
    )
    const onXong = dung()
    fireEvent.change(o(), { target: { value: 'X1' } })
    fireEvent.keyDown(o(), { key: 'Enter' })
    expect(await screen.findByText(/đã bị đảo/)).toBeTruthy()
    expect(onXong).not.toHaveBeenCalled()
    expect((o() as HTMLInputElement).value).toBe('X1')
  })
})
