// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToastProvider } from '@/components/kit'
import { ToastProvider as UiToastProvider } from '@/components/ui/Toast'
import fixtures from '@/test/fixtures/don-chi-tiet.json'
import { DonChungTuScreen } from './DonChungTuScreen'

/**
 * Ô "CHO VIỆC" TRÊN MÀN SOẠN THẬT (B2 bản vẽ Đầu đơn, 12/10/2026). Đơn MỚI giả:
 * một danh sách hai loại việc — lệnh SX và hạng mục ngoài sản xuất (0230); chọn
 * hạng mục thì cạnh ô bày "đã đặt / dự toán"; "+ Tạo hạng mục mới…" mở hộp tạo.
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
const HM = { id: '00000000-0000-4000-8000-0000000000b1', code: 'HM-2026-0009', name: 'Xây dựng văn phòng GIẢ', kind: 'Sửa chữa nhà xưởng', budget: 300_000_000, currency: 'VND', status: 'open' as const, n: 4, ordered: 128_400_000 } // prettier-ignore

function donMoi(): Props {
  const p = structuredClone(fixtures['cho-duyet']) as unknown as Props
  return { ...p, mode: 'create', po: null, lines: [], statusLines: [], lastTemplates: {}, hangMuc: [HM] } // prettier-ignore
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
const choViec = () =>
  screen.getAllByRole('combobox', { name: 'Cho việc' })[0] as HTMLInputElement
async function chon(go: string) {
  await userEvent.click(choViec())
  await userEvent.keyboard(go)
  await userEvent.keyboard('{Enter}')
}

describe('ô Cho việc — lệnh SX hoặc hạng mục (dữ liệu GIẢ)', () => {
  it('chọn hạng mục → ô ghi mã · tên, cạnh ô bày đã đặt / dự toán; "+ gộp lệnh" biến mất', async () => {
    view(donMoi())
    expect(screen.getAllByText('+ gộp lệnh').length).toBeGreaterThan(0)
    await chon('văn phòng')
    expect(choViec().value).toBe('HM-2026-0009 · Xây dựng văn phòng GIẢ')
    expect(screen.getAllByText(/128,4 tr \/ 300 tr/).length).toBeGreaterThan(0)
    expect(screen.queryAllByText('+ gộp lệnh')).toHaveLength(0)
  })

  it('"+ Tạo hạng mục mới…" mở hộp tạo — chưa có tên thì chưa lưu được', async () => {
    view(donMoi())
    await chon('tạo hạng mục')
    expect(screen.getByRole('dialog').textContent).toContain('Hạng mục mới')
    expect(screen.getByRole('dialog').textContent).toContain(
      'Chưa lưu được: chưa có tên hạng mục',
    )
  })
})
