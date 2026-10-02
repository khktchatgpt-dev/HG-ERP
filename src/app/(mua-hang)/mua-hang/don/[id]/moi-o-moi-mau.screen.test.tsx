// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, within } from '@testing-library/react'
import { ToastProvider } from '@/components/kit'
import { ToastProvider as UiToastProvider } from '@/components/ui/Toast'
import fixtures from '@/app/design-lab/chup/_du-lieu/don-chi-tiet.json'
import { PO_FIELDS, type PoField } from '@/lib/po-fields'
import { deriveLine, QTY2_OVERRIDE_UNIT, type PoTemplate } from '@/lib/po-template'
import { poUpdateSchema } from '@/modules/dept/supply/pos.schema'
import { DonChungTuScreen } from './DonChungTuScreen'

/**
 * MỌI Ô NHẬP CỦA MỌI MẪU ĐƠN ĐỀU GÕ ĐƯỢC VÀ ĐI TỚI SERVER (02/10/2026).
 *
 * User báo: "có mẫu có cột định mức sản phẩm nhưng không cho nhập". Bài này dựng
 * NGUYÊN màn đơn mua (đơn NHÁP giả, không đụng DB) cho TỪNG mẫu trong `PO_FIELDS`,
 * mở khay "Chi tiết dòng", gõ vào từng ô khai trong mẫu, Ctrl+S, rồi soi payload
 * gửi đi: ô nào gõ mà số không tới server là ô "không cho nhập".
 *
 * Ô `calc` (Tổng kg / Tổng m³ / Tổng m²) CŨNG gõ được từ 02/10/2026 (user chốt
 * "cho ghi đè tổng thật"): số gõ đi dưới tên `qty2_override`, và `deriveLine` —
 * hàm server dùng khi lưu — phải ra đúng số đó làm `qty2`.
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
  vi.restoreAllMocks()
})

type Props = Parameters<typeof DonChungTuScreen>[0]
type FxLine = Props['lines'][number]

/** Đơn NHÁP một dòng, mọi thông số riêng của mẫu để TRỐNG — dữ liệu giả. */
function donNhap(template: PoTemplate): Props {
  const p = structuredClone(fixtures['cho-duyet']) as unknown as Props
  const g = p.lines[0]
  const blank: FxLine = {
    ...g,
    material_code: 'VT-THU',
    material_name: 'Vật tư THỬ',
    material_unit: 'Cái',
    qty_ordered: 10,
    unit_price: 1000,
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
    po: { ...p.po!, status: 'draft', template },
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
const luu = () => api.mock.calls.filter(([u]) => String(u).includes('/supply/pos/'))
async function ctrlS(): Promise<Record<string, unknown>> {
  const truoc = luu().length
  fireEvent.keyDown(window, { key: 's', ctrlKey: true })
  await vi.waitFor(() => expect(luu().length).toBe(truoc + 1))
  const body = luu().at(-1)![1] as { body: { lines: Record<string, unknown>[] } }
  // Bản gửi đi phải QUA đúng luật server.
  const r = poUpdateSchema.safeParse(body.body)
  expect(r.success, JSON.stringify(r.error?.issues)).toBe(true)
  return body.body.lines[0]
}

/** Gõ một giá trị vào ô có nhãn `label` (lưới hoặc khay) rồi rời ô để chốt. */
function go(label: string, value: string) {
  const khu = within(document.getElementById('dong-hang') ?? document.body)
  const el = khu.getAllByLabelText(label)[0] as HTMLInputElement
  expect(el.readOnly, `ô "${label}" đang chỉ-đọc`).toBe(false)
  expect(el.disabled, `ô "${label}" đang khoá`).toBe(false)
  fireEvent.focus(el)
  fireEvent.change(el, { target: { value } })
  fireEvent.blur(el)
}

/** Ô của mẫu → các lượt gõ + trường payload phải nhận được số đó. */
function kichBan(
  f: PoField,
  i: number,
): { label: string; value: string; field: string; want: unknown }[] {
  const num = 3 + i // mỗi ô một số khác nhau để không nhầm ô này với ô kia
  switch (f.kind) {
    case 'calc':
      return [{ label: f.label, value: '300', field: 'qty2_override', want: 300 }]
    case 'cartonBasis':
      return []
    case 'inner':
      return (['dài', 'rộng', 'cao'] as const).map((s, k) => ({
        label: `${f.label} ${s}`,
        value: String(100 + k),
        field: ['inner_l_mm', 'inner_w_mm', 'inner_h_mm'][k],
        want: 100 + k,
      }))
    case 'unit2':
      return [
        { label: `${f.label} số`, value: '17.5', field: 'unit2_per_unit', want: 17.5 },
        { label: `${f.label} đơn vị`, value: 'Lít', field: 'unit2_label', want: 'Lít' },
      ]
    case 'number':
    case 'area':
      return [{ label: f.label, value: String(num), field: f.field!, want: num }]
    case 'openStyle':
      return [{ label: f.label, value: 'MR', field: f.field!, want: 'MR' }]
    default:
      return [
        { label: f.label, value: `GÕ-${f.key}`, field: f.field!, want: `GÕ-${f.key}` },
      ]
  }
}

const TEMPLATES = Object.keys(PO_FIELDS) as PoTemplate[]

describe('mọi ô nhập của mọi mẫu đơn mua gõ được và tới server (đơn GIẢ)', () => {
  it.each(TEMPLATES)('mẫu %s', async (template) => {
    render(view(donNhap(template)))
    const fields = PO_FIELDS[template].filter((f) => !f.editHidden)
    const steps = fields.flatMap((f, i) => kichBan(f, i))
    for (const s of steps) go(s.label, s.value)
    // Ba ô chung của mọi mẫu.
    go('SL đặt', '42')
    go('Đơn giá', '1234')
    go('Ghi chú dòng 1', 'ghi chú thử')

    const line = await ctrlS()
    const got = Object.fromEntries(steps.map((s) => [s.label, line[s.field]]))
    const want = Object.fromEntries(steps.map((s) => [s.label, s.want]))
    expect(got).toEqual(want)
    expect([line.qty_ordered, line.unit_price, line.note]).toEqual([
      42,
      1234,
      'ghi chú thử',
    ])
    // Mẫu có cột tổng: server chạy deriveLine trên chính dòng này → tổng = số gõ tay.
    if (QTY2_OVERRIDE_UNIT[template]) {
      expect(deriveLine(template, line as Parameters<typeof deriveLine>[1]).qty2).toBe(300)
    }
  })
})
