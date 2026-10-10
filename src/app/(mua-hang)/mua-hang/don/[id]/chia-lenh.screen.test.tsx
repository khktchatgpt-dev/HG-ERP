// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, within } from '@testing-library/react'
import { ToastProvider } from '@/components/kit'
import { ToastProvider as UiToastProvider } from '@/components/ui/Toast'
import fixtures from '@/test/fixtures/don-chi-tiet.json'
import { poUpdateSchema } from '@/modules/dept/supply/pos.schema'
import { DonChungTuScreen } from './DonChungTuScreen'

/**
 * ĐƠN GỘP HAI LỆNH TRÊN MÀN THẬT (10/10/2026 — "gộp lệnh khi mua thì làm sao biết
 * lệnh nào bao nhiêu"). Đơn NHÁP giả gộp lệnh 08 (chính) + 09, nhu cầu lấy từ
 * API giả: 800 cho 08, 550 cho 09. Gõ SL đặt → lưới bày cột "Chia lệnh" và bản
 * lưu mang phần chia đúng, qua được schema server.
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

type Props = Parameters<typeof DonChungTuScreen>[0]
const L08 = '00000000-0000-4000-8000-000000000008'
const L09 = '00000000-0000-4000-8000-000000000009'

function donGop(need08: number, need09: number): { props: Props; mat: string } {
  const p = structuredClone(fixtures['cho-duyet']) as unknown as Props
  const mat = p.lines[0].material_id!
  api.mockImplementation((url: string) =>
    Promise.resolve(
      url.includes('/needs?')
        ? {
            needs: [
              {
                material_id: mat,
                material_code: 'VT-THU',
                material_name: 'Vật tư THỬ',
                unit: 'Cái',
                qty_needed: need08 + need09,
                available: 0,
                suggest: need08 + need09,
                by_lsx: [
                  { production_order_id: L08, need: need08, needed: need08 },
                  { production_order_id: L09, need: need09, needed: need09 },
                ],
              },
            ],
          }
        : { po: { id: 'x', code: 'x' } },
    ),
  )
  return {
    mat,
    props: {
      ...p,
      mode: 'edit',
      po: { ...p.po!, status: 'draft', production_order_id: L08 },
      extraLsx: [{ id: L09, code: '09/26-27 - LAURA' }],
      lsxs: [
        { id: L08, code: '08/26-27 - LAURA', customer_name: 'LAURA', order_codes: [] },
        { id: L09, code: '09/26-27 - LAURA', customer_name: 'LAURA', order_codes: [] },
      ] as Props['lsxs'],
      lines: [{ ...p.lines[0], qty_ordered: 0, unit_price: 1000, price_basis: 'unit', qty2: null, lsx_split: [] }], // prettier-ignore
    },
  }
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(JSON.stringify({ notes: [] })))),
  )
})
afterEach(() => {
  cleanup()
  api.mockReset()
  localStorage.clear()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

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
const nhuCauDaVe = () =>
  vi.waitFor(() => expect(api.mock.calls.some(([u]) => String(u).includes('/needs?'))).toBe(true)) // prettier-ignore

describe('đơn gộp hai lệnh — chia SL đặt cho từng lệnh (đơn GIẢ)', () => {
  it('đặt đúng nhu cầu 1.350: 08 = 800, 09 = 550; lưới bày cột Chia lệnh', async () => {
    const { props } = donGop(800, 550)
    render(view(props))
    await nhuCauDaVe()
    await new Promise((r) => setTimeout(r, 0))
    go('SL đặt', '1350')
    await vi.waitFor(() =>
      expect(khu().getByText('08 LAURA 800 · 09 LAURA 550')).toBeTruthy(),
    )
    const l = await ctrlS()
    expect(l.lsx_split).toEqual([
      { production_order_id: L08, qty: 800 },
      { production_order_id: L09, qty: 550 },
    ])
  })

  it('vật tư chỉ lệnh PHỤ cần: lưu trọn cho 09, không rơi về lệnh chính', async () => {
    const { props } = donGop(0, 300)
    render(view(props))
    await nhuCauDaVe()
    await new Promise((r) => setTimeout(r, 0))
    go('SL đặt', '300')
    const l = await ctrlS()
    expect(l.lsx_split).toEqual([{ production_order_id: L09, qty: 300 }])
  })

  it('đặt dư 1.500: phần dư ghi cho lệnh chính', async () => {
    const { props } = donGop(800, 550)
    render(view(props))
    await nhuCauDaVe()
    await new Promise((r) => setTimeout(r, 0))
    go('SL đặt', '1500')
    const l = await ctrlS()
    expect(l.lsx_split).toEqual([
      { production_order_id: L08, qty: 950 },
      { production_order_id: L09, qty: 550 },
    ])
  })
})
