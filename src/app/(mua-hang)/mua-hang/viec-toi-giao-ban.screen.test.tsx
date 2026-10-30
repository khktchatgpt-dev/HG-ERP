// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { GivenBoard, GivenItem } from '@/modules/workflow/tasks/tasks.service'
import { SUPPLY_TODO_KINDS } from '@/lib/supply-watch'
import { BanLamViecScreen, type BuyerRow, type Desk } from './BanLamViecScreen'

/**
 * Bàn làm việc của quản lý (phân công việc P4, bản vẽ A + C) — dựng thật cả màn,
 * API giả. Kiểm: ô "Việc tôi giao" chỉ có việc chưa xong và số trên ô = số dòng;
 * nút Giao việc mở hộp bên phải, đóng thì mất; người không giao được việc không
 * có ô lẫn nút; ba cột việc ở "Theo người mua".
 */

const refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
  usePathname: () => '/mua-hang',
  useSearchParams: () => new URLSearchParams(),
}))
const api = vi.fn()
vi.mock('@/lib/api', async (orig) => ({
  ...(await orig<typeof import('@/lib/api')>()),
  api: (...a: unknown[]) => api(...a),
}))

const TODAY = '2026-10-30'
const DESK: Desk = {
  counts: Object.fromEntries(SUPPLY_TODO_KINDS.map((k) => [k, 0])) as Desk['counts'],
  todos: [],
  incomingSoon: 0,
  openTotal: 0,
  riskCounts: { stop: 0, warn: 0, watch: 0, inflight: 0, ready: 0 },
  issues: [],
  lsxCount: 0,
  lsxDone: 0,
}
const ITEM = (over: Partial<GivenItem> = {}): GivenItem =>
  ({
    id: 't1',
    task_code: 'CV-000040',
    title: 'Xác nhận định mức 8 SP lệnh 13/26-27 - MX',
    description: null,
    status: 'in_progress',
    priority: 'normal',
    kind: 'assigned',
    assigner_id: 'u-thao',
    assignee_id: 'u-quang',
    assignee_name: 'Dương Thái Quang',
    department_name: 'Kỹ Thuật',
    due_date: '2026-10-31T16:59:59Z',
    created_at: '2026-10-29T03:00:00Z',
    submitted_at: null,
    completed_at: null,
    cancelled_at: null,
    overdue_days: 0,
    actions: ['cancel'],
    last_result: null,
    last_reject: null,
    ...over,
  }) as GivenItem
const BOARD: GivenBoard = {
  items: [
    ITEM({ id: 'cho', status: 'submitted', title: 'Bổ sung ảnh 4 SP lệnh 09/26-27 - MX', actions: ['approve', 'reject', 'cancel'], last_result: 'Đã tải ảnh lên hồ sơ' }), // prettier-ignore
    ITEM({ id: 'lam' }),
    ITEM({ id: 'xong', status: 'done', title: 'Việc đã xong', completed_at: '2026-10-29T03:00:00Z', actions: [] }), // prettier-ignore
  ],
  summary: { to_approve: 1, overdue: 0, open: 2, done: 1, cancelled: 0 },
}
const BUYER = (over: Partial<BuyerRow>): BuyerRow => ({
  id: 'u-nga',
  name: 'Đặng Thị Thanh Nga',
  open: 17,
  todo: 16,
  pending: 0,
  unconfirmed: 0,
  noEta: 0,
  overdue: 3,
  incomingSoon: 3,
  lsx: 4,
  tasks: { open: 2, overdue: 1, on_time: 3, done_due: 4 },
  ...over,
})

function show(giver: GivenBoard | null, buyers: BuyerRow[] = []) {
  render(
    <BanLamViecScreen
      today={TODAY}
      meId="u-thao"
      userName="Vũ Phương Thảo"
      viewAs={null}
      defaultScope="phong"
      urlScope={null}
      desks={{ toi: DESK, phong: DESK }}
      assigned={[]}
      giver={giver ? { board: giver, people: [{ id: 'u-quang', name: 'Dương Thái Quang', department: 'Kỹ Thuật' }] } : null} // prettier-ignore
      approver={{ pending: [], buyers }}
      agenda={[]}
      truncatedAt={null}
    />,
  )
}

beforeEach(() => {
  api.mockReset()
  refresh.mockReset()
  localStorage.clear()
})
afterEach(cleanup)

describe('Bàn của quản lý — Việc tôi giao (bản vẽ A)', () => {
  it('ô đứng đầu, mở sẵn; chỉ việc chưa xong, chờ duyệt lên đầu; số trên ô = số dòng', () => {
    show(BOARD)
    const o = screen.getByRole('button', { name: /Việc tôi giao · 1 chờ duyệt/ })
    expect(o.textContent).toContain('2')
    const rows = screen.getAllByRole('row').filter((r) => r.closest('tbody'))
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining('Bổ sung ảnh 4 SP'),
      expect.stringContaining('Xác nhận định mức 8 SP'),
    ])
    expect(screen.queryByText('Việc đã xong')).toBeNull()
    expect(screen.getByText(/2 chưa xong · 1 chờ tôi duyệt · 0 quá hạn/)).toBeTruthy()
    expect(screen.getByRole('link', { name: /trang Phân công việc/ }).getAttribute('href')).toBe('/phan-cong-viec') // prettier-ignore
    expect(screen.getByRole('button', { name: /Đạt/ })).toBeTruthy()
  })

  it('nút Giao việc mở hộp bên phải (con trỏ ở ô người nhận), nút đóng tắt hộp', async () => {
    show(BOARD)
    expect(screen.queryByRole('complementary', { name: 'Hộp giao việc' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^Giao việc$/ }))
    const hop = screen.getByRole('complementary', { name: 'Hộp giao việc' })
    expect(within(hop).getByRole('form', { name: 'Giao việc' })).toBeTruthy()
    // Con trỏ vào ô người nhận NGAY lúc bấm — không chờ nhịp vẽ (thẻ nền không vẽ).
    expect(document.activeElement?.id).toBe('pcv-nguoi')
    fireEvent.click(within(hop).getByRole('button', { name: 'Đóng hộp giao việc' }))
    expect(screen.queryByRole('complementary', { name: 'Hộp giao việc' })).toBeNull()
  })

  it('giao xong: tải lại trang, hộp còn mở và nói đã giao cho ai', async () => {
    api.mockResolvedValue({ task: { id: 'tNew' } })
    show(BOARD)
    fireEvent.click(screen.getByRole('button', { name: /^Giao việc$/ }))
    const hop = screen.getByRole('complementary', { name: 'Hộp giao việc' })
    const o = within(hop).getByRole('combobox')
    fireEvent.focus(o)
    fireEvent.change(o, { target: { value: 'quang' } })
    fireEvent.keyDown(o, { key: 'Enter' })
    fireEvent.change(within(hop).getByLabelText('Việc cần làm'), { target: { value: 'Rà định mức lệnh 14' } }) // prettier-ignore
    fireEvent.click(within(hop).getByRole('button', { name: /^Giao việc$/ }))
    expect(await within(hop).findByRole('status')).toHaveProperty('textContent', 'Đã giao cho Dương Thái Quang.') // prettier-ignore
    expect(refresh).toHaveBeenCalled()
    expect(api).toHaveBeenCalledWith(
      '/api/tasks',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('đã giao mà mọi việc đều xong: ô còn đó (0), nói vì sao trống và mở được hộp', () => {
    show({ items: [BOARD.items[2]], summary: { to_approve: 0, overdue: 0, open: 0, done: 1, cancelled: 0 } }) // prettier-ignore
    fireEvent.click(screen.getByRole('button', { name: /^Việc tôi giao/ }))
    expect(screen.getByText('Không có việc nào bạn giao đang mở')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Mở trang Phân công việc/ })).toBeTruthy()
    // Nút thứ hai (trong trạng thái rỗng) cũng mở hộp.
    fireEvent.click(screen.getAllByRole('button', { name: /^Giao việc$/ })[1])
    expect(screen.getByRole('complementary', { name: 'Hộp giao việc' })).toBeTruthy()
  })

  it('người không giao được việc: không có ô, không có nút; Soạn đơn mua vẫn là nút chính', () => {
    show(null)
    expect(screen.queryByRole('button', { name: /Việc tôi giao/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Giao việc$/ })).toBeNull()
    expect(screen.getByRole('link', { name: /Soạn đơn mua/ }).className).toContain(
      'bg-[var(--act)]',
    )
  })

  it('người giao việc: Giao việc là nút chính, Soạn đơn mua lùi về nút thường', () => {
    show(BOARD)
    expect(screen.getByRole('link', { name: /Soạn đơn mua/ }).className).not.toContain('bg-[var(--act)]') // prettier-ignore
    expect(screen.getByRole('button', { name: /^Giao việc$/ }).className).toContain('bg-[var(--act)]') // prettier-ignore
  })
})

describe('Theo người mua — ba cột việc (bản vẽ C)', () => {
  it('việc được giao · việc quá hạn · đúng hạn / tổng; chưa xong việc nào thì "—"', () => {
    show(BOARD, [
      BUYER({}),
      BUYER({ id: 'u-huy', name: 'Nguyễn Đình Huy', tasks: { open: 1, overdue: 0, on_time: 0, done_due: 0 } }), // prettier-ignore
    ])
    fireEvent.click(screen.getByRole('button', { name: /^Theo người mua/ }))
    const head = screen.getAllByRole('columnheader').map((h) => h.textContent)
    expect(head).toEqual(expect.arrayContaining(['Việc được giao', 'Việc quá hạn', 'Đúng hạn · 30 ngày'])) // prettier-ignore
    // Không chữ trống chen giữa các <th> — lỗi hydrate thật đã dính lúc soi màn (30/10).
    const headRow = screen.getAllByRole('columnheader')[0].parentElement!
    expect([...headRow.childNodes].every((n) => n.nodeType === Node.ELEMENT_NODE)).toBe(true) // prettier-ignore
    const [nga, huy] = screen.getAllByRole('row').filter((r) => r.closest('tbody'))
    const cells = (r: HTMLElement) =>
      within(r)
        .getAllByRole('cell')
        .map((c) => c.textContent)
    expect(cells(nga).slice(9, 12)).toEqual(['2', '1', '3/4'])
    expect(cells(huy).slice(9, 12)).toEqual(['1', '0', '—'])
    expect(screen.getByText(/Ba cột việc:/)).toBeTruthy()
  })
})
