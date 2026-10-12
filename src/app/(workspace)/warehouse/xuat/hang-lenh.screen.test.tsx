// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { ToastProvider } from '@/components/kit'
import type { HangLenhRow } from '@/lib/kho-hang-lenh'
import { HangLenh } from './hang-lenh'

/**
 * LẤY HÀNG CỦA LỆNH (Kho đợt 2 · Bước 4, bản vẽ B4-1…B4-3). Dữ liệu đóng băng từ
 * DB thật 12/10/2026 — YOTRIO: lệnh quá hạn xuất hàng 10/10, BUL0606 tồn ít hơn
 * phần của lệnh, PKN0400 đã về mà kho hết.
 */

const api = vi.fn()
vi.mock('@/lib/api', async (orig) => ({
  ...(await orig<typeof import('@/lib/api')>()),
  api: (...a: unknown[]) => api(...a),
}))
afterEach(() => {
  cleanup()
  api.mockReset()
})

const r = (
  p: Partial<HangLenhRow> & Pick<HangLenhRow, 'material_id' | 'code'>,
): HangLenhRow => ({
  name: 'tên ' + p.code,
  unit: 'Cái',
  ve: 100,
  xuat: 0,
  con: 100,
  ton: 100,
  goi_y: 100,
  het: false,
  ...p,
})
const ROWS: HangLenhRow[] = [
  r({ material_id: 'm1', code: 'NK-0203', name: 'LĐ chẻ lỗ 8x2', unit: 'Con', ve: 1500, con: 1500, ton: 1500, goi_y: 1500 }), // prettier-ignore
  r({ material_id: 'm2', code: 'BUL0606', name: 'LĐS 8x20x2', ve: 2322, con: 2322, ton: 810, goi_y: 810 }), // prettier-ignore
  r({ material_id: 'm3', code: 'PKN0400', name: 'Nút chân Siena (B477)', ve: 1648, con: 1648, ton: 0, goi_y: 0, het: true }), // prettier-ignore
]
const LSX = { id: 'lsx-yotrio', code: '01/26-27 - YOTRIO', ship_date: '2026-10-10' }

function dung(onLay = vi.fn()) {
  api.mockResolvedValue({ rows: ROWS })
  render(
    <ToastProvider>
      <HangLenh lsx={LSX} today="2026-10-12" onLay={onLay} />
    </ToastProvider>,
  )
  return onLay
}

describe('HangLenh', () => {
  it('nạp đúng route; dải nói kho còn 2 mã, 1 mã kho hết, và nhắc lệnh quá hạn', async () => {
    dung()
    expect(api).toHaveBeenCalledWith('/api/dept/warehouse/lsx/lsx-yotrio/hang-lenh')
    expect(
      await screen.findByRole('button', { name: /Lấy hàng của lệnh \(2\)/ }),
    ).toBeTruthy()
    expect(screen.getByText(/1 mã đã về nhưng kho hết/)).toBeTruthy()
    expect(screen.getByText(/quá hạn xuất hàng 10\/10\/2026/)).toBeTruthy()
  })

  it('hộp: mặc định tích hết mã còn tồn, số điền sẵn = gợi ý; mã kho hết không tích được', async () => {
    dung()
    fireEvent.click(await screen.findByRole('button', { name: /Lấy hàng của lệnh/ }))
    const hop = screen.getByRole('dialog')
    expect(
      (within(hop).getByLabelText('Lấy lần này BUL0606') as HTMLInputElement).value,
    ).toBe('810')
    expect(within(hop).getByRole('button', { name: /Đưa 2 dòng vào phiếu/ })).toBeTruthy()
    fireEvent.click(within(hop).getByRole('button', { name: /Tất cả/ }))
    expect(within(hop).queryByLabelText('Lấy PKN0400')).toBeNull()
    expect(within(hop).getAllByText('kho hết').length).toBeGreaterThan(0)
  })

  it('sửa số, bỏ một mã → Đưa vào phiếu gửi đúng mã + số + tồn', async () => {
    const onLay = dung()
    fireEvent.click(await screen.findByRole('button', { name: /Lấy hàng của lệnh/ }))
    const hop = screen.getByRole('dialog')
    fireEvent.change(within(hop).getByLabelText('Lấy lần này NK-0203'), {
      target: { value: '1.200' },
    })
    fireEvent.click(within(hop).getByLabelText('Lấy BUL0606'))
    fireEvent.click(within(hop).getByRole('button', { name: /Đưa 1 dòng vào phiếu/ }))
    await waitFor(() => expect(onLay).toHaveBeenCalled())
    expect(onLay.mock.calls[0][0]).toEqual([
      {
        id: 'm1',
        code: 'NK-0203',
        name: 'LĐ chẻ lỗ 8x2',
        unit: 'Con',
        qty_ok: 1500,
        qty: 1200,
      },
    ])
  })

  it('lệnh chưa có hàng về: dải nói thẳng, không có nút', async () => {
    api.mockResolvedValue({ rows: [] })
    render(
      <ToastProvider>
        <HangLenh lsx={{ ...LSX, ship_date: null }} today="2026-10-12" onLay={vi.fn()} />
      </ToastProvider>,
    )
    expect(await screen.findByText(/Chưa có hàng nào đã mua cho lệnh/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Lấy hàng của lệnh/ })).toBeNull()
  })
})
