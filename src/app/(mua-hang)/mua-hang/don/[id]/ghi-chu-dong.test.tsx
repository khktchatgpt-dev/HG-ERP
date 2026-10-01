// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { newFreeLine, type Line } from '../_lib/po-line'
import { GhiChuTd } from './ghi-chu-dong'
import type { DonCtx } from './useDonChungTu'

/** Cột "Ghi chú" trên lưới dòng hàng — mọi mẫu, tạo/sửa/xem (30/09/2026). */
afterEach(cleanup)

const l: Line = { ...newFreeLine(), note: 'Ghế 2-3 · Tay vịn' }
const row = (d: Partial<DonCtx>) =>
  render(
    <table>
      <tbody>
        <tr>
          <GhiChuTd d={d as DonCtx} l={l} i={4} />
        </tr>
      </tbody>
    </table>,
  )

describe('GhiChuTd', () => {
  it('lúc sửa: ô gõ được, rời ô là ghi vào đúng dòng', () => {
    const patch = vi.fn()
    row({ editing: true, patch })
    const input = screen.getByRole('textbox', {
      name: 'Ghi chú dòng 5',
    }) as HTMLInputElement
    expect(input.value).toBe('Ghế 2-3 · Tay vịn')
    fireEvent.change(input, { target: { value: 'Ghế 1 · Tựa lưng' } })
    fireEvent.blur(input) // rời ô = chốt (Enter cũng chỉ gọi blur)
    expect(patch).toHaveBeenCalledWith(4, { note: 'Ghế 1 · Tựa lưng' })
  })

  it('lúc xem: chỉ bày chữ, không có ô gõ', () => {
    row({ editing: false, patch: vi.fn() })
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.getByText('Ghế 2-3 · Tay vịn')).toBeTruthy()
  })
})
