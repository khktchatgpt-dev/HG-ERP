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
 * 14/10/2026: ba mã bao bì. Bước "Chờ Kho rà" đã bỏ 14/10 — không còn rổ, nút, ô rà.
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
  is_active: true,
  ...p,
})
const ROWS = [row('a', 'BAO0687'), row('b', 'BAO0688'), row('c', 'BAO0689')]

const dung = () =>
  render(
    <VatTuKhoScreen
      rows={ROWS}
      counts={{ no_min: 13476, no_shelf: 495, all: 13481 }}
      total={3}
      trang={1}
      soTrang={1}
      ro="no_shelf"
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
  it('tab theo việc: Chưa có kệ → Chưa khai ngưỡng → Tất cả (không còn "Chờ Kho rà")', () => {
    dung()
    const tl = screen.getByRole('tablist', { name: 'Việc trên danh mục' })
    expect(
      within(tl)
        .getAllByRole('tab')
        .map((t) => t.textContent),
    ).toEqual(['Chưa có kệ495', 'Chưa khai ngưỡng13.476', 'Tất cả13.481'])
    expect(screen.queryByRole('button', { name: /Đã rà xong/ })).toBeNull()
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

  it('chọn MỘT dòng: tích dòng khác là bỏ dòng trước; nút "Sửa" theo dòng đang chọn', () => {
    dung()
    fireEvent.click(screen.getByLabelText('Chọn BAO0687'))
    fireEvent.click(screen.getByLabelText('Chọn BAO0688'))
    expect((screen.getByLabelText('Chọn BAO0687') as HTMLInputElement).checked).toBe(
      false,
    )
    expect(screen.getByRole('button', { name: /Sửa BAO0688/ })).toBeTruthy()
  })

  it('B7a: nhấp đúp dòng → hộp Sửa; Lưu KHÔNG gửi giá / NCC / cờ rà', async () => {
    const M = {
      id: 'a', code: 'BAO0687', name: 'BB BAO0687', unit: 'Cái', spec: null,
      group_name: 'Bao bì - đóng gói - tem nhãn', sub_group: null, price_unit: null,
      unit2_factor: null, kg_per_m: null, default_bar_length_m: null, kg_per_unit: null,
      material_grade: null, pack_size: null, pack_unit: null, open_style: null,
      pcs_per_ctn: null, finish: null, shelf_location: null, min_stock: 0, barcode: null,
      needs_review: true, needs_review_fields: [], is_active: true,
      last_purchase_price: 12000, default_supplier_id: 's1', over_tolerance_pct: 5,
    } // prettier-ignore
    api.mockImplementation((url: string, opt?: { method?: string }) => {
      if (opt?.method === 'PATCH') return Promise.resolve({ material: { ...M, needs_review: false, shelf_location: 'BB-H' } }) // prettier-ignore
      if (url === '/api/dept/warehouse/materials/a')
        return Promise.resolve({ material: M })
      if (url.includes('/changes')) return Promise.resolve({ changes: [] })
      if (url.includes('/price-history')) return Promise.resolve({ prices: [] })
      if (url.includes('material-taxonomy'))
        return Promise.resolve({ units: ['Cái', 'Kg'], groups: [{ name: 'Bao bì - đóng gói - tem nhãn', subs: [], grades: [], finishes: [], po_template: null }], packUnits: [] }) // prettier-ignore
      return Promise.resolve({ rows: [], similar: [] })
    })
    dung()
    fireEvent.doubleClick(screen.getByText('BAO0687'))
    const hop = await screen.findByRole('dialog', { name: 'Sửa mã BAO0687' })
    expect(within(hop).queryByText(/Rà mã|đã rà/)).toBeNull()
    expect(within(hop).getByText(/Cung ứng giữ · chỉ xem/)).toBeTruthy()
    const ke = within(hop).getByLabelText('Kệ gợi ý')
    fireEvent.change(ke, { target: { value: 'BB-H' } })
    fireEvent.blur(ke)
    fireEvent.click(within(hop).getByRole('button', { name: 'Lưu' }))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    const patch = api.mock.calls.find(
      (c) => (c[1] as { method?: string })?.method === 'PATCH',
    )!
    expect(patch[0]).toBe('/api/dept/warehouse/materials/a')
    const body = (patch[1] as { body: Record<string, unknown> }).body
    expect(body).toMatchObject({
      shelf_location: 'BB-H',
      min_stock: 0,
    })
    for (const k of [
      'last_purchase_price',
      'default_supplier_id',
      'over_tolerance_pct',
      'code',
      'needs_review',
    ])
      expect(k in body).toBe(false)
    expect(screen.getByRole('status').textContent).toMatch(/^Đã lưu BAO0687.$/)
  })
})
