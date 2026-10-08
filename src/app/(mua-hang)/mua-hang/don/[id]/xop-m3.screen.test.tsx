// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, within } from '@testing-library/react'
import { ToastProvider } from '@/components/kit'
import { ToastProvider as UiToastProvider } from '@/components/ui/Toast'
import fixtures from '@/test/fixtures/don-chi-tiet.json'
import { DonChungTuScreen } from './DonChungTuScreen'

/**
 * XỐP TÍNH THEO m³ TRÊN MÀN ĐƠN (08/10/2026). User đưa bảng NCC "Mouse mê Relax
 * 580x540x60 × 250 = 4,698 m³" và bảo "mẫu đơn đặt NCC tự tính chưa chính xác".
 * Số m³ đúng từ đầu; chỗ sai là khay chi tiết: ô "Tương đương" đọc ô "Giá theo"
 * (trống = mặc định) thay vì cơ sở tiền THẬT nên đảo chiều quy đổi — bày
 * "53.214.134 / " (giá/tấm nếu giá là theo tấm, thiếu cả đơn vị) trong khi tiền
 * dòng đã tính theo m³; nhãn "Theo đơn vị quy đổi (null)". Bài này dựng nguyên
 * màn (đơn nháp giả, không đụng DB), gõ đúng dòng của user và soi chữ hiện ra.
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
  localStorage.setItem('hg.mua-hang.don.chi-tiet-dong', '1')
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
  localStorage.clear()
  vi.unstubAllGlobals()
})

type Props = Parameters<typeof DonChungTuScreen>[0]
type FxLine = Props['lines'][number]

/** Đơn xốp NHÁP một dòng trống thông số — dữ liệu giả. */
function donXop(): Props {
  const p = structuredClone(fixtures['cho-duyet']) as unknown as Props
  const g = p.lines[0]
  const blank: FxLine = {
    ...g,
    material_code: 'XM-0108',
    material_name: 'Mouse Mê Relax',
    material_unit: 'Tấm',
    qty_ordered: 250,
    unit_price: 1_000_000,
    price_basis: 'unit',
    qty2: null,
    unit2: null,
    spec: null,
    note: null,
    material_grade: null,
    dm_per_sp: null,
    qty_demand: null,
    qty_on_hand: null,
    die_code: null,
    weight_per_m: null,
    bar_length_m: null,
    dimension_text: null,
    finish: null,
    weight_per_unit: null,
    m3_per_unit: null,
    warranty_text: null,
    open_style: null,
    pcs_per_ctn: null,
    inner_l_mm: null,
    inner_w_mm: null,
    inner_h_mm: null,
    area_m2: null,
    price_per_m2: null,
    print_fee: null,
    carton_basis: null,
    pack_size: null,
    pack_unit: null,
    unit2_per_unit: null,
    lsx_split: [],
  }
  return {
    ...p,
    mode: 'edit',
    po: { ...p.po!, status: 'draft', template: 'foam' },
    lines: [blank],
  }
}
const view = (p: Props) => (
  <UiToastProvider>
    <ToastProvider>
      <DonChungTuScreen {...p} />
    </ToastProvider>
  </UiToastProvider>
)
const khu = () => within(document.getElementById('dong-hang') ?? document.body)
function go(label: string, value: string) {
  const el = khu().getAllByLabelText(label)[0] as HTMLInputElement
  fireEvent.focus(el)
  fireEvent.change(el, { target: { value } })
  fireEvent.blur(el)
}
const o = (label: string) => khu().getAllByLabelText(label)[0] as HTMLInputElement
const chu = () =>
  (document.getElementById('dong-hang')?.textContent ?? '').replace(/\s+/g, ' ')

describe('đơn xốp — gõ quy cách 580x540x60, 250 tấm, 1.000.000đ/m³', () => {
  it('Tổng m³ 4,698 · tính theo m³ · tiền 4.698.000 · tương đương 18.792/Tấm · nhãn m³', () => {
    render(view(donXop()))
    go('Quy cách', '580x540x60')
    go('SL đặt', '250')
    go('Đơn giá', '1000000')
    expect([o('D×R×Dày (mm) dài').value, o('D×R×Dày (mm) rộng').value, o('D×R×Dày (mm) cao').value]).toEqual(['580', '540', '60']) // prettier-ignore
    expect(o('Tổng m³').placeholder).toBe('4,698')
    expect((o('Tính theo') as unknown as HTMLSelectElement).value).toBe('m3')
    const t = chu()
    expect(t).toContain('Thành tiền4.698.000')
    // Giá/m³ 1.000.000 × 0,018792 m³/tấm = 18.792đ/tấm — chiều quy đổi theo tiền THẬT.
    expect(t).toContain('≈ 18.792 / Tấm')
    expect(t).not.toContain('(null)')
    expect(t).toContain('Theo đơn vị quy đổi (m³)')
  })
})
