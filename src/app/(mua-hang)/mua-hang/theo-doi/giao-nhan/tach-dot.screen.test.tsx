// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ToastProvider } from '@/components/kit'
import { a11yViolations, formatViolations } from '@/test/a11y'
import { planSplitByReceipts } from '@/lib/po-shipments'
import { TachDotSheet } from './tach-dot'

/**
 * HỘP TÁCH THEO PHIẾU NHẬP — dựng bằng số thật PO-2026-0084 (07/10/2026).
 * Dev server thứ hai không chạy được cạnh phiên khác, nên đây là chỗ soi
 * hộp: cột đúng phiếu, phần còn chờ đúng số, khoá đến khi đủ ngày + lý do.
 */
afterEach(cleanup)

const lines = [
  { id: 'A', code: 'BUL0087', name: 'Bulon 8X25X15M', unit: 'Con', qty_ordered: 59405 },
  { id: 'B', code: 'BUL0088', name: 'Bulon 8X35X15 M', unit: 'Con', qty_ordered: 13697 },
  { id: 'C', code: 'NK-0034', name: 'LĐS 6x16x1,7M', unit: 'Con', qty_ordered: 127447 },
]
const plan = planSplitByReceipts(
  {
    lines: [
      { po_line_id: 'A', qty: 59405 },
      { po_line_id: 'B', qty: 13697 },
      { po_line_id: 'C', qty: 127447 },
    ],
  },
  [
    { doc_id: 'd79', doc_code: 'PNK-2026-0079', date: '2026-10-02', lines: [{ po_line_id: 'A', qty: 4270 }, { po_line_id: 'B', qty: 2200 }, { po_line_id: 'C', qty: 23400 }] }, // prettier-ignore
    { doc_id: 'd96', doc_code: 'PNK-2026-0096', date: '2026-10-05', lines: [{ po_line_id: 'A', qty: 7800 }, { po_line_id: 'B', qty: 2800 }, { po_line_id: 'C', qty: 10000 }] }, // prettier-ignore
  ],
)!

function dung(onSubmit = vi.fn(async () => true)) {
  render(
    <ToastProvider>
      <TachDotSheet
        shipment={{ code: 'GH-2026-0020', seq: 1, expected_date: '2026-10-01' }}
        plan={plan}
        lines={lines}
        today="2026-10-07"
        busy={false}
        onClose={() => {}}
        onSubmit={onSubmit}
      />
    </ToastProvider>,
  )
  return onSubmit
}

describe('TachDotSheet', () => {
  it('bày hai phiếu thành hai cột, phần còn chờ đúng số, nút ghi "Tách thành 3 đợt"', () => {
    dung()
    expect(screen.getByText('PNK-2026-0079')).toBeTruthy()
    expect(screen.getByText('PNK-2026-0096')).toBeTruthy()
    expect((screen.getByLabelText('Hẹn mới 1 · Bulon 8X25X15M') as HTMLInputElement).value).toBe('47.335') // prettier-ignore
    expect((screen.getByLabelText('Hẹn mới 1 · LĐS 6x16x1,7M') as HTMLInputElement).value).toBe('94.047') // prettier-ignore
    expect(screen.getByRole('button', { name: 'Tách thành 3 đợt' })).toBeTruthy()
  })

  it('chưa chọn ngày → nói lý do tại chỗ, không gửi', () => {
    const onSubmit = dung()
    expect(screen.getByText(/Chưa tách được: Đợt hẹn 1: chưa chọn ngày/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Tách thành 3 đợt' }))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('chia thêm đợt mà số chưa khớp → báo đúng dòng còn lệch', () => {
    dung()
    fireEvent.click(screen.getByRole('button', { name: /Chia phần còn chờ/ }))
    const o = screen.getByLabelText('Hẹn mới 1 · Bulon 8X25X15M')
    fireEvent.change(o, { target: { value: '40.000' } })
    fireEvent.blur(o)
    expect((screen.getByLabelText('Hẹn mới 1 · Bulon 8X25X15M') as HTMLInputElement).value).toBe('40.000') // prettier-ignore
    // Cột "Khớp" của dòng Bulon 8x25 còn thiếu 7.335 cho đợt hẹn 2.
    expect(screen.getByText('7.335')).toBeTruthy()
  })

  it('a11y: không lỗi axe', async () => {
    dung()
    // Soi trên hộp thoại: focus guard của Radix gắn ở body là của thư viện.
    const v = await a11yViolations(screen.getByRole('dialog'))
    expect(v, formatViolations(v)).toEqual([])
  })
})
