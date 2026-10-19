// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ProductSectionForm } from './ProductSectionForm'
import { SECTIONS } from './product-sections'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }))
vi.mock('@/components/ui/Toast', () => ({
  useToast: () => ({ success: () => {}, error: () => {} }),
}))

afterEach(cleanup)

describe('ProductSectionForm — ô có đơn vị', () => {
  // Hồi quy 19/10/2026: gõ vào ô mm làm sập cả trang Thông số ("This page
  // couldn't load") — hàm cập nhật setState đọc e.currentTarget lúc đã null.
  it('gõ số vào ô mm không sập, hiện cảnh báo mềm khi số nhỏ', () => {
    render(
      <ProductSectionForm
        productId="p1"
        section={SECTIONS.dims}
        values={{ length_mm: null }}
        currentPacking={{}}
        currentTechSpec={{}}
        onClose={() => {}}
      />,
    )
    const inp = document.querySelector('input[name=length_mm]') as HTMLInputElement
    fireEvent.change(inp, { target: { value: '50' } })
    expect(screen.getByText(/có phải bạn đang nhập cm/)).toBeTruthy()
    fireEvent.change(inp, { target: { value: '1200' } })
    expect(screen.queryByText(/có phải bạn đang nhập cm/)).toBeNull()
  })
})
