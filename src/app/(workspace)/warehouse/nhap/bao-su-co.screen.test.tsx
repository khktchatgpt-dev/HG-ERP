// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ToastProvider } from '@/components/kit'
import { issueSchema } from '@/modules/dept/supply/po-tracking.schema'
import { BaoSuCoSheet } from './bao-su-co'

/**
 * BÁO SỰ CỐ GIAO HÀNG (Kho đợt 2 · Bước 3, bản vẽ B3-2). Dữ liệu PO-2026-0090 thật
 * (Hiệp Hưng, 25 dòng bao bì — lấy 2 dòng). Soi thân gửi lên route có sẵn
 * `POST pos/[id]/issues`: từ chối nhận thì mô tả mang chữ đầu, và thân qua zod.
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

const L1 = '91934f48-4e79-4710-9d38-05c20c6c515a'
const DATA = {
  po: {
    id: '1c82abc0-fe73-44b5-b45f-02749a9ac6c3',
    code: 'PO-2026-0090',
    status: 'partial',
    supplier_name: 'CÔNG TY TNHH HIỆP HƯNG',
    lsx_code: '02/26-27 - ROSCO',
    extra_lsx: [],
    expected_at: '2026-10-08',
    assignee_name: 'Đặng Thị Thanh Nga',
  },
  lines: [
    { id: L1, code: 'BAO0716', name: 'Thùng SOLE 5 lớp Arm Chair, tai 12cm KTLL 78', unit: 'Thùng', ordered: 2814, received: 0, open: 2814, closed_short: false, dots: [] }, // prettier-ignore
    { id: 'l2', code: 'BAO0717', name: 'Thanh V 76x5x5cm dày 5mm', unit: 'Thanh', ordered: 11256, received: 0, open: 11256, closed_short: false, dots: [] }, // prettier-ignore
  ],
}

function dung(onClose = vi.fn()) {
  render(
    <ToastProvider>
      <BaoSuCoSheet data={DATA} onClose={onClose} />
    </ToastProvider>,
  )
  return onClose
}
const nutBao = () => screen.getByRole('button', { name: /Báo sự cố/ })
const khoa = (b: HTMLElement) => b.getAttribute('aria-disabled') === 'true' || b.hasAttribute('disabled') // prettier-ignore

describe('BaoSuCoSheet', () => {
  it('khoá tới khi có loại + mô tả ≥ 5 ký tự; nói rõ thiếu gì', () => {
    dung()
    expect(khoa(nutBao())).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Hàng hỏng / lỗi' }))
    expect(screen.getByText('Chưa báo được: Mô tả sự cố ít nhất 5 ký tự')).toBeTruthy()
    fireEvent.change(screen.getByPlaceholderText(/Thấy gì/), {
      target: { value: 'Thùng ướt' },
    })
    expect(khoa(nutBao())).toBe(false)
  })

  /* K3 (28/10/2026): mở hộp ra nút Báo xám, bấm không phản hồi, không câu nào nói
     thiếu gì. Nay câu chặn có ngay từ đầu; bấm thì báo lại + nhảy tới chỗ phải điền. */
  it('mới mở hộp đã nói thiếu gì; bấm Báo khi còn thiếu → không gửi, con trỏ tới chỗ phải điền', () => {
    dung()
    expect(screen.getByText('Chưa báo được: Chọn loại sự cố')).toBeTruthy()
    expect(nutBao().hasAttribute('disabled')).toBe(false) // bấm được để hỏi "vì sao"
    fireEvent.click(nutBao())
    expect(api).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toBe('Chưa báo được: Chọn loại sự cố')
    expect(document.activeElement?.textContent).toBe('Sai quy cách / sai mã') // nút loại đầu tiên
    fireEvent.click(screen.getByRole('button', { name: 'Giao thiếu' }))
    fireEvent.click(nutBao())
    expect(document.activeElement).toBe(screen.getByPlaceholderText(/Thấy gì/))
    expect(api).not.toHaveBeenCalled()
  })

  it('từ chối nhận cả lô: POST đúng route, mô tả mang [Từ chối nhận], dòng + SL', async () => {
    api.mockResolvedValue({ id: 'i1' })
    const onClose = dung()
    fireEvent.click(screen.getByRole('radio', { name: /Từ chối nhận cả lô/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Hàng hỏng / lỗi' }))
    fireEvent.change(screen.getByRole('combobox'), { target: { value: L1 } })
    fireEvent.change(screen.getByPlaceholderText('không bắt buộc'), {
      target: { value: '140' },
    })
    fireEvent.change(screen.getByPlaceholderText(/Thấy gì/), {
      target: { value: 'Thùng bị ướt, móp góc khoảng 140/2.814 thùng' },
    })
    expect(screen.getByText(/báo cho Đặng Thị Thanh Nga/)).toBeTruthy()
    fireEvent.click(nutBao())
    await waitFor(() => expect(api).toHaveBeenCalled())
    const [url, init] = api.mock.calls[0] as [string, { method: string; body: unknown }]
    expect(url).toBe('/api/dept/supply/pos/1c82abc0-fe73-44b5-b45f-02749a9ac6c3/issues')
    expect(init.method).toBe('POST')
    expect(init.body).toEqual({
      kind: 'hong_loi',
      po_line_id: L1,
      qty: 140,
      description: '[Từ chối nhận] Thùng bị ướt, móp góc khoảng 140/2.814 thùng',
    })
    expect(issueSchema.safeParse(init.body).success).toBe(true)
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(refresh).toHaveBeenCalled()
  })

  it('server từ chối (đơn chưa gửi NCC…) thì nói tại hộp, không đóng', async () => {
    const { ApiError } = await import('@/lib/api')
    api.mockRejectedValue(
      new ApiError(400, 'Đơn chưa gửi NCC — chưa có gì giao để ghi sự cố'),
    )
    const onClose = dung()
    fireEvent.click(screen.getByRole('button', { name: 'Giao thiếu' }))
    fireEvent.change(screen.getByPlaceholderText(/Thấy gì/), {
      target: { value: 'Thiếu 2 thùng' },
    })
    fireEvent.click(nutBao())
    expect(await screen.findByText(/Đơn chưa gửi NCC/)).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
  })
})
