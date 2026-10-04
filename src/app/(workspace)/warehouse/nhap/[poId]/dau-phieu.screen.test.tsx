// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ToastProvider } from '@/components/kit'
import fixtures from '@/app/design-lab/chup/_du-lieu/nhan-hang.json'
import { PhieuNhapScreen } from './PhieuNhapScreen'

/**
 * ĐẦU PHIẾU NHẬP (04/10/2026, bản vẽ J1/J1b) — dựng NGUYÊN form nhận hàng từ
 * dữ liệu đóng băng PO-2026-0085 (không đụng DB: `api` bị thay), rồi soi
 * payload gửi lên `docs/receipt`:
 *  · người giao điền sẵn tên NCC;
 *  · số phiếu NCC trống → bấm Ghi sổ thì HỎI, chưa gửi gì;
 *  · gõ số trong hộp nhắc → gửi đúng số đó;
 *  · Ctrl+Enter khi con trỏ còn trong ô → chữ vừa gõ vẫn đi theo (lỗi cũ: mất).
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/mua-hang/don/x/nhan',
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
const NCC = 'CÔNG TY TNHH SX & TM TƯỜNG NGUYÊN'

function dung() {
  api.mockResolvedValue({ id: 'doc', code: 'PNK-TEST', po_status: 'partial' })
  const p = structuredClone(fixtures['PO-2026-0085']) as unknown as Props
  render(
    <ToastProvider>
      <PhieuNhapScreen {...p} />
    </ToastProvider>,
  )
}
const gui = () => {
  const call = api.mock.calls.find(([u]) => String(u).includes('/docs/receipt'))
  return call ? (call[1] as { body: Record<string, unknown> }).body : null
}
const nutGhiSo = () => screen.getAllByRole('button', { name: 'Ghi sổ' })[0]
/** Gõ như người: vào ô, đổi chữ — CHƯA rời ô. */
const go = (el: HTMLElement, v: string) => {
  el.focus()
  fireEvent.change(el, { target: { value: v } })
}

describe('đầu phiếu nhập', () => {
  it('người giao điền sẵn tên NCC', () => {
    dung()
    expect(screen.getByRole('textbox', { name: 'Người giao' })).toHaveProperty(
      'value',
      NCC,
    )
  })

  it('số phiếu NCC trống → Ghi sổ mở hộp nhắc, chưa gửi; gõ số trong hộp → gửi đúng số', async () => {
    dung()
    fireEvent.click(nutGhiSo())
    const hop = await screen.findByRole('dialog')
    expect(gui()).toBeNull()
    const luu = screen.getByRole('button', { name: 'Lưu số và ghi sổ' })
    expect(luu).toHaveProperty('disabled', true)
    fireEvent.change(hop.querySelector('input')!, { target: { value: '5/2026- HG/TN' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu số và ghi sổ' }))
    await waitFor(() => expect(gui()).not.toBeNull())
    expect(gui()).toMatchObject({ supplier_doc_no: '5/2026- HG/TN', counterparty: NCC })
  })

  it('"Ghi sổ không có số" vẫn ghi được, số NCC = null', async () => {
    dung()
    fireEvent.click(nutGhiSo())
    fireEvent.click(await screen.findByRole('button', { name: 'Ghi sổ không có số' }))
    await waitFor(() => expect(gui()).not.toBeNull())
    expect(gui()).toMatchObject({ supplier_doc_no: null, note: null })
  })

  it('Ctrl+Enter khi còn trong ô: số NCC + ghi chú vừa gõ vẫn đi theo, không hỏi lại', async () => {
    dung()
    go(screen.getByRole('textbox', { name: 'Ghi chú phiếu' }), 'hàng về 2 xe')
    const so = screen.getByRole('textbox', { name: 'Số phiếu giao NCC' })
    go(so, '7/2026- HG/TN')
    fireEvent.keyDown(so, { key: 'Enter', ctrlKey: true })
    await waitFor(() => expect(gui()).not.toBeNull())
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(gui()).toMatchObject({
      supplier_doc_no: '7/2026- HG/TN',
      note: 'hàng về 2 xe',
    })
  })
})
