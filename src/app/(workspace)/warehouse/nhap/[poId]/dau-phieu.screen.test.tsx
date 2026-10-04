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

function dung(them: Partial<Props> = {}) {
  api.mockResolvedValue({ id: 'doc', code: 'PNK-TEST', po_status: 'partial' })
  const p = {
    ...(structuredClone(fixtures['PO-2026-0085']) as unknown as Props),
    ...them,
  }
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

describe('ngày chứng từ lùi xa (05/10/2026)', () => {
  // Fixture "hôm nay" = 01/10/2026; 16/09 = lùi 15 ngày.
  const doiNgay = (vn: string) => {
    const o = screen.getByRole('textbox', { name: 'Ngày chứng từ' })
    fireEvent.change(o, { target: { value: vn } })
    fireEvent.blur(o)
  }

  it('lùi 15 ngày: hiện ô lý do, chưa có lý do thì Ghi sổ không gửi', () => {
    dung()
    doiNgay('16/09/2026')
    expect(screen.getByText('Lý do lùi 15 ngày')).toBeTruthy()
    expect(
      screen.getByText(/Chưa lưu được: Ngày chứng từ lùi 15 ngày — ghi lý do/),
    ).toBeTruthy()
    expect(screen.getByRole('textbox', { name: 'Lý do nhập lùi ngày' })).toBeTruthy()
    fireEvent.click(nutGhiSo())
    expect(gui()).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('có lý do → gửi doc_date + backdate_reason, xem bản in có dòng lùi ngày', async () => {
    dung()
    doiNgay('16/09/2026')
    const ly = screen.getByRole('textbox', { name: 'Lý do nhập lùi ngày' })
    go(ly, 'nhập bù hàng về trước khi dùng hệ thống')
    fireEvent.blur(ly)
    fireEvent.click(nutGhiSo())
    fireEvent.click(await screen.findByRole('button', { name: 'Ghi sổ không có số' }))
    await waitFor(() => expect(gui()).not.toBeNull())
    expect(gui()).toMatchObject({
      doc_date: '2026-09-16',
      backdate_reason: 'nhập bù hàng về trước khi dùng hệ thống',
      fix_of_doc_id: null,
    })
  })

  it('lùi quá 60 ngày → báo chặn tại ô', () => {
    dung()
    doiNgay('01/07/2026')
    expect(screen.getAllByText(/chỉ lùi được tối đa 60 ngày/).length).toBeGreaterThan(0)
    expect(screen.queryByRole('textbox', { name: 'Lý do nhập lùi ngày' })).toBeNull()
  })
})

describe('lập lại phiếu cũ để sửa (05/10/2026)', () => {
  const suaLai = {
    id: 'phieu-cu',
    code: 'PNK-2026-0023',
    daoBoi: 'PXK-2026-0004',
    docDate: '2026-07-01',
    supplierDocNo: '6/2026- HG/ATP',
    counterparty: 'Hồng Phát',
  }

  it('giữ ngày phiếu cũ dù lùi xa: không hỏi lý do, gửi kèm mã phiếu cũ', async () => {
    dung({ suaLai })
    // Ô ngày vẫn MỞ — sai ngày chứng từ chỉ sửa được bằng đường đảo + lập lại.
    expect(screen.getByRole('textbox', { name: 'Ngày chứng từ' })).toHaveProperty('disabled', false) // prettier-ignore
    expect(screen.getByText('Ngày CT · giữ ngày cũ')).toBeTruthy()
    expect(screen.queryByRole('textbox', { name: 'Lý do nhập lùi ngày' })).toBeNull()
    fireEvent.click(nutGhiSo())
    await waitFor(() => expect(gui()).not.toBeNull())
    expect(gui()).toMatchObject({
      doc_date: '2026-07-01',
      fix_of_doc_id: 'phieu-cu',
      backdate_reason: null,
      supplier_doc_no: '6/2026- HG/ATP',
    })
    expect(String(gui()!.note)).toMatch(/^Sửa lại PNK-2026-0023/)
  })

  it('đổi sang ngày khác (sửa ngày sai) → luật thường: lùi 15 ngày phải ghi lý do', async () => {
    dung({ suaLai })
    const o = screen.getByRole('textbox', { name: 'Ngày chứng từ' })
    fireEvent.change(o, { target: { value: '16/09/2026' } })
    fireEvent.blur(o)
    const ly = screen.getByRole('textbox', { name: 'Lý do nhập lùi ngày' })
    fireEvent.click(nutGhiSo())
    expect(gui()).toBeNull()
    go(ly, 'ngày cũ ghi nhầm, hàng về 16/09')
    fireEvent.blur(ly)
    fireEvent.click(nutGhiSo())
    await waitFor(() => expect(gui()).not.toBeNull())
    expect(gui()).toMatchObject({
      doc_date: '2026-09-16',
      fix_of_doc_id: 'phieu-cu',
      backdate_reason: 'ngày cũ ghi nhầm, hàng về 16/09',
    })
  })
})
