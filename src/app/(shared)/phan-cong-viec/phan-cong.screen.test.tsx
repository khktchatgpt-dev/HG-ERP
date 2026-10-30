// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { ApiError } from '@/lib/api'
import type {
  AssignedItem,
  GivenBoard,
  GivenItem,
  MineBoard,
} from '@/modules/workflow/tasks/tasks.service'
import { PhanCongScreen, type PhanCongFocus } from './PhanCongScreen'

/**
 * Trang Phân công việc (P2) — dựng thật trên happy-dom, API giả. Kiểm: giao việc
 * gửi đúng thứ server nhận và chặn tại chỗ khi thiếu; nút trên dòng theo `actions`
 * server trả; trả lại bắt lý do; chip đếm khớp số dòng.
 */

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }))
const api = vi.fn()
vi.mock('@/lib/api', async (orig) => ({
  ...(await orig<typeof import('@/lib/api')>()),
  api: (...a: unknown[]) => api(...a),
}))

const TODAY = '2026-10-30'
const PEOPLE = [
  { id: 'u-phuong', name: 'Nguyễn Phạm Thanh Phương', department: 'Bán Hàng' },
  { id: 'u-quang', name: 'Dương Thái Quang', department: 'Kỹ Thuật' },
  { id: 'u-thao', name: 'Vũ Phương Thảo', department: 'Cung Ứng - Mua Hàng' },
]
const ITEM = (over: Partial<GivenItem> = {}): GivenItem =>
  ({
    id: 't1',
    task_code: 'CV-000030',
    title: 'Bổ sung ảnh SP lệnh 01/26-27 - LAURA',
    description: null,
    status: 'in_progress',
    priority: 'normal',
    kind: 'assigned',
    assigner_id: 'u-thao',
    assignee_id: 'u-phuong',
    assignee_name: 'Nguyễn Phạm Thanh Phương',
    department_name: 'Bán Hàng',
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

const NO_MINE: MineBoard = {
  items: [],
  summary: { doing: 0, overdue: 0, waiting: 0, done: 0, cancelled: 0 },
}

function show(
  items: GivenItem[],
  summary: GivenBoard['summary'],
  mine: MineBoard = NO_MINE,
  focus: PhanCongFocus | null = null,
) {
  render(
    <PhanCongScreen
      meId="u-thao"
      today={TODAY}
      board={{ items, summary }}
      mine={mine}
      people={PEOPLE}
      focus={focus}
    />,
  )
}

beforeEach(() => {
  api.mockReset()
  refresh.mockReset()
})
afterEach(cleanup)

describe('hộp Giao việc', () => {
  it('chưa điền: nút khoá mềm, nói thiếu gì; bấm thì nhảy tới ô người nhận, không gọi API', () => {
    show([], { to_approve: 0, overdue: 0, open: 0, done: 0, cancelled: 0 })
    const form = screen.getByRole('form', { name: 'Giao việc' })
    const nut = within(form).getByRole('button', { name: /Giao việc/ })
    expect(nut.getAttribute('aria-disabled')).toBe('true')
    expect(within(form).getByText(/Còn thiếu:/).textContent).toBe('Còn thiếu: chọn người nhận · ghi việc cần làm') // prettier-ignore
    fireEvent.click(nut)
    expect(api).not.toHaveBeenCalled()
    expect(document.activeElement?.id).toBe('pcv-nguoi')
  })

  it('chọn người không dấu, hạn "Mai", Gấp → gửi đúng bản server nhận rồi tải lại', async () => {
    api.mockResolvedValue({ task: { id: 'tNew' } })
    show([], { to_approve: 0, overdue: 0, open: 0, done: 0, cancelled: 0 })
    const o = screen.getByRole('combobox')
    fireEvent.focus(o)
    fireEvent.change(o, { target: { value: 'ky thuat' } })
    expect(screen.getAllByRole('option')).toHaveLength(1)
    fireEvent.keyDown(o, { key: 'Enter' })
    fireEvent.change(screen.getByLabelText('Việc cần làm'), { target: { value: ' Xác nhận định mức 8 SP ' } }) // prettier-ignore
    fireEvent.click(screen.getByRole('button', { name: 'Mai' }))
    fireEvent.click(screen.getByRole('button', { name: /Gấp/ }))
    fireEvent.click(
      within(screen.getByRole('form', { name: 'Giao việc' })).getByRole('button', {
        name: /^Giao việc$/,
      }),
    )
    expect(await screen.findByRole('status')).toHaveProperty('textContent', 'Đã giao cho Dương Thái Quang.') // prettier-ignore
    expect(refresh).toHaveBeenCalled() // việc vừa giao phải hiện ngay trong danh sách
    expect(api).toHaveBeenCalledWith('/api/tasks', {
      method: 'POST',
      body: { title: 'Xác nhận định mức 8 SP', description: null, assignee_id: 'u-quang', due_date: '2026-10-31T23:59:59+07:00', priority: 'urgent' }, // prettier-ignore
    })
  })

  it('không tự giao cho mình trong ô người nhận (việc tự ghi đi đường khác)', () => {
    show([], { to_approve: 0, overdue: 0, open: 0, done: 0, cancelled: 0 })
    const o = screen.getByRole('combobox')
    fireEvent.focus(o)
    fireEvent.change(o, { target: { value: 'thao' } })
    expect(screen.queryAllByRole('option').map((x) => x.textContent)).not.toContain('Vũ Phương Thảo (bạn)Cung Ứng - Mua Hàng') // prettier-ignore
  })

  it('server từ chối → giữ chữ, nói lỗi của server', async () => {
    api.mockRejectedValueOnce(new ApiError(400, 'Dương Thái Quang không còn hoạt động — chọn người khác')) // prettier-ignore
    show([], { to_approve: 0, overdue: 0, open: 0, done: 0, cancelled: 0 })
    const o = screen.getByRole('combobox')
    fireEvent.focus(o)
    fireEvent.change(o, { target: { value: 'quang' } })
    fireEvent.keyDown(o, { key: 'Enter' })
    fireEvent.change(screen.getByLabelText('Việc cần làm'), { target: { value: 'Xác nhận định mức' } }) // prettier-ignore
    fireEvent.click(
      within(screen.getByRole('form', { name: 'Giao việc' })).getByRole('button', {
        name: /^Giao việc$/,
      }),
    )
    expect((await screen.findByRole('alert')).textContent).toMatch(/không còn hoạt động/)
    expect((screen.getByLabelText('Việc cần làm') as HTMLInputElement).value).toBe('Xác nhận định mức') // prettier-ignore
  })
})

describe('danh sách Việc tôi giao', () => {
  const items = [
    ITEM({ id: 'cho', status: 'submitted', last_result: 'Đã tải ảnh 4 SP', submitted_at: '2026-10-29T09:20:00Z', actions: ['approve', 'reject', 'cancel'] }), // prettier-ignore
    ITEM({
      id: 'qua',
      title: 'Xác nhận định mức',
      overdue_days: 2,
      due_date: '2026-10-27T16:59:59Z',
    }),
    ITEM({
      id: 'lai',
      status: 'rejected',
      last_reject: 'Còn 6 mã chưa có ĐVT',
      title: 'Rà mã vật tư',
    }),
  ]
  const summary = { to_approve: 1, overdue: 1, open: 3, done: 0, cancelled: 0 }

  it('có việc chờ duyệt thì mở sẵn chip "Chờ tôi duyệt"; số chip = số dòng', () => {
    show(items, summary)
    expect(screen.getByRole('button', { name: /Chờ tôi duyệt/ }).getAttribute('aria-pressed')).toBe('true') // prettier-ignore
    expect(screen.getAllByRole('row')).toHaveLength(3) // đầu + 1 dòng + chân
    expect(screen.getByText(/“Đã tải ảnh 4 SP” · báo 29\/10/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Chưa xong/ }))
    expect(screen.getAllByRole('row')).toHaveLength(2 + 3)
    expect(screen.getByText('Quá hạn 2 ngày')).toBeTruthy()
    expect(screen.getByText('Trả lại: “Còn 6 mã chưa có ĐVT”')).toBeTruthy()
  })

  it('Đạt gọi đúng API rồi tải lại', async () => {
    api.mockResolvedValue({ task: {} })
    show(items, summary)
    fireEvent.click(screen.getByRole('button', { name: /^Đạt$/ }))
    await vi.waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(api).toHaveBeenCalledWith('/api/tasks/cho/approve', {
      method: 'POST',
      body: {},
    })
    // Chờ tải lại: dòng vừa bấm không còn nút để bấm lần hai.
    expect(screen.getByText('Đã ghi — đang cập nhật…')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Đạt$/ })).toBeNull()
  })

  it('Trả lại bắt lý do ngay dưới dòng, rồi gửi lý do', async () => {
    api.mockResolvedValue({ task: {} })
    show(items, summary)
    fireEvent.click(screen.getByRole('button', { name: /Trả lại/ }))
    const gui = screen.getAllByRole('button', { name: 'Trả lại' }).at(-1)!
    expect(gui.getAttribute('aria-disabled')).toBe('true')
    expect(screen.getByText('Ghi lý do để người nhận biết phải làm thêm gì')).toBeTruthy()
    fireEvent.change(screen.getByLabelText(/Lý do trả lại/), {
      target: { value: 'Ảnh mờ' },
    })
    fireEvent.click(gui)
    await vi.waitFor(() => expect(api).toHaveBeenCalledWith('/api/tasks/cho/reject', { method: 'POST', body: { reason: 'Ảnh mờ' } })) // prettier-ignore
  })

  it('nhân viên mở trang: không có hộp giao việc, nói rõ ai giao', () => {
    render(<PhanCongScreen meId="u-nga" today={TODAY} board={null} mine={NO_MINE} people={[]} focus={null} />) // prettier-ignore
    expect(screen.queryByRole('form', { name: 'Giao việc' })).toBeNull()
    expect(
      screen.getByText('Sếp và quản lý giao việc. Cần giao thì nhờ quản lý phòng.'),
    ).toBeTruthy()
  })
})
/*
  P5 — "Việc của tôi": chỗ người NGOÀI Cung ứng (Sales, Kỹ thuật) nhận và báo hoàn
  thành (chốt D2). Ví dụ theo bản vẽ: chị Thảo giao Phương (Bán hàng) bổ sung ảnh.
*/
const MINE = (over: Partial<AssignedItem> = {}): AssignedItem =>
  ({
    id: 'm1',
    task_code: 'CV-000050',
    title: 'Bổ sung KSX, ảnh, số lượng cho đơn mới của MX',
    description: 'Gửi cho chị Thảo trước thứ Hai',
    status: 'todo',
    priority: 'urgent',
    kind: 'assigned',
    assigner_id: 'u-thao',
    assigner_name: 'Vũ Phương Thảo',
    assignee_id: 'u-phuong',
    due_date: '2026-11-01T16:59:59Z',
    created_at: '2026-10-30T02:00:00Z',
    submitted_at: null,
    completed_at: null,
    cancelled_at: null,
    overdue_days: 0,
    actions: ['start', 'submit'],
    last_result: null,
    last_reject: null,
    ...over,
  }) as AssignedItem
const MINE_BOARD: MineBoard = {
  items: [
    MINE(),
    MINE({ id: 'm2', title: 'Gửi ảnh mẫu bàn LAURA', priority: 'normal', status: 'submitted', actions: [], last_result: 'Đã gửi 6 ảnh qua Zalo', submitted_at: '2026-10-29T08:00:00Z' }), // prettier-ignore
    MINE({ id: 'm3', title: 'Xác nhận số lượng lệnh 12', priority: 'normal', status: 'done', actions: [], due_date: '2026-10-28T16:59:59Z', completed_at: '2026-10-28T09:00:00Z' }), // prettier-ignore
  ],
  summary: { doing: 1, overdue: 0, waiting: 1, done: 1, cancelled: 0 },
}

describe('Việc của tôi (P5)', () => {
  function showStaff(focus: PhanCongFocus | null = null) {
    render(<PhanCongScreen meId="u-phuong" today={TODAY} board={null} mine={MINE_BOARD} people={[]} focus={focus} />) // prettier-ignore
  }

  it('nhân viên: chỉ một mục "Việc của tôi", mở sẵn chip Cần làm; số chip = số dòng', () => {
    showStaff()
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'Việc của tôi1',
    ])
    expect(screen.getByRole('button', { name: /Cần làm/ }).getAttribute('aria-pressed')).toBe('true') // prettier-ignore
    const rows = screen.getAllByRole('row').filter((r) => r.closest('tbody'))
    expect(rows).toHaveLength(1)
    expect(within(rows[0]).getByText('Vũ Phương Thảo')).toBeTruthy()
    expect(within(rows[0]).getByText('Gấp')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Chờ duyệt/ }))
    expect(screen.getByText('Đã báo: “Đã gửi 6 ảnh qua Zalo” · 29/10')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Báo hoàn thành/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Xong 30 ngày/ }))
    expect(screen.getByText('Xong · đúng hạn')).toBeTruthy()
  })

  it('người Bán hàng báo hoàn thành ngay trên trang: bắt câu kết quả, gửi đúng bản server nhận', async () => {
    api.mockResolvedValue({ task: {} })
    showStaff()
    fireEvent.click(screen.getByRole('button', { name: /Báo hoàn thành/ }))
    fireEvent.change(screen.getByLabelText(/Kết quả/), { target: { value: 'Đã gửi đủ KSX + ảnh' } }) // prettier-ignore
    fireEvent.click(screen.getByRole('button', { name: /Báo hoàn thành/ }))
    await vi.waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(api).toHaveBeenCalledWith('/api/tasks/m1/submit', { method: 'POST', body: { result: 'Đã gửi đủ KSX + ảnh' } }) // prettier-ignore
    expect(screen.getByText('Đã ghi — đang cập nhật…')).toBeTruthy()
  })

  it('chuông mở trang: vào đúng mục + chip có việc đó, dòng được tô', () => {
    showStaff({ id: 'm3', muc: 'cua-toi', filter: 'done' })
    expect(screen.getByRole('button', { name: /Xong 30 ngày/ }).getAttribute('aria-pressed')).toBe('true') // prettier-ignore
    const hit = screen
      .getAllByRole('row')
      .find((r) => r.getAttribute('aria-current') === 'true')
    expect(hit?.textContent).toContain('Xác nhận số lượng lệnh 12')
  })

  it('người giao: chuông "báo hoàn thành" vào mục Việc tôi giao, chip Chờ tôi duyệt, dòng được tô', () => {
    const given = [ITEM({ id: 'cho', status: 'submitted', actions: ['approve', 'reject'] }), ITEM({ id: 'mo' })] // prettier-ignore
    const sum = { to_approve: 1, overdue: 0, open: 2, done: 0, cancelled: 0 }
    show(given, sum, MINE_BOARD, {
      id: 'cho',
      muc: 'giao',
      filter: 'to_approve',
    })
    expect(screen.getByRole('tab', { name: /Việc tôi giao/ }).getAttribute('aria-selected')).toBe('true') // prettier-ignore
    const hit = screen
      .getAllByRole('row')
      .find((r) => r.getAttribute('aria-current') === 'true')
    expect(hit).toBeTruthy()
    // Người giao cũng nhận việc sếp giao: mục thứ hai bấm được.
    fireEvent.click(screen.getByRole('tab', { name: /Việc của tôi/ }))
    expect(screen.getByRole('button', { name: /Cần làm/ })).toBeTruthy()
  })

  it('đang ở "Việc của tôi" bấm Giao việc: về mục giao và con trỏ ở ô người nhận', () => {
    show([], { to_approve: 0, overdue: 0, open: 0, done: 0, cancelled: 0 }, MINE_BOARD, { id: 'm1', muc: 'cua-toi', filter: 'doing' }) // prettier-ignore
    expect(screen.queryByRole('form', { name: 'Giao việc' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^Giao việc$/ }))
    expect(screen.getByRole('form', { name: 'Giao việc' })).toBeTruthy()
    expect(document.activeElement?.id).toBe('pcv-nguoi')
  })
})
