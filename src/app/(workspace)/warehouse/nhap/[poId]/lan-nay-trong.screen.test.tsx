// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ToastProvider } from '@/components/kit'
import type { DongNhan } from '@/lib/kho-phieu-nhap'
import fixtures from '@/test/fixtures/nhan-hang.json'
import { PhieuNhapScreen } from './PhieuNhapScreen'

/**
 * K1 (28/10/2026, chạy kịch bản thử Kho): phiếu nhập từng điền sẵn đủ "còn chờ"
 * vào cột Lần này — thủ kho mới bấm Ghi sổ là kho nhận đủ dù xe giao thiếu. Nay ô
 * để TRỐNG; mỗi dòng một nút "điền đủ" bấm có chủ ý. Dữ liệu đóng băng
 * PO-2026-0077 (NH-0513 · 90, NH-0003 · 260), dòng dựng lại như `tai-phieu-nhap`
 * với `dienSan: false`.
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/warehouse/nhap/x',
}))
const api = vi.fn()
vi.mock('@/lib/api', async (orig) => ({
  ...(await orig<typeof import('@/lib/api')>()),
  api: (...a: unknown[]) => api(...a),
}))
afterEach(() => {
  cleanup()
  api.mockReset()
})

type Props = Parameters<typeof PhieuNhapScreen>[0]

function dung(goiY?: (r: DongNhan) => number) {
  api.mockResolvedValue({ id: 'doc', code: 'PNK-TEST', po_status: 'partial' })
  const p = structuredClone(fixtures['PO-2026-0077']) as unknown as Props
  p.rows = p.rows.map((r) => ({ ...r, qty: 0, goi_y: goiY ? goiY(r) : r.qty_open }))
  render(
    <ToastProvider>
      <PhieuNhapScreen {...p} />
    </ToastProvider>,
  )
}
const gui = () => {
  const call = api.mock.calls.find(([u]) => String(u).includes('/docs/receipt'))
  return call ? (call[1] as { body: { lines: { qty: number }[] } }).body : null
}
const o = (code: string) =>
  screen.getByRole('textbox', { name: `Lần này ${code}` }) as HTMLInputElement

describe('phiếu nhập — Lần này để trống (K1)', () => {
  it('mở phiếu: ô trống, mỗi dòng có "điền đủ"; Ghi sổ bị chặn, không gửi gì', () => {
    dung()
    expect(o('NH-0513').value).toBe('')
    expect(o('NH-0003').value).toBe('')
    expect(screen.getByRole('button', { name: /Điền đủ 90 .* cho NH-0513/ })).toBeTruthy()
    expect(
      screen.getByRole('button', { name: /Điền đủ 260 .* cho NH-0003/ }),
    ).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: 'Ghi sổ' })[0])
    expect(
      screen.getAllByText(/Chưa nhận dòng nào — gõ số vào cột Lần này/).length,
    ).toBeGreaterThan(0)
    expect(gui()).toBeNull()
    // Câu chặn nhảy con trỏ về ô Lần này đầu tiên.
    expect(document.activeElement).toBe(o('NH-0513'))
  })

  it('"điền đủ" một dòng, gõ số thật dòng kia → chỉ gửi đúng hai số đó', async () => {
    dung()
    fireEvent.click(screen.getByRole('button', { name: /Điền đủ 90 .* cho NH-0513/ }))
    expect(o('NH-0513').value).toBe('90')
    expect(screen.queryByRole('button', { name: /cho NH-0513/ })).toBeNull()
    fireEvent.change(o('NH-0003'), { target: { value: '200' } })
    fireEvent.blur(o('NH-0003'))
    expect(screen.getByText(/còn thiếu 60/)).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: 'Ghi sổ' })[0])
    fireEvent.click(await screen.findByRole('button', { name: 'Ghi sổ không có số' }))
    await waitFor(() => expect(gui()).not.toBeNull())
    expect(gui()!.lines.map((l) => l.qty)).toEqual([90, 200])
  })

  it('"Nhận đủ tất cả" điền số GỢI Ý — theo đợt, không phải cả phần còn mở', () => {
    // Đang nhận một đợt: NH-0513 đợt này chở 40/90, NH-0003 không thuộc đợt.
    dung((r) => (r.code === 'NH-0513' ? 40 : 0))
    expect(screen.queryByRole('button', { name: /cho NH-0003/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Nhận đủ tất cả' }))
    expect(o('NH-0513').value).toBe('40')
    expect(o('NH-0003').value).toBe('')
  })
})
