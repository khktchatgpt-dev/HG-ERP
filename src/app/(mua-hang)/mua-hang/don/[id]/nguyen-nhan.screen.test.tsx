// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { NguyenNhanCell, NguyenNhanField } from './nguyen-nhan'
import { useNguyenNhan } from './useNguyenNhan'
import type { DonCtx } from './useDonChungTu'

/**
 * KHỐI NGUYÊN NHÂN của hộp Áp dụng điều chỉnh (0227, bản vẽ duyệt 07/10/2026):
 * năm nguyên nhân, "Khách đổi đơn" chọn sẵn lệnh duy nhất đơn đang gắn kèm lần
 * đổi gần nhất của đơn khách, câu chặn tại chỗ chỉ vào ô đầu tiên còn thiếu.
 */
const LSX = 'lsx-rosco'
function Harness({ linked }: { linked: string[] }) {
  const nn = useNguyenNhan()
  const d = {
    nn,
    adjLinkedLsx: linked,
    lsxOptions: [
      { value: LSX, label: '02/26-27 - ROSCO', hint: 'ROSCO' },
      { value: 'lsx-mx', label: '09/26-27 MX', hint: 'MERXX' },
    ],
    lsxLastChange: {
      [LSX]: {
        order_code: 'ROSCO IBIZA 02/26-27',
        at: '2026-10-05T03:00:00Z',
        note: 'Bản 2: về đúng ORDERED QTY',
      },
    },
  } as unknown as DonCtx
  return (
    <>
      <NguyenNhanField d={d} />
      <output data-testid="block">{nn.block(linked)?.field ?? 'ok'}</output>
      <output data-testid="picked">{nn.pickedLsx(linked).join(',')}</output>
    </>
  )
}

afterEach(cleanup)

describe('NguyenNhanField', () => {
  it('chưa chọn gì: chặn ở ô nguyên nhân, bày đủ năm nguyên nhân', () => {
    render(<Harness linked={[LSX]} />)
    expect(screen.getAllByRole('radio')).toHaveLength(5)
    expect(screen.getByTestId('block').textContent).toBe('cause')
    expect(screen.getByText(/Chọn nguyên nhân để kế toán/)).toBeTruthy()
  })

  it('Khách đổi đơn: lệnh duy nhất chọn sẵn + lần đổi của đơn khách; còn thiếu ghi chú', () => {
    render(<Harness linked={[LSX]} />)
    fireEvent.click(screen.getByLabelText(/Khách đổi đơn/))
    expect(screen.getByTestId('picked').textContent).toBe(LSX)
    expect(screen.getByText(/ROSCO IBIZA 02\/26-27 đổi gần nhất/)).toBeTruthy()
    expect(screen.getByTestId('block').textContent).toBe('note')
    fireEvent.change(screen.getByLabelText('Ghi chú điều chỉnh'), {
      target: { value: 'Khách giảm 86 bộ sofa' },
    })
    expect(screen.getByTestId('block').textContent).toBe('ok')
  })

  it('bỏ tick lệnh duy nhất → chặn ở ô lệnh', () => {
    render(<Harness linked={[LSX]} />)
    fireEvent.click(screen.getByLabelText(/Khách đổi đơn/))
    fireEvent.click(screen.getByLabelText('Chọn lệnh 02/26-27 - ROSCO'))
    expect(screen.getByTestId('block').textContent).toBe('lsx')
    expect(screen.getByText(/chọn lệnh \/ đơn khách mà lần sửa này theo/)).toBeTruthy()
  })

  it('đơn chưa gắn lệnh: không chọn sẵn, nói cách gỡ', () => {
    render(<Harness linked={[]} />)
    fireEvent.click(screen.getByLabelText(/Khách đổi đơn/))
    expect(screen.getByTestId('picked').textContent).toBe('')
    expect(screen.getByText(/Đơn mua này chưa gắn lệnh/)).toBeTruthy()
  })

  it('NCC đổi giá: không bày ô lệnh', () => {
    render(<Harness linked={[LSX]} />)
    fireEvent.click(screen.getByLabelText(/NCC đổi giá/))
    expect(screen.queryByText(/Theo thay đổi của đơn khách/)).toBeNull()
  })
})

describe('NguyenNhanCell', () => {
  it('bản ghi cũ: Chưa phân loại; bản mới: nhãn + lệnh + đơn khách', () => {
    const { rerender } = render(<NguyenNhanCell a={{ cause: null }} />)
    expect(screen.getByText('Chưa phân loại')).toBeTruthy()
    rerender(
      <NguyenNhanCell
        a={{
          cause: 'khach_doi',
          lsx: [{ id: LSX, code: '02/26-27 - ROSCO', orders: ['ROSCO IBIZA 02/26-27'] }],
        }}
      />,
    )
    expect(screen.getByText('Khách đổi đơn')).toBeTruthy()
    expect(
      screen.getByRole('link', { name: '02/26-27 - ROSCO' }).getAttribute('href'),
    ).toBe(`/mua-hang/yeu-cau/${LSX}`)
  })
})
