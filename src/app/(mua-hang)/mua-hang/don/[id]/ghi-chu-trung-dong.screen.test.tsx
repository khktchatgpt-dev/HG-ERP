// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ToastProvider } from '@/components/kit'
import { ToastProvider as UiToastProvider } from '@/components/ui/Toast'
import fixtures from '@/test/fixtures/don-chi-tiet.json'
import { poUpdateSchema } from '@/modules/dept/supply/pos.schema'
import { DonChungTuScreen } from './DonChungTuScreen'

/**
 * THỬ CẢ MÀN ĐƠN MUA — cột Ghi chú + cùng vật tư nhiều dòng (30/09/2026).
 *
 * Dựng NGUYÊN màn thật (không phải từng khối) trên một đơn nhôm GIẢ, dựng từ
 * bản đóng băng của design-lab — không đụng đơn nào trong DB. Kịch bản như anh
 * Truyền làm với đơn GIGA: ba dòng cùng cây hộp 25x50 mềm, khác chiều dài cắt,
 * mỗi dòng một ghi chú; sửa ghi chú, Ctrl+S; rồi gõ trùng chiều dài → cảnh báo
 * → Gộp → lưu. Bản gửi đi phải QUA đúng luật server (`poUpdateSchema`).
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/mua-hang/don/x',
}))
const api = vi.fn()
vi.mock('@/lib/api', async (orig) => ({
  ...(await orig<typeof import('@/lib/api')>()),
  api: (...a: unknown[]) => api(...a),
}))
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(JSON.stringify({ notes: [] })))),
  )
  api.mockImplementation((url: string) =>
    Promise.resolve(
      url.includes('/needs?') ? { needs: [] } : { po: { id: 'x', code: 'x' } },
    ),
  )
})
afterEach(() => {
  cleanup()
  api.mockReset()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

type Props = Parameters<typeof DonChungTuScreen>[0]
type FxLine = Props['lines'][number]

/** Đơn NHÁP mẫu nhôm, 3 dòng CÙNG vật tư khác chiều dài — dữ liệu giả. */
function donNhomGia(): Props {
  const p = structuredClone(fixtures['cho-duyet']) as unknown as Props
  const goc = p.lines[0]
  const dong = (i: number, len: number, qty: number, note: string): FxLine => ({
    ...p.lines[i],
    material_id: goc.material_id,
    material_code: 'NH-TEST',
    material_name: 'Hộp 25x50x1.2li Nhôm mềm (THỬ)',
    material_unit: 'Cây',
    spec: 'Hộp 25x50 mềm T1.2',
    weight_per_m: 0.47,
    bar_length_m: len,
    qty_ordered: qty,
    unit_price: 108000,
    price_basis: 'unit2',
    unit2: 'kg',
    note,
    pcs_per_ctn: null,
    carton_basis: null,
    price_per_m2: null,
    area_m2: null,
    lsx_split: [],
  })
  return {
    ...p,
    mode: 'edit',
    po: { ...p.po!, status: 'draft', template: 'aluminium' },
    lines: [
      dong(0, 5.1, 29, 'Ghế 2 · Ngang mê trước'),
      dong(1, 5.3, 33, 'Ghế 3 · Đố trước'),
      dong(2, 6, 137, 'Ghế 2-3 · Dọc mê'),
    ],
  }
}
const view = (p: Props) => (
  <UiToastProvider>
    <ToastProvider>
      <DonChungTuScreen {...p} />
    </ToastProvider>
  </UiToastProvider>
)
const luu = () => api.mock.calls.filter(([u]) => String(u).includes('/supply/pos/'))
async function ctrlS() {
  const truoc = luu().length
  fireEvent.keyDown(window, { key: 's', ctrlKey: true })
  await vi.waitFor(() => expect(luu().length).toBe(truoc + 1))
  return (luu().at(-1)![1] as { body: { lines: { material_id: string; bar_length_m: number | null; qty_ordered: number; note?: string | null }[] } }).body // prettier-ignore
}

describe('màn đơn mua — cột Ghi chú + cùng vật tư nhiều dòng (đơn GIẢ)', () => {
  it('ba dòng cùng cây khác chiều dài: có cột Ghi chú, KHÔNG báo trùng, sửa ghi chú rồi lưu QUA luật server', async () => {
    render(view(donNhomGia()))
    expect(screen.getByRole('columnheader', { name: 'Ghi chú' })).toBeTruthy()
    const o = (n: number) => screen.getByRole('textbox', { name: `Ghi chú dòng ${n}` }) as HTMLInputElement // prettier-ignore
    expect([o(1).value, o(2).value, o(3).value]).toEqual([
      'Ghế 2 · Ngang mê trước',
      'Ghế 3 · Đố trước',
      'Ghế 2-3 · Dọc mê',
    ])
    expect(screen.queryByText('Trùng dòng')).toBeNull()

    fireEvent.change(o(2), { target: { value: 'Ghế 3 · Đố trước + sau' } })
    fireEvent.blur(o(2))
    const body = await ctrlS()
    expect(body.lines.map((l) => [l.bar_length_m, l.note])).toEqual([
      [5.1, 'Ghế 2 · Ngang mê trước'],
      [5.3, 'Ghế 3 · Đố trước + sau'],
      [6, 'Ghế 2-3 · Dọc mê'],
    ])
    expect(new Set(body.lines.map((l) => l.material_id)).size).toBe(1)
    const r = poUpdateSchema.safeParse(body)
    expect(r.success, JSON.stringify(r.error?.issues)).toBe(true)
  })

  it('cùng chiều dài nhưng KHÁC ghi chú (chia theo SP) → hai dòng hợp lệ, không báo trùng (07/10/2026)', async () => {
    render(view(donNhomGia()))
    const dai = screen.getAllByRole('textbox', { name: 'Dài cây (m)' })
    fireEvent.change(dai[2], { target: { value: '5.3' } })
    fireEvent.blur(dai[2])
    expect(screen.queryByText(/Dòng 3 trùng dòng 2/)).toBeNull()
    const body = await ctrlS()
    expect(body.lines.map((l) => [l.bar_length_m, l.qty_ordered, l.note])).toEqual([
      [5.1, 29, 'Ghế 2 · Ngang mê trước'],
      [5.3, 33, 'Ghế 3 · Đố trước'],
      [5.3, 137, 'Ghế 2-3 · Dọc mê'],
    ])
    expect(poUpdateSchema.safeParse(body).success).toBe(true)
  })

  it('gõ trùng GIỐNG HỆT (cùng dài, cùng ghi chú) → cảnh báo trên lưới → Gộp → lưu còn 2 dòng, SL cộng dồn', async () => {
    render(view(donNhomGia()))
    const ghiChu3 = screen.getByRole('textbox', { name: 'Ghi chú dòng 3' })
    fireEvent.change(ghiChu3, { target: { value: 'Ghế 3 · Đố trước' } })
    fireEvent.blur(ghiChu3)
    const dai = screen.getAllByRole('textbox', { name: 'Dài cây (m)' })
    fireEvent.change(dai[2], { target: { value: '5.3' } })
    fireEvent.blur(dai[2])
    expect(await screen.findByText(/Dòng 3 trùng dòng 2/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Gộp dòng 3 vào dòng 2' }))
    expect(screen.queryByText(/Dòng 3 trùng dòng 2/)).toBeNull()
    const body = await ctrlS()
    expect(body.lines.map((l) => [l.bar_length_m, l.qty_ordered, l.note])).toEqual([
      [5.1, 29, 'Ghế 2 · Ngang mê trước'],
      [5.3, 170, 'Ghế 3 · Đố trước'],
    ])
    expect(poUpdateSchema.safeParse(body).success).toBe(true)
  })
})
