// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { HopThoai, OSo, docSoVn } from './o-nhap'
import { useCtrlEnter } from './useCtrlEnter'

/**
 * Lỗi 26/10/2026: Xuất kho / Nhận ngoài đơn / Hoàn kho / Nhập theo đề nghị gọi
 * `setTimeout(ghiSo, 0)` bằng closure của lần render cũ — gõ số rồi Ctrl+Enter
 * ngay trong ô là ghi số CŨ. Màn thử dưới đây dựng đúng cấu hình đó: ô `OSo`
 * chốt lúc rời ô + hàm ghi đọc state.
 */
afterEach(cleanup)

function ManThu({ onGhi }: { onGhi: (qty: number) => void }) {
  const [qty, setQty] = useState(0)
  const onKeyDown = useCtrlEnter(() => onGhi(qty))
  return (
    <div onKeyDown={onKeyDown}>
      <OSo label="Số lượng" value={String(qty)} onCommit={(t) => setQty(docSoVn(t))} />
    </div>
  )
}

describe('useCtrlEnter', () => {
  it('gõ số rồi Ctrl+Enter ngay trong ô: ghi bằng số VỪA gõ', async () => {
    const onGhi = vi.fn()
    render(<ManThu onGhi={onGhi} />)
    const o = screen.getByLabelText('Số lượng')
    o.focus()
    fireEvent.change(o, { target: { value: '1.250' } })
    fireEvent.keyDown(o, { key: 'Enter', ctrlKey: true })
    await waitFor(() => expect(onGhi).toHaveBeenCalledTimes(1))
    expect(onGhi).toHaveBeenCalledWith(1250)
  })

  it('Enter thường không ghi; đang chặn (hộp thoại mở) thì Ctrl+Enter bỏ qua', async () => {
    const onGhi = vi.fn()
    function ManChan() {
      const onKeyDown = useCtrlEnter(onGhi, true)
      return (
        <div onKeyDown={onKeyDown}>
          <input aria-label="o" />
        </div>
      )
    }
    render(<ManChan />)
    const o = screen.getByLabelText('o')
    fireEvent.keyDown(o, { key: 'Enter' })
    fireEvent.keyDown(o, { key: 'Enter', ctrlKey: true })
    await new Promise((r) => setTimeout(r, 10))
    expect(onGhi).not.toHaveBeenCalled()
  })

  it('Ctrl+Enter gõ trong HopThoai không ghi sổ màn sau lưng; Esc vẫn đóng hộp', async () => {
    const onGhi = vi.fn()
    const onClose = vi.fn()
    function ManCoHop() {
      const onKeyDown = useCtrlEnter(onGhi)
      return (
        <div onKeyDown={onKeyDown}>
          <HopThoai title="Báo sự cố" onClose={onClose}>
            <textarea aria-label="Mô tả" />
          </HopThoai>
        </div>
      )
    }
    render(<ManCoHop />)
    const o = screen.getByLabelText('Mô tả')
    fireEvent.keyDown(o, { key: 'Enter', ctrlKey: true })
    fireEvent.keyDown(o, { key: 'Enter', metaKey: true })
    await new Promise((r) => setTimeout(r, 10))
    expect(onGhi).not.toHaveBeenCalled()
    fireEvent.keyDown(o, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
