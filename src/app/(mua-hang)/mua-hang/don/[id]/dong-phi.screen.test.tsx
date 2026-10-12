// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { ToastProvider } from '@/components/kit'
import { ToastProvider as UiToastProvider } from '@/components/ui/Toast'
import fixtures from '@/test/fixtures/don-chi-tiet.json'
import { poUpdateSchema } from '@/modules/dept/supply/pos.schema'
import {
  dongKhongMaLaPhi,
  FREE_LINE_TEMPLATES,
  PO_TEMPLATES,
  type PoTemplate,
} from '@/lib/po-template'
import { DonChungTuScreen } from './DonChungTuScreen'

/**
 * SỬA ĐƠN CÓ DÒNG PHÍ / DỊCH VỤ (0234) — 13/10/2026: chị Nga sửa giá PO-2026-0176
 * (bao bì carton + dòng "Công dán + keo bồi") rồi Lưu thì bị chặn "Dòng hàng không
 * gắn vật tư chỉ dùng được ở mẫu Gỗ". Dựng NGUYÊN màn sửa đơn nháp, Ctrl+S, soi
 * payload: dòng phí phải đi lên với `line_kind: 'phi'`.
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
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ notes: [] }))))) // prettier-ignore
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

function donCoPhi(template: PoTemplate = 'carton'): Props {
  const p = structuredClone(fixtures['cho-duyet']) as unknown as Props
  const g = p.lines[0]
  // Dòng hàng đủ thông số mọi mẫu (nhôm kg/m + dài cây, sắt kg/đv, gỗ m³/SP) — để chỉ dòng PHÍ là biến số.
  const hang = { ...g, id: 'l-hang', qty_ordered: 557, unit_price: 43_960, price_basis: 'unit', qty2: null, unit2: null, carton_basis: 'ctn', weight_per_m: 1, bar_length_m: 6, weight_per_unit: 1, m3_per_unit: 0.01, lsx_split: [] } // prettier-ignore
  const phi = {
    ...g,
    id: 'l-phi',
    material_id: null,
    material_code: '',
    material_name: 'Công dán + keo bồi',
    material_unit: 'Thùng',
    line_name: 'Công dán + keo bồi',
    line_unit: 'Thùng',
    line_kind: 'phi',
    qty_ordered: 557,
    unit_price: 3_000,
    price_basis: 'unit',
    qty2: null,
    unit2: null,
    lsx_split: [],
  }
  return { ...p, mode: 'edit', po: { ...p.po!, status: 'draft', template }, lines: [hang, phi] as Props['lines'] } // prettier-ignore
}

describe('sửa đơn có dòng phí / dịch vụ (0234)', () => {
  it('Ctrl+S: dòng phí đi lên với line_kind phi, không gắn vật tư — qua luật server', async () => {
    render(
      <UiToastProvider>
        <ToastProvider>
          <DonChungTuScreen {...donCoPhi()} />
        </ToastProvider>
      </UiToastProvider>,
    )
    fireEvent.keyDown(window, { key: 's', ctrlKey: true })
    const luu = () => api.mock.calls.filter(([u]) => String(u).includes('/supply/pos/'))
    await vi.waitFor(() => expect(luu().length).toBeGreaterThan(0))
    const body = luu().at(-1)![1] as { body: { lines: Record<string, unknown>[] } }
    const phi = body.body.lines.find((l) => l.line_name === 'Công dán + keo bồi')
    expect(phi, JSON.stringify(body.body.lines.map((l) => [l.material_id, l.line_name, l.line_kind]))).toBeTruthy() // prettier-ignore
    expect(phi!.material_id).toBeNull()
    expect(phi!.line_kind).toBe('phi')
    expect(poUpdateSchema.safeParse(body.body).success).toBe(true)
  })
})

/** Luật chặn của server (pos.service `assertFreeLinesAllowed`) — chép để soi payload. */
function serverChan(
  t: PoTemplate,
  lines: { material_id?: string | null; line_kind?: string | null }[],
) {
  const ds = dongKhongMaLaPhi(t, lines)
  if (FREE_LINE_TEMPLATES.includes(t)) return null
  return ds.some((l) => !l.material_id && l.line_kind !== 'phi') ? 'chặn' : null
}

describe('dòng phí ở MỌI mẫu — sửa đơn rồi lưu không bị chặn (13/10/2026)', () => {
  it.each(PO_TEMPLATES)('mẫu %s', async (t) => {
    render(
      <UiToastProvider>
        <ToastProvider>
          <DonChungTuScreen {...donCoPhi(t)} />
        </ToastProvider>
      </UiToastProvider>,
    )
    fireEvent.keyDown(window, { key: 's', ctrlKey: true })
    const luu = () => api.mock.calls.filter(([u]) => String(u).includes('/supply/pos/'))
    await vi.waitFor(() => expect(luu().length).toBeGreaterThan(0))
    const lines = (luu().at(-1)![1] as { body: { lines: Record<string, unknown>[] } })
      .body.lines
    const phi = lines.find((l) => l.line_name === 'Công dán + keo bồi')!
    expect(phi.line_kind, t).toBe('phi')
    expect(phi.material_id, t).toBeNull()
    expect(serverChan(t, lines as never), t).toBeNull()
  })

  it('tab / nháp CŨ gửi dòng phí thiếu cờ: server tự nhận là phí, không chặn (mọi mẫu)', () => {
    for (const t of PO_TEMPLATES)
      expect(
        serverChan(t, [{ material_id: 'vt' }, { material_id: null, line_kind: null }]),
        t,
      ).toBeNull()
  })
})
