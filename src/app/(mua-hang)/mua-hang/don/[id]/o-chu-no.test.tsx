// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { OChuNo } from './o-chu-no'

/** Ô chữ tự nở trên lưới dòng hàng (01/10/2026). */
afterEach(cleanup)

const setup = (value = 'Ghế 3 · Giằng chân sau') => {
  const onCommit = vi.fn()
  render(<OChuNo label="Ghi chú dòng 1" value={value} onCommit={onCommit} />)
  const box = screen.getByRole('textbox', {
    name: 'Ghi chú dòng 1',
  }) as HTMLTextAreaElement
  return { onCommit, box }
}

describe('OChuNo', () => {
  it('vào ô thì nổi lên (fixed, xuống dòng), rời ô thì về lại bề rộng cột', () => {
    const { box } = setup()
    expect(box.className).toContain('whitespace-nowrap')
    fireEvent.focus(box)
    expect(box.className).toContain('fixed')
    expect(box.className).toContain('whitespace-pre-wrap')
    expect(box.style.width).not.toBe('')
    fireEvent.blur(box)
    expect(box.className).not.toContain('fixed')
  })

  it('chốt khi rời ô và chỉ khi chữ đã khác', () => {
    const { box, onCommit } = setup()
    fireEvent.focus(box)
    fireEvent.blur(box)
    expect(onCommit).not.toHaveBeenCalled()
    fireEvent.focus(box)
    fireEvent.change(box, { target: { value: 'Ghế 3 · Giằng chân sau, Ngang mê trước' } })
    fireEvent.blur(box)
    expect(onCommit).toHaveBeenCalledWith('Ghế 3 · Giằng chân sau, Ngang mê trước')
  })

  it('không nhận xuống dòng cứng: dán nhiều dòng thì nối bằng dấu cách', () => {
    const { box, onCommit } = setup('')
    fireEvent.change(box, { target: { value: 'Dòng một\r\n  dòng hai' } })
    fireEvent.blur(box)
    expect(onCommit).toHaveBeenCalledWith('Dòng một dòng hai')
  })

  it('Enter không chèn xuống dòng; Esc bỏ bản nháp', () => {
    const { box, onCommit } = setup('cũ')
    fireEvent.focus(box)
    fireEvent.change(box, { target: { value: 'mới' } })
    const enter = fireEvent.keyDown(box, { key: 'Enter' })
    expect(enter).toBe(false) // preventDefault
    fireEvent.change(box, { target: { value: 'nháp bỏ' } })
    fireEvent.keyDown(box, { key: 'Escape' })
    expect(box.value).toBe('cũ')
    fireEvent.blur(box)
    expect(onCommit).not.toHaveBeenCalledWith('nháp bỏ')
  })
})

describe('OChuNo — ô trống chỉ vẽ chữ gợi ý MỘT lần (vá 02/10/2026)', () => {
  it('nằm yên: textarea không mang chữ gợi ý, chỉ lớp trên hiện', () => {
    render(
      <OChuNo
        label="Loại gỗ"
        value=""
        placeholder="Acacia FSC 100%"
        onCommit={vi.fn()}
      />,
    )
    const box = screen.getByRole('textbox', { name: 'Loại gỗ' })
    // Không chữa bằng lớp màu được: `.theme-v3 ::placeholder` ngoài layer thắng lớp tiện ích.
    expect(box.getAttribute('placeholder')).toBeNull()
    // Lớp trên là nơi DUY NHẤT hiện chữ gợi ý.
    expect(screen.getAllByText('Acacia FSC 100%')).toHaveLength(1)
  })

  it('vào ô: lớp trên biến mất, chữ gợi ý của textarea hiện lại', () => {
    render(
      <OChuNo
        label="Loại gỗ"
        value=""
        placeholder="Acacia FSC 100%"
        onCommit={vi.fn()}
      />,
    )
    const box = screen.getByRole('textbox', { name: 'Loại gỗ' })
    fireEvent.focus(box)
    expect(box.getAttribute('placeholder')).toBe('Acacia FSC 100%')
    expect(screen.queryByText('Acacia FSC 100%')).toBeNull()
  })
})
