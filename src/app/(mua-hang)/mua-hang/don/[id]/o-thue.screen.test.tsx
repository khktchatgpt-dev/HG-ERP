// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToastProvider } from '@/components/kit'
import { ToastProvider as UiToastProvider } from '@/components/ui/Toast'
import fixtures from '@/test/fixtures/don-chi-tiet.json'
import { DonChungTuScreen } from './DonChungTuScreen'

/**
 * Ô THUẾ THEO NCC TRÊN MÀN SOẠN THẬT (B1 bản vẽ Đầu đơn, 11/10/2026). Đơn MỚI
 * giả, hai NCC giả: Visa từng dùng 10% đã gồm (6 đơn) và 0%; Sapa chỉ khai 8%
 * trong hồ sơ. Chọn NCC → ô Thuế theo NCC; tự chọn rồi thì đổi NCC không đè.
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/mua-hang/don/moi',
}))
vi.mock('@/lib/api', async (orig) => ({
  ...(await orig<typeof import('@/lib/api')>()),
  api: vi.fn(() => Promise.resolve({ needs: [] })),
}))

type Props = Parameters<typeof DonChungTuScreen>[0]
const VISA = '00000000-0000-4000-8000-0000000000a1'
const SAPA = '00000000-0000-4000-8000-0000000000a2'
const ncc = (id: string, name: string, vat_rate: number | null = null) => ({ id, name, currency: null, payment_terms: null, lead_time_days: null, can_order: true, lock_reason: null, moq: null, vat_rate }) // prettier-ignore

function donMoi(): Props {
  const p = structuredClone(fixtures['cho-duyet']) as unknown as Props
  return {
    ...p,
    mode: 'create',
    po: null,
    lines: [],
    statusLines: [],
    suppliers: [ncc(VISA, 'THÉP VISA GIẢ'), ncc(SAPA, 'SƠN SAPA GIẢ', 8)],
    lastTemplates: {},
    thueNcc: { [VISA]: { rate: 10, incl: true, n: 6, kieu: 2 } },
  }
}

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ notes: [] }))))) // prettier-ignore
})
afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.unstubAllGlobals()
})

const view = (p: Props) =>
  render(
    <UiToastProvider>
      <ToastProvider>
        <DonChungTuScreen {...p} />
      </ToastProvider>
    </UiToastProvider>,
  )
const thue = () =>
  screen.getAllByRole('combobox', { name: 'Kiểu thuế' })[0] as HTMLInputElement
async function chon(name: string, go: string) {
  await userEvent.click(screen.getAllByRole('combobox', { name })[0])
  await userEvent.keyboard(go)
  await userEvent.keyboard('{Enter}')
}

describe('ô Thuế theo NCC — đơn mới (dữ liệu GIẢ)', () => {
  it('chọn NCC đã có đơn → thuế của đơn gần nhất + nói nguồn', async () => {
    view(donMoi())
    await chon('Nhà cung cấp', 'visa')
    expect(thue().value).toBe('VAT 10% · giá đã gồm')
    expect(screen.getAllByTitle('theo 6 đơn trước của NCC · NCC từng dùng 2 kiểu').length).toBeGreaterThan(0) // prettier-ignore
  })

  it('NCC chưa có đơn nhưng hồ sơ khai VAT → lấy hồ sơ, giá chưa gồm', async () => {
    view(donMoi())
    await chon('Nhà cung cấp', 'sapa')
    expect(thue().value).toBe('VAT 8% · giá chưa gồm')
    expect(screen.getAllByText('theo hồ sơ NCC').length).toBeGreaterThan(0)
  })

  it('đã tự chọn thuế → đổi NCC không đè; hiện kiểu thường của NCC để nhìn lại', async () => {
    view(donMoi())
    await chon('Kiểu thuế', 'không vat')
    expect(thue().value).toBe('Không VAT')
    await chon('Nhà cung cấp', 'visa')
    expect(thue().value).toBe('Không VAT')
    expect(screen.getAllByText('NCC thường 10% đã gồm').length).toBeGreaterThan(0)
  })
})
