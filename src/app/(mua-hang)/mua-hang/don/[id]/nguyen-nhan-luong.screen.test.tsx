// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { ToastProvider } from '@/components/kit'
import { ToastProvider as UiToastProvider } from '@/components/ui/Toast'
import { api } from '@/lib/api'
import fixtures from '@/test/fixtures/don-chi-tiet.json'
import { DonChungTuScreen } from './DonChungTuScreen'

/**
 * NGUYÊN NHÂN ĐIỀU CHỈNH TRÊN MÀN ĐƠN THẬT (0227, 07/10/2026).
 *
 * Đơn đã gửi NCC gắn lệnh 02/26-27 ROSCO (fixture `da-gui`): Sửa → đổi SL →
 * Lưu → hộp Áp dụng có khối Nguyên nhân; chọn "Khách đổi đơn" thì lệnh ROSCO
 * chọn sẵn kèm lần đổi của đơn khách; Áp dụng gửi `cause` + `lsx_ids`. Lịch sử
 * ở mục Tài chính bày nhãn nguyên nhân + lệnh, bản ghi cũ "Chưa phân loại".
 */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/mua-hang/don/x',
}))
vi.mock('@/lib/api', async (orig) => ({
  ...(await orig<typeof import('@/lib/api')>()),
  api: vi.fn(async () => ({ seq: 1, delta_total: -1 })),
}))
beforeEach(() => {
  localStorage.clear()
  vi.mocked(api).mockClear()
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(JSON.stringify({ notes: [] })))),
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

type Props = Parameters<typeof DonChungTuScreen>[0]
const ROSCO = 'ade0b4a0-ad23-4302-b7f5-b95bcba2ee0c'
function don(over: Partial<Props> = {}): Props {
  const p = structuredClone(fixtures['da-gui']) as unknown as Props
  // Lệnh của đơn phải có trong danh sách lệnh đang chạy để hộp có nhãn.
  p.lsxs = [...p.lsxs, { id: ROSCO, code: '02/26-27 - ROSCO', customer_name: 'ROSCO', order_codes: [] }] as Props['lsxs'] // prettier-ignore
  return {
    ...p,
    lsxLastChange: {
      [ROSCO]: { order_code: 'ROSCO IBIZA 02/26-27', at: '2026-10-05T07:41:19Z', note: 'Bản 2: về đúng ORDERED QTY' }, // prettier-ignore
    },
    ...over,
  }
}
const view = (p: Props) =>
  render(
    <UiToastProvider>
      <ToastProvider>
        <DonChungTuScreen {...p} />
      </ToastProvider>
    </UiToastProvider>,
  )

describe('Màn đơn — nguyên nhân điều chỉnh', () => {
  it('Sửa → đổi SL → Lưu: hộp hỏi nguyên nhân, Áp dụng gửi cause + lệnh', async () => {
    const p = don()
    view(p)
    fireEvent.click(screen.getByRole('button', { name: 'Sửa' }))
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Dòng hàng/ }), { button: 0 })
    const first = p.lines[0]
    const qty = screen
      .getAllByRole('textbox')
      .find((el) => (el as HTMLInputElement).value.replace(/\./g, '') === String(first.qty_ordered))! // prettier-ignore
    expect(qty).toBeTruthy()
    fireEvent.focus(qty)
    fireEvent.change(qty, { target: { value: '18000' } })
    fireEvent.blur(qty)
    fireEvent.click(screen.getAllByRole('button', { name: /^Lưu/ })[0])

    const dlg = await screen.findByRole('dialog')
    const nut = within(dlg).getByRole('button', { name: 'Áp dụng' }) as HTMLButtonElement
    expect(nut.disabled).toBe(true)
    expect(within(dlg).getByText(/Chọn nguyên nhân để kế toán/)).toBeTruthy()

    fireEvent.click(within(dlg).getByLabelText(/Khách đổi đơn/))
    expect(within(dlg).getByText(/ROSCO IBIZA 02\/26-27 đổi gần nhất/)).toBeTruthy()
    expect((within(dlg).getByLabelText('Chọn lệnh 02/26-27 - ROSCO') as HTMLInputElement).checked).toBe(true) // prettier-ignore
    fireEvent.change(within(dlg).getByLabelText('Ghi chú điều chỉnh'), {
      target: { value: 'Khách giảm 86 bộ sofa' },
    })
    expect(nut.disabled).toBe(false)
    fireEvent.click(nut)

    await waitFor(() =>
      expect(vi.mocked(api)).toHaveBeenCalledWith(
        `/api/dept/supply/pos/${p.po!.id}/adjustments`,
        expect.objectContaining({
          method: 'POST',
          body: expect.objectContaining({
            cause: 'khach_doi',
            lsx_ids: [ROSCO],
            reason: 'Khách giảm 86 bộ sofa',
          }),
        }),
      ),
    )
  })

  it('lịch sử ở Tài chính: nhãn nguyên nhân + lệnh; bản cũ "Chưa phân loại"', () => {
    const base = { currency: 'VND', created_by_name: 'Nga', subtotal_before: 100, subtotal_after: 90, vat_before: 8, vat_after: 7.2, total_before: 108, total_after: 97.2, delta_by_price: 0, delta_by_qty: -10, lines: [], sent_at: null, sent_by_name: null, sent_note: null } // prettier-ignore
    view(
      don({
        adjustments: [
          { ...base, seq: 1, reason: 'khách thay đổi sản phẩm khác.', created_at: '2026-10-02T02:28:55Z', cause: null }, // prettier-ignore
          { ...base, seq: 2, reason: 'Khách giảm 86 bộ', created_at: '2026-10-07T07:00:00Z', cause: 'khach_doi', lsx: [{ id: ROSCO, code: '02/26-27 - ROSCO', orders: ['ROSCO IBIZA 02/26-27'] }] }, // prettier-ignore
        ],
      }),
    )
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Tài chính/ }), { button: 0 })
    expect(screen.getByText('Chưa phân loại')).toBeTruthy()
    expect(screen.getByText('Khách đổi đơn')).toBeTruthy()
    expect(
      screen.getByRole('link', { name: '02/26-27 - ROSCO' }).getAttribute('href'),
    ).toBe(`/mua-hang/yeu-cau/${ROSCO}`)
  })
})
