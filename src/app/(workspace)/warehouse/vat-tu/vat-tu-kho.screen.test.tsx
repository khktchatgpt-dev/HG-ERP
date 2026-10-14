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
import { VatTuKhoScreen, type VatTuRow } from './VatTuKhoScreen'

/**
 * DANH MỤC VẬT TƯ bản Kho trên khung lối ERP (B4, bản vẽ K-5). Mã rút từ màn thật
 * 14/10/2026: ba mã bao bì Cung ứng khai vội (chờ Kho rà).
 */
const refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh }),
  usePathname: () => '/warehouse/vat-tu',
  useSearchParams: () => new URLSearchParams(''),
}))
const api = vi.fn()
vi.mock('@/lib/api', async (orig) => ({
  ...(await orig<typeof import('@/lib/api')>()),
  api: (...a: unknown[]) => api(...a),
}))
afterEach(() => {
  cleanup()
  api.mockReset()
  refresh.mockReset()
})

const row = (id: string, code: string, p: Partial<VatTuRow> = {}): VatTuRow => ({
  id,
  code,
  name: 'BB ' + code,
  unit: 'Cái',
  group_name: 'Bao bì - đóng gói - tem nhãn',
  sub_group: null,
  shelf_location: null,
  min_stock: 0,
  needs_review: true,
  is_active: true,
  ...p,
})
const ROWS = [
  row('a', 'BAO0687'),
  row('b', 'BAO0688'),
  row('c', 'BAO0689', { needs_review: false }),
]

const dung = () =>
  render(
    <VatTuKhoScreen
      rows={ROWS}
      counts={{ review: 253, no_min: 13476, no_shelf: 495, all: 13481 }}
      total={3}
      trang={1}
      soTrang={1}
      ro="review"
      q=""
      nhom=""
      nhomOptions={['Bao bì - đóng gói - tem nhãn']}
      dvtOptions={['Cái', 'Kg', 'Thùng']}
      keOptions={['BB-H', 'GO-K']}
      canEdit
    />,
  )
const doi = (label: string, v: string) => {
  const o = screen.getByLabelText(label)
  fireEvent.change(o, { target: { value: v } })
  fireEvent.blur(o)
}

describe('VatTuKhoScreen (khung Kho lối ERP)', () => {
  it('tab theo việc: Chờ Kho rà → Chưa có kệ → Chưa khai ngưỡng → Tất cả', () => {
    dung()
    const tl = screen.getByRole('tablist', { name: 'Việc trên danh mục' })
    expect(
      within(tl)
        .getAllByRole('tab')
        .map((t) => t.textContent),
    ).toEqual([
      'Chờ Kho rà253',
      'Chưa có kệ495',
      'Chưa khai ngưỡng13.476',
      'Tất cả13.481',
    ])
  })

  it('ĐVT gõ "kg" → lưu đúng chữ trong danh sách "Kg"', async () => {
    api.mockResolvedValue({})
    dung()
    doi('Đơn vị tính BAO0687', 'kg')
    await waitFor(() => expect(api).toHaveBeenCalled())
    expect(api).toHaveBeenCalledWith('/api/dept/warehouse/materials/a', {
      method: 'PATCH',
      body: { unit: 'Kg' },
    })
  })

  it('ĐVT lạ → hỏi trước khi lưu; "Giữ" thì không gửi gì', () => {
    dung()
    doi('Đơn vị tính BAO0687', 'Bo')
    const hop = screen.getByRole('dialog')
    expect(within(hop).getByText(/chưa có trong danh sách/)).toBeTruthy()
    fireEvent.click(within(hop).getByRole('button', { name: /Giữ “Cái”/ }))
    expect(api).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('tích 2 mã chờ rà → "Đã rà xong 2 mã" gửi needs_review=false cho từng mã rồi làm mới', async () => {
    api.mockResolvedValue({})
    dung()
    fireEvent.click(screen.getByLabelText('Chọn BAO0687'))
    fireEvent.click(screen.getByLabelText('Chọn BAO0688'))
    fireEvent.click(screen.getByLabelText('Chọn BAO0689')) // đã rà rồi — không tính
    fireEvent.click(screen.getByRole('button', { name: 'Đã rà xong 2 mã' }))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(api.mock.calls.map((c) => [c[0], (c[1] as { body: unknown }).body])).toEqual([
      ['/api/dept/warehouse/materials/a', { needs_review: false }],
      ['/api/dept/warehouse/materials/b', { needs_review: false }],
    ])
  })
})
