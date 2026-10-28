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
 * ĐIỀU CHỈNH GIÁ ĐƠN ĐÃ VỀ ĐỦ (0280, 28/10/2026) — cùng nút Sửa, cùng hộp lý do
 * như điều chỉnh đơn đang chạy; chỉ khác: CHỈ đổi giá (`loiChiGia` chặn tại chỗ).
 * Fixture `ve-du` = PO-2026-0065 thật, 10 dòng đã nhập đủ.
 */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/mua-hang/don/x',
}))
vi.mock('@/lib/api', async (orig) => ({
  ...(await orig<typeof import('@/lib/api')>()),
  // Đơn gộp nhiều lệnh: Sửa nạp nhu cầu lệnh — trả đúng dạng route thật.
  api: vi.fn(async (path: string) =>
    String(path).includes('/needs') ? { needs: [] } : { seq: 1, delta_total: -1 },
  ),
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
const don = () => structuredClone(fixtures['ve-du']) as unknown as Props
const view = (p: Props) =>
  render(
    <UiToastProvider>
      <ToastProvider>
        <DonChungTuScreen {...p} />
      </ToastProvider>
    </UiToastProvider>,
  )
const so = (el: HTMLElement) => Number((el as HTMLInputElement).value.replace(/\./g, '').replace(',', '.')) // prettier-ignore
function moSua(p: Props) {
  view(p)
  fireEvent.click(screen.getByRole('button', { name: 'Sửa' }))
  fireEvent.mouseDown(screen.getByRole('tab', { name: /Dòng hàng/ }), { button: 0 })
}
function go(el: HTMLElement, v: string) {
  fireEvent.focus(el)
  fireEvent.change(el, { target: { value: v } })
  fireEvent.blur(el)
}

describe('Màn đơn về đủ — điều chỉnh giá', () => {
  it('Sửa mở được lưới dòng; đổi giá → Lưu → hộp nguyên nhân như cũ → gửi route điều chỉnh', async () => {
    const p = don()
    expect(p.po!.status).toBe('received')
    moSua(p)
    const first = p.lines[0]
    // Đơn USD: ô giá hiện số Anh (2.15) — tìm theo nhãn ô, không theo giá trị.
    const gia = screen.getAllByLabelText('Đơn giá')[0] as HTMLInputElement
    expect(Number(gia.value)).toBe(Number(first.unit_price))
    go(gia, '2.05')
    fireEvent.click(screen.getAllByRole('button', { name: /^Lưu/ })[0])

    const dlg = await screen.findByRole('dialog')
    fireEvent.click(within(dlg).getByLabelText(/NCC đổi giá/))
    fireEvent.change(within(dlg).getByLabelText('Ghi chú điều chỉnh'), {
      target: { value: 'Theo bảng đối chiếu công nợ T10' },
    })
    fireEvent.click(within(dlg).getByRole('button', { name: 'Áp dụng' }))

    await waitFor(() =>
      expect(vi.mocked(api)).toHaveBeenCalledWith(
        `/api/dept/supply/pos/${p.po!.id}/adjustments`,
        expect.objectContaining({
          method: 'POST',
          body: expect.objectContaining({ cause: 'ncc_doi', reason: 'Theo bảng đối chiếu công nợ T10' }), // prettier-ignore
        }),
      ),
    )
    const body = vi.mocked(api).mock.calls.find((c) => String(c[0]).endsWith('/adjustments'))![1] as { body: { lines: { id: string; unit_price: number }[] } } // prettier-ignore
    expect(body.body.lines.find((l) => l.id === first.id)?.unit_price).toBe(2.05)
  })

  it('đổi SL → chặn ngay tại chỗ, nói lệch số lượng là việc của Kho; không gọi route', async () => {
    const p = don()
    moSua(p)
    const first = p.lines[0]
    const sl = screen
      .getAllByRole('textbox')
      .find((el) => so(el) === Number(first.qty_ordered))!
    go(sl, '1400')
    expect(await screen.findByText(/SL giữ theo phiếu nhập/)).toBeTruthy()
    expect(vi.mocked(api).mock.calls.some((c) => String(c[0]).endsWith('/adjustments'))).toBe(false) // prettier-ignore
  })
})
