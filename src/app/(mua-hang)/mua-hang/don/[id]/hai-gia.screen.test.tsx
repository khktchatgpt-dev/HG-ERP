// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, within } from '@testing-library/react'
import { ToastProvider } from '@/components/kit'
import { ToastProvider as UiToastProvider } from '@/components/ui/Toast'
import fixtures from '@/test/fixtures/don-chi-tiet.json'
import type { PoTemplate } from '@/lib/po-template'
import { poUpdateSchema } from '@/modules/dept/supply/pos.schema'
import { DonChungTuScreen } from './DonChungTuScreen'

/**
 * HAI CỘT GIÁ TRÊN MÀN THẬT (10/10/2026 — sếp: nhôm, sắt/inox, gỗ, kính "ngoài giá
 * theo ĐVT cần có giá theo kg hoặc m³"). Dựng nguyên màn đơn NHÁP giả (không đụng
 * DB), soi hai ô giá, gõ vào từng ô rồi Ctrl+S: payload phải đổi cơ sở tiền theo
 * đúng ô vừa gõ và qua được schema server.
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
  localStorage.clear()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

type Props = Parameters<typeof DonChungTuScreen>[0]
type FxLine = Props['lines'][number]

function donNhap(template: PoTemplate, line: Partial<FxLine>): Props {
  const p = structuredClone(fixtures['cho-duyet']) as unknown as Props
  return {
    ...p,
    mode: 'edit',
    po: { ...p.po!, status: 'draft', template },
    lines: [{ ...p.lines[0], qty_ordered: 10, qty2: null, lsx_split: [], ...line }],
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
const o = (label: string) => khu().getByLabelText(label) as HTMLInputElement
/** Số trong ô (bỏ dấu chấm nghìn của vi-VN). */
const so = (label: string) => Number(o(label).value.replace(/\./g, '').replace(',', '.'))
function go(label: string, value: string) {
  const el = o(label)
  fireEvent.focus(el)
  fireEvent.change(el, { target: { value } })
  fireEvent.blur(el)
}
const luu = () => api.mock.calls.filter(([u]) => String(u).includes('/supply/pos/'))
async function ctrlS(): Promise<Record<string, unknown>> {
  const truoc = luu().length
  fireEvent.keyDown(window, { key: 's', ctrlKey: true })
  await vi.waitFor(() => expect(luu().length).toBe(truoc + 1))
  const body = luu().at(-1)![1] as { body: { lines: Record<string, unknown>[] } }
  const r = poUpdateSchema.safeParse(body.body)
  expect(r.success, JSON.stringify(r.error?.issues)).toBe(true)
  return body.body.lines[0]
}

describe('hai cột giá — gõ ô nào tính tiền theo ô đó (đơn GIẢ)', () => {
  it('nhôm: 0,5 kg/m × 6 m → 80.000 đ/kg = 240.000 đ/cây; gõ giá cây thì tiền theo cây', async () => {
    render(
      view(
        donNhap('aluminium', {
          weight_per_m: 0.5,
          bar_length_m: 6,
          unit_price: 80_000,
          price_basis: 'unit2',
        }),
      ),
    )
    expect(so('Đơn giá kg')).toBe(80_000)
    expect(so('Đơn giá')).toBe(240_000)

    go('Đơn giá', '250000')
    const cay = await ctrlS()
    expect([cay.unit_price, cay.price_per]).toEqual([250_000, 'unit'])
  })

  it('nhôm: dòng đang theo cây (giá 240.000), gõ giá kg thì về tiền theo kg', async () => {
    render(view(donNhap('aluminium', { weight_per_m: 0.5, bar_length_m: 6, unit_price: 240_000, price_basis: 'unit' }))) // prettier-ignore
    expect(so('Đơn giá kg')).toBe(80_000)
    go('Đơn giá kg', '90000')
    const kg = await ctrlS()
    expect([kg.unit_price, kg.price_per]).toEqual([90_000, 'unit2'])
  })

  it('kính: 0,5 m²/tấm, theo tấm 100.000 → 200.000 đ/m²; gõ giá m² thì chốt "Tính theo" m²', async () => {
    render(
      view(
        donNhap('glass', {
          area_m2: 0.5,
          carton_basis: 'ctn',
          unit_price: 100_000,
          price_basis: 'unit',
        }),
      ),
    )
    expect(so('Đơn giá m²')).toBe(200_000)
    go('Đơn giá m²', '210000')
    const l = await ctrlS()
    expect([l.unit_price, l.carton_basis, l.price_per]).toEqual([210_000, 'm2', null])
  })

  it('sắt: chưa có kg / đơn vị thì ô giá kg nói thiếu gì, không cho gõ', () => {
    render(view(donNhap('metal_kg', { weight_per_unit: null, unit_price: 50_000, price_basis: 'unit' }))) // prettier-ignore
    expect(khu().queryByLabelText('Đơn giá kg')).toBeNull()
    expect(khu().getByText('cần kg / đơn vị')).toBeTruthy()
  })
})
