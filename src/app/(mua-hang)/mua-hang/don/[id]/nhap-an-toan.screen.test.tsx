// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ToastProvider } from '@/components/kit'
import { ToastProvider as UiToastProvider } from '@/components/ui/Toast'
import fixtures from '@/test/fixtures/don-chi-tiet.json'
import { DonChungTuScreen } from './DonChungTuScreen'
import { headerFromPo } from './chung-tu'
import { draftKeyFor, readDrafts, upsertDraft } from './nhap-an-toan'

/**
 * RỜI TRANG KHI ĐANG SOẠN ĐƠN KHÔNG ĐƯỢC MẤT GÌ (02/10/2026).
 *
 * Dựng NGUYÊN màn đơn mua (đơn NHÁP giả từ bản đóng băng design-lab, không đụng
 * DB), gõ một thay đổi rồi "rời trang" theo các ngả người dùng thật đi: gỡ màn
 * (Back / link), bấm link nội bộ, có sẵn bản nháp cũ đang chờ.
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
  localStorage.clear()
  window.history.replaceState(null, '', '/mua-hang/don/x')
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
function donNhap(): Props {
  const p = structuredClone(fixtures['cho-duyet']) as unknown as Props
  return { ...p, mode: 'edit', po: { ...p.po!, status: 'draft' } }
}
const KEY = draftKeyFor(fixtures['cho-duyet'].po.id)
const view = (p: Props) => (
  <UiToastProvider>
    <ToastProvider>
      <DonChungTuScreen {...p} />
      {/* Link nội bộ giả — như một mục ở sidebar. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- thẻ a thô: bộ chặn bắt mọi link, Link của Next cũng render ra a */}
      <a href="/mua-hang/don">Danh sách đơn</a>
    </ToastProvider>
  </UiToastProvider>
)
/** Gõ ghi chú dòng 1 rồi rời ô — một thay đổi chưa lưu. */
function goThayDoi(text = 'gõ dở chưa lưu') {
  const o = screen.getByRole('textbox', { name: 'Ghi chú dòng 1' })
  fireEvent.change(o, { target: { value: text } })
  fireEvent.blur(o)
}
const notesOf = () => readDrafts(KEY).map((d) => d.lines[0].note)

describe('đơn đang soạn — rời trang không mất dữ liệu (đơn GIẢ)', () => {
  it('gõ xong rời ngay (chưa hết nhịp tự lưu) → bản gõ dở vẫn nằm trong trình duyệt', () => {
    const r = render(view(donNhap()))
    goThayDoi()
    r.unmount() // Back / chuyển trang: màn bị gỡ trước 400ms
    expect(notesOf()).toEqual(['gõ dở chưa lưu'])
  })

  it('trang bị ẩn (đổi tab, đóng máy) → ghi ngay', () => {
    render(view(donNhap()))
    goThayDoi()
    act(() => void window.dispatchEvent(new Event('pagehide')))
    expect(notesOf()).toEqual(['gõ dở chưa lưu'])
  })

  it('có bản nháp cũ chờ khôi phục mà vẫn gõ đơn khác → giữ CẢ HAI (lỗi của bản 1)', async () => {
    const p = donNhap()
    const cu = structuredClone(p.lines[0]) as unknown as Record<string, unknown>
    upsertDraft(KEY, 'phien-cu', {
      header: headerFromPo(p.po!, []),
      lines: [{ ...cu, code: 'VT-CU', name: 'cũ', note: 'bản cũ' }] as never,
      shipCols: [],
    })
    const r = render(view(p))
    expect(await screen.findByText(/Có bản gõ dở tự lưu/)).toBeTruthy()
    goThayDoi('bản mới')
    r.unmount()
    expect(notesOf().sort()).toEqual(['bản cũ', 'bản mới'])
  })

  it('khôi phục bản cũ → bản đang gõ cũng được giữ lại', async () => {
    const p = donNhap()
    upsertDraft(KEY, 'phien-cu', {
      header: headerFromPo(p.po!, []),
      lines: [{ ...(p.lines[0] as object), note: 'bản cũ' }] as never,
      shipCols: [],
    })
    render(view(p))
    await screen.findByText(/Có bản gõ dở tự lưu/)
    goThayDoi('đang gõ')
    fireEvent.click(screen.getByRole('button', { name: 'Khôi phục' }))
    expect(notesOf()).toContain('đang gõ')
  })

  it('bấm link nội bộ khi chưa lưu → hỏi; chọn Ở lại thì không rời', () => {
    const ask = (window.confirm = vi.fn(() => false))
    render(view(donNhap()))
    goThayDoi()
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    screen.getByText('Danh sách đơn').dispatchEvent(ev)
    expect(ask).toHaveBeenCalledOnce()
    expect(ev.defaultPrevented).toBe(true)
    expect(notesOf()).toEqual(['gõ dở chưa lưu']) // đã ghi nháp trước khi hỏi
  })

  it('chọn Rời trang thì đi bình thường; chưa đổi gì thì không hỏi', () => {
    const ask = (window.confirm = vi.fn(() => true))
    render(view(donNhap()))
    const ev0 = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    screen.getByText('Danh sách đơn').dispatchEvent(ev0)
    expect(ask).not.toHaveBeenCalled()
    window.history.replaceState(null, '', '/mua-hang/don/x') // cú bấm trên đã đi thật
    goThayDoi()
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    screen.getByText('Danh sách đơn').dispatchEvent(ev)
    expect(ask).toHaveBeenCalledOnce()
    expect(ev.defaultPrevented).toBe(false)
  })

  it('lưu xong (Ctrl+S) → bỏ bản nháp, rời trang không ghi lại', async () => {
    const r = render(view(donNhap()))
    goThayDoi()
    act(() => void window.dispatchEvent(new Event('pagehide')))
    expect(notesOf()).toHaveLength(1)
    fireEvent.keyDown(window, { key: 's', ctrlKey: true })
    await vi.waitFor(() => expect(api.mock.calls.some(([u]) => String(u).includes('/supply/pos/'))).toBe(true)) // prettier-ignore
    await vi.waitFor(() => expect(notesOf()).toEqual([]))
    r.unmount()
    expect(notesOf()).toEqual([])
  })
})
