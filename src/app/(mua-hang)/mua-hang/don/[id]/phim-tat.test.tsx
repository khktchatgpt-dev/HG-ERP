// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { ToastProvider } from '@/components/kit'
// Hộp 'Khai nhanh vật tư' (QuickAddMaterial) còn là hệ CŨ, dùng toast của components/ui.
import { ToastProvider as UiToastProvider } from '@/components/ui/Toast'
import fixtures from '@/app/design-lab/chup/_du-lieu/don-chi-tiet.json'
import { DonChungTuScreen } from './DonChungTuScreen'

/**
 * PHÍM TẮT CỦA MÀN ĐƠN MUA (28/09/2026).
 *
 * Ctrl+S = Lưu là phản xạ Excel của người mua. Bản trước gắn listener bằng một
 * effect KHÔNG có deps — mỗi lần màn dựng lại (mỗi phím gõ trong lưới) nó gỡ rồi
 * gắn lại hai listener trên window. Nay qua `useEffectEvent`: gắn MỘT lần khi vào
 * chế độ sửa, hàm vẫn đọc state mới nhất. Test canh cả hai vế: không gắn lại,
 * và Ctrl+S vẫn lưu đúng đơn.
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

// Khối Trao đổi (DocNotesPanel) còn gọi `fetch` THẲNG chứ không qua api() — chặn
// luôn, không thì lệnh gọi treo tới lúc happy-dom dọn cửa sổ và in AbortError.
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(JSON.stringify({ notes: [] })))),
  )
})
afterEach(() => vi.unstubAllGlobals())
// Mở chế độ sửa thì màn tự tải nhu cầu của lệnh — trả rỗng đúng dạng.
beforeEach(() =>
  api.mockImplementation((url: string) =>
    Promise.resolve(
      url.includes('/needs?') ? { needs: [] } : { po: { id: 'x', code: 'x' } },
    ),
  ),
)
afterEach(() => {
  cleanup()
  api.mockReset()
  vi.restoreAllMocks()
})

// Đơn chờ duyệt thật (đóng băng) đổi về NHÁP để mở được chế độ sửa.
type Props = Parameters<typeof DonChungTuScreen>[0]
function draftProps(): Props {
  const p = structuredClone(fixtures['cho-duyet']) as unknown as Props
  return { ...p, mode: 'edit', po: { ...p.po!, status: 'draft' } }
}
const view = (p: Props) => (
  <UiToastProvider>
    <ToastProvider>
      <DonChungTuScreen {...p} />
    </ToastProvider>
  </UiToastProvider>
)

describe('phím tắt màn đơn mua', () => {
  it('gắn listener Ctrl+S MỘT lần, dựng lại màn không gắn lại', () => {
    const add = vi.spyOn(window, 'addEventListener')
    const p = draftProps()
    const { rerender } = render(view(p))
    const keydown = () => add.mock.calls.filter(([t]) => t === 'keydown').length
    const truoc = keydown()
    for (let i = 0; i < 5; i++) rerender(view({ ...p }))
    expect(keydown(), 'dựng lại 5 lần mà listener keydown bị gắn thêm').toBe(truoc)
  })

  it('Ctrl+S lưu đúng đơn đang sửa', async () => {
    const p = draftProps()
    render(view(p))
    const luu = () => api.mock.calls.filter(([u]) => String(u).includes('/supply/pos/'))
    expect(luu()).toHaveLength(0)
    fireEvent.keyDown(window, { key: 's', ctrlKey: true })
    await vi.waitFor(() => expect(luu()).toHaveLength(1))
    expect(luu()[0][0]).toBe(`/api/dept/supply/pos/${p.po!.id}`)
    expect((luu()[0][1] as { method: string }).method).toBe('PATCH')
  })
})
