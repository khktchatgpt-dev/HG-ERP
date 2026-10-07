// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ToastProvider } from '@/components/kit'
import { ToastProvider as UiToastProvider } from '@/components/ui/Toast'
import fixtures from '@/test/fixtures/don-chi-tiet.json'
import type { PoMaterial } from '@/lib/po-material.types'
import { poUpdateSchema } from '@/modules/dept/supply/pos.schema'
import { DonChungTuScreen } from './DonChungTuScreen'

/**
 * CÙNG VẬT TƯ NHIỀU DÒNG Ở MỌI MẪU ĐƠN (07/10/2026 — chủ dự án chốt).
 *
 * Dựng NGUYÊN màn đơn mua trên một đơn NHÁP giả (bản đóng băng, không đụng DB):
 *  · chọn lại một mã đã có trên đơn ở ô "Thêm vật tư" → thêm DÒNG MỚI (bản cũ
 *    nhảy về dòng cũ ở mọi mẫu trừ nhôm/sắt), danh sách gợi ý nói trước;
 *  · hai dòng cùng mã chỉ khác ghi chú → không báo trùng, lưu QUA luật server;
 *  · "Mã SP khách" của dòng nạp từ file đi theo bản lưu (trước đó lưu là mất).
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
const goc = structuredClone(fixtures['cho-duyet']) as unknown as Props
const dong0 = goc.lines[0]
const vatTu: PoMaterial = {
  id: dong0.material_id!,
  code: dong0.material_code,
  name: dong0.material_name,
  unit: dong0.material_unit,
  group_name: null,
  sub_group: null,
  spec: dong0.spec ?? null,
  kg_per_m: null,
  kg_per_unit: null,
  default_bar_length_m: null,
  price_unit: null,
  unit2_factor: null,
  vat_rate: null,
  default_supplier_id: null,
  last_purchase_price: null,
  pack_size: null,
  pack_unit: null,
  material_grade: null,
  on_hand: null,
  last_line: null,
}

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(JSON.stringify({ notes: [] })))),
  )
  api.mockImplementation((url: string) =>
    Promise.resolve(
      url.includes('/po-materials?')
        ? { materials: [vatTu] }
        : url.includes('/needs?')
          ? { needs: [] }
          : { po: { id: 'x', code: 'x' } },
    ),
  )
})
afterEach(() => {
  cleanup()
  api.mockReset()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  localStorage.clear()
})

/** Đơn NHÁP 2 dòng: dòng 1 mang mã SP khách (nạp từ file), dòng 2 mã khác. */
function donNhap(): Props {
  return {
    ...goc,
    mode: 'edit',
    po: { ...goc.po!, status: 'draft' },
    lines: [
      { ...dong0, product_code: '21610-217', note: 'bàn tròn' } as Props['lines'][number],
      goc.lines[1],
    ],
  }
}
const view = (p: Props) =>
  render(
    <UiToastProvider>
      <ToastProvider>
        <DonChungTuScreen {...p} />
      </ToastProvider>
    </UiToastProvider>,
  )
const luu = () => api.mock.calls.filter(([u]) => String(u).includes('/supply/pos'))
type Body = { lines: { material_id: string; note?: string | null; product_code?: string | null; qty_ordered: number }[] } // prettier-ignore
async function ctrlS(): Promise<Body> {
  const truoc = luu().length
  fireEvent.keyDown(window, { key: 's', ctrlKey: true })
  await vi.waitFor(() => expect(luu().length).toBe(truoc + 1))
  return (luu().at(-1)![1] as { body: Body }).body
}

describe('màn đơn mua — cùng vật tư nhiều dòng (đơn GIẢ)', () => {
  it('chọn lại mã đã có → thêm dòng mới, gợi ý nói trước; khác ghi chú thì không báo trùng; lưu giữ mã SP', async () => {
    view(donNhap())
    const o = screen.getByRole('combobox', { name: 'Thêm vật tư' })
    fireEvent.change(o, { target: { value: dong0.material_code } })
    expect(
      await screen.findByText('Đã có trên đơn — chọn sẽ thêm một dòng mới'),
    ).toBeTruthy()
    await screen.findAllByRole('option')
    fireEvent.keyDown(o, { key: 'Enter' })

    // Dòng 3 mới cùng mã; ghi chú để phân biệt (chia theo SP).
    const ghiChu3 = await screen.findByRole('textbox', { name: 'Ghi chú dòng 3' })
    fireEvent.change(ghiChu3, { target: { value: 'bàn chữ nhật' } })
    fireEvent.blur(ghiChu3)
    const sl = screen.getAllByRole('textbox', { name: 'SL đặt' })
    fireEvent.change(sl[2], { target: { value: '40' } })
    fireEvent.blur(sl[2])
    const gia = screen.getAllByRole('textbox', { name: 'Đơn giá' })
    fireEvent.change(gia[2], { target: { value: '5000' } })
    fireEvent.blur(gia[2])
    expect(screen.queryByText(/trùng dòng/)).toBeNull()

    const body = await ctrlS()
    const cungMa = body.lines.filter((l) => l.material_id === dong0.material_id)
    expect(cungMa.map((l) => [l.note, l.product_code ?? null])).toEqual([
      ['bàn tròn', '21610-217'],
      ['bàn chữ nhật', null],
    ])
    const r = poUpdateSchema.safeParse(body)
    expect(r.success, JSON.stringify(r.error?.issues)).toBe(true)
  })

  it('lỡ chọn cùng mã hai lần (hai dòng mới giống hệt) → cảnh báo trùng + nút Gộp', async () => {
    view(donNhap())
    const o = screen.getByRole('combobox', { name: 'Thêm vật tư' })
    for (let lan = 0; lan < 2; lan++) {
      fireEvent.change(o, { target: { value: dong0.material_code } })
      await screen.findAllByText('Đã có trên đơn — chọn sẽ thêm một dòng mới')
      fireEvent.keyDown(o, { key: 'Enter' })
      await screen.findByRole('textbox', { name: `Ghi chú dòng ${3 + lan}` })
    }
    expect(await screen.findByText(/Dòng 4 trùng dòng 3/)).toBeTruthy()
    // Dòng 1 (có mã SP + ghi chú riêng) KHÔNG bị coi là trùng với dòng mới.
    expect(screen.queryByText(/trùng dòng 1/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Gộp dòng 4 vào dòng 3' })).toBeTruthy()
  })
})
