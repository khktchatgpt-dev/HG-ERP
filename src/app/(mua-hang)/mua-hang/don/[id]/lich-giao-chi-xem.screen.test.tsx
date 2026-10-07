// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ToastProvider } from '@/components/kit'
import { ToastProvider as UiToastProvider } from '@/components/ui/Toast'
import fixtures from '@/test/fixtures/don-chi-tiet.json'
import { DonChungTuScreen } from './DonChungTuScreen'

/**
 * LỊCH GIAO CHỈ XEM Ở TRANG ĐƠN (07/10/2026 — chủ dự án chốt "một nơi").
 *
 * Đơn đã gửi NCC có một đợt "xe đã tới" ôm 100% số đặt — đúng ca PO-2026-0084
 * từng ăn lỗi "vượt SL đặt" khi sửa đợt trong chế độ Sửa. Nay trang đơn không
 * còn nút nào ghi đợt; mọi thứ dẫn sang hộp Giao nhận của Theo dõi đơn hàng.
 */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/mua-hang/don/x',
}))
vi.mock('@/lib/api', async (orig) => ({
  ...(await orig<typeof import('@/lib/api')>()),
  api: vi.fn(async () => ({})),
}))
beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(JSON.stringify({ notes: [] })))),
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

type Props = Parameters<typeof DonChungTuScreen>[0]
function donDaGui(): Props {
  const p = structuredClone(fixtures['da-gui']) as unknown as Props
  const line = p.lines.find((l) => l.material_id)!
  return {
    ...p,
    shipments: [
      {
        id: 's1',
        po_id: p.po!.id,
        code: 'GH-2026-0020',
        seq: 1,
        expected_date: '2026-10-01',
        method: null,
        place: null,
        note: null,
        status: 'arrived',
        created_at: '2026-09-30T02:01:14Z',
        lines: [{ po_line_id: line.id!, qty: Number(line.qty_ordered) }],
      },
    ] as unknown as Props['shipments'],
  }
}
const view = (p: Props) => {
  render(
    <UiToastProvider>
      <ToastProvider>
        <DonChungTuScreen {...p} />
      </ToastProvider>
    </UiToastProvider>,
  )
  // Màn đơn chia mục bằng menu ngang (Radix Tabs: chọn bằng mousedown).
  fireEvent.mouseDown(screen.getByRole('tab', { name: /Giao & nhận/ }), { button: 0 })
}

describe('Trang đơn — lịch giao chỉ xem', () => {
  it('có lối sang hộp Giao nhận, không có nút ghi đợt nào', () => {
    const p = donDaGui()
    view(p)
    const link = screen.getByRole('link', { name: /Sửa lịch giao ở Giao nhận/ })
    expect(link.getAttribute('href')).toBe(`/mua-hang/theo-doi?don=${p.po!.id}`)
    expect(screen.getByText('GH-2026-0020')).toBeTruthy()
    for (const ten of [
      'Lấy trước',
      'Dời ngày',
      'Huỷ đợt',
      'Xe tới',
      'Thêm đợt giao',
      'NCC xác nhận',
    ]) {
      expect(screen.queryByRole('button', { name: ten })).toBeNull()
    }
  })

  it('bấm Sửa: không còn lưới chia đợt "đang sửa"', () => {
    view(donDaGui())
    const sua = screen.queryAllByRole('button', { name: /^Sửa/ })[0]
    if (sua) fireEvent.click(sua)
    expect(screen.queryByText(/Đợt giao · đang sửa/)).toBeNull()
    expect(screen.queryByText(/bấm Lưu ở đầu trang để ghi; bỏ cột = huỷ đợt/)).toBeNull()
  })
})
