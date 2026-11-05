// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ToastProvider } from '@/components/kit'
import { ToastProvider as UiToastProvider } from '@/components/ui/Toast'
import fixtures from '@/test/fixtures/don-chi-tiet.json'
import { DonChungTuScreen } from './DonChungTuScreen'

/**
 * TRANG ĐƠN CUNG ỨNG — BƯỚC TRƯỞNG PHÒNG XEM (0293 · B4, bản vẽ
 * RcqWLU7F1z33btAR97gZBo khung 5). Đơn thật đóng băng (chờ duyệt), người xem
 * đóng vai trưởng phòng CƯ: "đến lượt bạn", nút chính "Đã xem — trình GĐ" với
 * ghi chú không bắt buộc, và Lịch sử ký bày nhãn chung với màn ký của GĐ.
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
  api.mockResolvedValue({})
})
afterEach(() => {
  cleanup()
  api.mockReset()
  vi.unstubAllGlobals()
})

type Props = Parameters<typeof DonChungTuScreen>[0]
function props(reviewed_at: string | null, laTruongPhong = true): Props {
  const p = structuredClone(fixtures['cho-duyet']) as unknown as Props
  const me = p.me
  return {
    ...p,
    po: {
      ...p.po!,
      review: { lead_ids: laTruongPhong ? [me.id] : ['u-hieu'], lead_name: 'Đỗ Ngọc Hiếu', reviewed_at }, // prettier-ignore
    },
    perms: {
      ...p.perms,
      privileged: true,
      lead: true,
      tp: { toi: laTruongPhong, minh: false, daXem: !!reviewed_at },
    },
    signEvents: [
      { action: 'submitted', actor_name: 'Nguyễn Đình Huy', created_at: '2026-11-04T08:37:00Z', reason: null }, // prettier-ignore
      { action: 'approved', actor_name: 'Alex', created_at: '2026-11-04T09:00:00Z', reason: 'Duyệt khi trưởng phòng chưa xem' }, // prettier-ignore
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

describe('trang đơn — trưởng phòng CƯ xem trước GĐ', () => {
  it('đến lượt trưởng phòng: "Đến lượt bạn", nút chính "Đã xem — trình GĐ"', () => {
    view(props(null))
    // Với chính trưởng phòng DocStatus nói "Đến lượt bạn — Xem rồi trình Giám đốc".
    expect(document.body.textContent).toContain('Đến lượt bạn')
    expect(document.body.textContent).not.toContain(
      'Trưởng phòng Cung ứng · Đỗ Ngọc Hiếu',
    )
    expect(document.body.textContent).toContain('Xem rồi trình Giám đốc')
    expect(screen.getAllByRole('button', { name: /Đã xem — trình GĐ/ }).length).toBeGreaterThan(0) // prettier-ignore
  })

  it('bấm "Đã xem — trình GĐ": ghi chú để trống vẫn gửi được, gọi đúng route review', async () => {
    view(props(null))
    fireEvent.click(screen.getAllByRole('button', { name: /Đã xem — trình GĐ/ })[0])
    expect(screen.getByText('Ghi chú cho Giám đốc (không bắt buộc)')).toBeTruthy()
    const nut = screen.getAllByRole('button', { name: 'Đã xem — trình GĐ' }).at(-1)!
    expect((nut as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(nut)
    const xem = () => api.mock.calls.filter(([u]) => String(u).endsWith('/review'))
    await vi.waitFor(() => expect(xem()).toHaveLength(1))
    expect(xem()[0][0]).toBe(`/api/dept/supply/pos/${fixtures['cho-duyet'].po.id}/review`)
    expect(xem()[0][1]).toMatchObject({ method: 'POST', body: { note: null } })
  })

  it('đã xem rồi / người khác mở đơn: không còn nút xem, bóng ở đúng chỗ', () => {
    view(props('2026-11-05T02:15:00Z'))
    expect(screen.queryAllByRole('button', { name: /Đã xem — trình GĐ/ })).toHaveLength(0)
    expect(document.body.textContent).toContain('Trưởng phòng đã xem 05/11 09:15')
    cleanup()
    view(props(null, false))
    expect(screen.queryAllByRole('button', { name: /Đã xem — trình GĐ/ })).toHaveLength(0)
    expect(document.body.textContent).toContain('Trưởng phòng Cung ứng · Đỗ Ngọc Hiếu')
  })

  it('Lịch sử ký bày nhãn chung với màn ký GĐ — kể cả "duyệt khi trưởng phòng chưa xem"', () => {
    view({ ...props(null), initialMuc: 'lich-su' })
    expect(screen.getByText('Giám đốc duyệt — trưởng phòng chưa xem')).toBeTruthy()
    expect(screen.getAllByText('Gửi duyệt').length).toBeGreaterThan(0)
  })
})

/**
 * LUỒNG CHỐT 05/11/2026 chiều: NV lập NHÁP, không có mốc gửi trưởng phòng;
 * trưởng phòng mở nháp người khác thì "Đã xem — trình GĐ" (gửi kèm `tu`).
 */
describe('trang đơn — nháp: trưởng phòng xem rồi trình GĐ', () => {
  function nhap(o: { toi: boolean; thieu?: string | null }): Props {
    const p = structuredClone(fixtures['cho-duyet']) as unknown as Props
    const me = p.me
    return {
      ...p,
      po: {
        ...p.po!,
        status: 'draft',
        review: { lead_ids: o.toi ? [me.id] : ['u-hieu'], lead_name: 'Đỗ Ngọc Hiếu', reviewed_at: null, tra_lai_at: null, thieu: o.thieu ?? null }, // prettier-ignore
      },
      perms: {
        ...p.perms,
        canEdit: true,
        tp: { toi: o.toi, minh: !o.toi, daXem: false },
      },
      signEvents: [],
    }
  }
  const nut = (re: RegExp) => screen.queryAllByRole('button', { name: re })

  it('NV mở nháp đủ điều kiện: bóng ở trưởng phòng, không có nút gửi nổi bật', () => {
    view(nhap({ toi: false }))
    expect(document.body.textContent).toContain('Trưởng phòng Cung ứng · Đỗ Ngọc Hiếu')
    expect(document.body.textContent).toContain('Xem rồi trình Giám đốc')
    expect(nut(/Gửi Giám đốc duyệt/)).toHaveLength(0)
    expect(nut(/Đã xem — trình GĐ/)).toHaveLength(0)
  })

  it('NV mở nháp còn thiếu: bóng ở NV, câu nói thiếu gì', () => {
    view(nhap({ toi: false, thieu: 'Chưa có hẹn giao' }))
    expect(document.body.textContent).toContain('Soạn tiếp (chưa có hẹn giao)')
  })

  it('trưởng phòng mở nháp người khác: "Đến lượt bạn", bấm trình gọi review kèm tu=draft', async () => {
    view(nhap({ toi: true }))
    expect(document.body.textContent).toContain('Đến lượt bạn')
    fireEvent.click(nut(/Đã xem — trình GĐ/)[0])
    fireEvent.click(screen.getAllByRole('button', { name: 'Đã xem — trình GĐ' }).at(-1)!)
    const xem = () => api.mock.calls.filter(([u]) => String(u).endsWith('/review'))
    await vi.waitFor(() => expect(xem()).toHaveLength(1))
    expect(xem()[0][1]).toMatchObject({
      method: 'POST',
      body: { note: null, tu: 'draft' },
    })
  })
})
