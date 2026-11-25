// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { DEFAULT_DOC_TEMPLATES } from '@/lib/doc-templates'
import type { VatTuTon } from '@/lib/kho-chon-vat-tu'
import { XuatScreen } from './XuatScreen'

/**
 * NHẬP BÙ PHIẾU XUẤT VIẾT TAY (25/11/2026): phiếu xuất dưới xưởng từ 03/10 chỉ nằm
 * trên giấy. Kho nhập cả xấp cùng ngày → ghi sổ một tờ GHI LÙI xong, ngày phải giữ
 * nguyên cho tờ kế; nút "Làm mới" mới đưa ngày về hôm nay.
 */
const api = vi.fn()
vi.mock('@/lib/api', async (orig) => ({
  ...(await orig<typeof import('@/lib/api')>()),
  api: (...a: unknown[]) => api(...a),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams('lsx=l-mx9'),
}))
afterEach(() => {
  cleanup()
  api.mockReset()
})

const TON: VatTuTon[] = [
  { id: 'm206', code: 'MUT0206', name: 'Mút D20 725X695X140', unit: 'Tấm', qty_ok: 620, ke: null, nhom: 'Mút' }, // prettier-ignore
]
const dung = () =>
  render(
    <XuatScreen
      lsx={[{ id: 'l-mx9', code: '02/26-27 - ROSCO', customer_name: 'ROSCO', status: 'approved', ship_date: null }]} // prettier-ignore
      to={['Tổ May']}
      phong={['Kho']}
      tonSan={TON}
      today="2026-11-25"
      nguoiLap="Hà Nguyễn Nữ"
      canEdit
      company={{}}
      tpl={DEFAULT_DOC_TEMPLATES.PXK}
    />,
  )
const ngay = () => screen.getByRole('textbox', { name: 'Ngày chứng từ' }) as HTMLInputElement

async function ghiMotTo(so: string) {
  fireEvent.click(screen.getByRole('radio', { name: 'May' }))
  const tim = screen.getByRole('combobox', { name: 'Tìm vật tư để thêm dòng' })
  fireEvent.focus(tim)
  fireEvent.change(tim, { target: { value: 'MUT0206' } })
  fireEvent.keyDown(tim, { key: 'Enter' })
  const o = document.getElementById('xuat-qty-0') as HTMLInputElement
  fireEvent.change(o, { target: { value: so } })
  fireEvent.blur(o)
  const thanh = screen.getByRole('group', { name: 'Ghi sổ phiếu xuất' })
  fireEvent.click(within(thanh).getByRole('button', { name: 'Ghi sổ' }))
  await screen.findByText(/PXK-2026-00/)
}

describe('Xuất hàng · nhập bù phiếu viết tay', () => {
  it('ghi lùi 15/10 → ghi sổ xong ngày vẫn 15/10, phiếu gửi đúng ngày; Làm mới → hôm nay', async () => {
    let n = 31
    api.mockImplementation((_url: string, init?: { method?: string }) =>
      init?.method === 'POST'
        ? Promise.resolve({ id: `d${n}`, code: `PXK-2026-00${n++}` })
        : Promise.resolve({ rows: [] }),
    )
    dung()
    fireEvent.change(ngay(), { target: { value: '15/10/2026' } })
    await ghiMotTo('40')
    const body = (api.mock.calls.find((c) => c[1]?.method === 'POST')![1] as { body: { doc_date: string } }).body // prettier-ignore
    expect(body.doc_date).toBe('2026-10-15')
    await waitFor(() => expect(ngay().value).toBe('15/10/2026'))

    fireEvent.click(screen.getByRole('button', { name: 'Làm mới' }))
    await waitFor(() => expect(ngay().value).toBe('25/11/2026'))
  })

  it('phiếu ghi hôm nay: ghi sổ xong ngày vẫn là hôm nay (không giữ gì lạ)', async () => {
    api.mockImplementation((_url: string, init?: { method?: string }) =>
      init?.method === 'POST' ? Promise.resolve({ id: 'd1', code: 'PXK-2026-0031' }) : Promise.resolve({ rows: [] }), // prettier-ignore
    )
    dung()
    await ghiMotTo('10')
    expect(ngay().value).toBe('25/11/2026')
  })
})
