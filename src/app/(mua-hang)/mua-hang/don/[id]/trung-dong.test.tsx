// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { newFreeLine, type Line } from '../_lib/po-line'
import { TrungDong } from './trung-dong'
import type { DonCtx } from './useDonChungTu'

/**
 * CẢNH BÁO TRÙNG DÒNG (30/09/2026) — dựng thật khối trên lưới, bấm "Gộp".
 * Cùng cây khác chiều dài cắt (đơn GIGA anh Truyền) KHÔNG được báo.
 */
afterEach(cleanup)

const line = (len: number, over: Partial<Line> = {}): Line => ({
  ...newFreeLine(),
  is_free: false,
  material_id: 'NH-0266',
  code: 'NH-0266',
  name: 'Hộp 25x50x1.2li Nhôm mềm',
  spec: 'Hộp 25x50 mềm T1.2',
  bar_length_m: len,
  qty: 10,
  price: 108000,
  ...over,
})

function ctx(lines: Line[], over: Partial<DonCtx> = {}) {
  let cur = lines
  const setLines = vi.fn((f: Line[] | ((ls: Line[]) => Line[])) => {
    cur = typeof f === 'function' ? f(cur) : f
  })
  const d = { editing: true, adjusting: false, lines, setLines, setSel: vi.fn(), setPick: vi.fn(), ...over } // prettier-ignore
  return { d: d as unknown as DonCtx, after: () => cur, setLines }
}

describe('TrungDong — cảnh báo trùng dòng trên lưới', () => {
  it('cùng cây, KHÁC chiều dài → không báo gì', () => {
    const { d } = ctx([line(5.1), line(5.3), line(6)])
    const { container } = render(<TrungDong d={d} />)
    expect(container.textContent).toBe('')
  })

  it('trùng thật → báo đúng dòng, bấm Gộp thì cộng SL và bỏ dòng sau', () => {
    const { d, after } = ctx([line(5.1), line(6, { qty: 78 }), line(6, { qty: 22 })])
    render(<TrungDong d={d} />)
    expect(screen.getByText(/Dòng 3 trùng dòng 2/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Gộp dòng 3 vào dòng 2' }))
    expect(after().map((l) => [l.bar_length_m, l.qty])).toEqual([
      [5.1, 10],
      [6, 100],
    ])
  })

  it('khác giá → báo nhưng KHÔNG có nút gộp', () => {
    const { d } = ctx([line(6), line(6, { price: 113000 })])
    render(<TrungDong d={d} />)
    expect(screen.getByText(/khác giá/)).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('không ở chế độ sửa → không hiện (bảng kiểm lo phần xem)', () => {
    const { d } = ctx([line(6), line(6)], { editing: false } as Partial<DonCtx>)
    const { container } = render(<TrungDong d={d} />)
    expect(container.textContent).toBe('')
  })
})
