// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import type {
  AssignedItem,
  GivenBoard,
  GivenItem,
  MineBoard,
} from '@/modules/workflow/tasks/tasks.service'
import { PhanCongScreen, type PhanCongFocus } from './PhanCongScreen'

/**
 * Trang Phân công việc bản 3 (lối ERP không kit) — dựng thật trên happy-dom, API và
 * tải tệp giả. Kiểm: Action Pane áp cho dòng đang chọn và nói vì sao khi khoá; ngăn
 * phải luôn có dòng chọn; phiếu giao gửi đúng thứ máy chủ nhận rồi tải tệp vào ĐÚNG
 * việc vừa tạo; nhân viên không giao được thì được nói cách gỡ.
 */

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }))
const api = vi.fn()
vi.mock('@/lib/api', async (orig) => ({
  ...(await orig<typeof import('@/lib/api')>()),
  api: (...a: unknown[]) => api(...a),
}))
const upload = vi.fn()
vi.mock('@/lib/upload', () => ({ uploadFileTracked: (...a: unknown[]) => upload(...a) }))

const TODAY = '2026-11-03'
const PEOPLE = [
  {
    id: 'u-quang',
    name: 'Dương Thái Quang',
    department: 'Kỹ Thuật',
    workspace: 'technical',
  },
  {
    id: 'u-nga',
    name: 'Đặng Thị Thanh Nga',
    department: 'Cung Ứng - Mua Hàng',
    workspace: 'planning',
  },
]

const G = (over: Partial<GivenItem> = {}): GivenItem =>
  ({
    id: 't1',
    task_code: 'CV-000031',
    title: 'Làm mẫu rập ghế Siena theo bản vẽ rev.3',
    description: 'Khách đổi tựa lưng cao thêm 20mm.',
    status: 'in_progress',
    priority: 'normal',
    kind: 'assigned',
    assigner_id: 'u-viet',
    assignee_id: 'u-quang',
    assigner_name: 'Nguyễn Võ Nam Việt',
    assignee_name: 'Dương Thái Quang',
    department_name: 'Kỹ Thuật',
    due_date: '2026-11-12T16:59:59Z',
    created_at: '2026-11-03T03:00:00Z',
    submitted_at: null,
    completed_at: null,
    cancelled_at: null,
    overdue_days: 0,
    actions: ['cancel'],
    last_result: null,
    last_reject: null,
    file_count: 2,
    ...over,
  }) as GivenItem

const CHO = G({
  id: 't2',
  task_code: 'CV-000034',
  title: 'Lấy mẫu vải T05 cho ghế Siena',
  status: 'submitted',
  assignee_id: 'u-nga',
  assignee_name: 'Đặng Thị Thanh Nga',
  department_name: 'Cung Ứng - Mua Hàng',
  actions: ['approve', 'reject', 'cancel'],
  file_count: 0,
})

const NO_MINE: MineBoard = {
  items: [],
  summary: { doing: 0, overdue: 0, waiting: 0, done: 0, cancelled: 0 },
}

function giver(items: GivenItem[], focus: PhanCongFocus | null = null) {
  const board: GivenBoard = {
    items,
    summary: {
      to_approve: items.filter((t) => t.status === 'submitted').length,
      overdue: 0,
      open: items.filter((t) => !['done', 'cancelled'].includes(t.status)).length,
      done: items.filter((t) => t.status === 'done').length,
      cancelled: 0,
    },
  }
  render(
    <PhanCongScreen
      meId="u-viet"
      meRole="employee"
      restricted
      today={TODAY}
      board={board}
      mine={NO_MINE}
      people={PEOPLE}
      focus={focus}
    />,
  )
}

const pane = () => screen.getByRole('toolbar', { name: 'Thao tác' })

beforeEach(() => {
  api.mockReset()
  upload.mockReset()
  refresh.mockReset()
  api.mockImplementation(async (url: string) => {
    if (url.endsWith('/files')) return { files: [] }
    if (url.endsWith('/comments')) return { comments: [] }
    return { task: { id: 'tNew' } }
  })
})
afterEach(cleanup)

describe('Việc tôi giao — lưới + ngăn phải', () => {
  it('mở sẵn Chờ duyệt khi có việc chờ, chọn sẵn dòng đầu, ngăn phải hiện việc đó', async () => {
    giver([G(), CHO])
    expect(screen.getByRole('tab', { name: /Việc tôi giao/ }).getAttribute('aria-selected')).toBe('true') // prettier-ignore
    const grid = screen.getByRole('table', { name: 'Việc tôi giao' })
    expect(within(grid).getAllByRole('row')).toHaveLength(3) // đầu + 1 dòng + chân
    expect(screen.getByRole('complementary', { name: /Lấy mẫu vải T05/ })).toBeTruthy()
    await waitFor(() => expect(api).toHaveBeenCalledWith('/api/tasks/t2/files'))
  })

  it('mỗi dòng một hàng: mô tả không chen vào lưới, nằm ở ngăn phải', () => {
    giver([G()])
    const grid = screen.getByRole('table', { name: 'Việc tôi giao' })
    expect(within(grid).queryByText('Khách đổi tựa lưng cao thêm 20mm.')).toBeNull()
    expect(screen.getByText('Khách đổi tựa lưng cao thêm 20mm.')).toBeTruthy()
  })

  it('nút khoá vẫn bấm được: nói vì sao ngay dưới Action Pane, không gọi API', () => {
    giver([G()])
    const duyet = within(pane()).getByRole('button', { name: 'Duyệt Đạt' })
    expect(duyet.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(duyet)
    expect(screen.getByRole('status').textContent).toMatch(/CV-000031 đang “Đang làm” — chỉ việc Chờ duyệt mới duyệt đạt được/) // prettier-ignore
    expect(api).not.toHaveBeenCalledWith(
      expect.stringContaining('/approve'),
      expect.anything(),
    )
  })

  it('Duyệt Đạt áp cho dòng đang chọn', async () => {
    giver([G(), CHO])
    fireEvent.click(within(pane()).getByRole('button', { name: 'Duyệt Đạt' }))
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/api/tasks/t2/approve', {
        method: 'POST',
        body: {},
      }),
    )
    expect(refresh).toHaveBeenCalled()
  })

  it('Trả lại: ô lý do hiện đầu ngăn phải, khoá tới khi có chữ, rồi gửi /reject', async () => {
    giver([CHO])
    fireEvent.click(within(pane()).getByRole('button', { name: 'Trả lại' }))
    const buoc = screen.getByRole('region', { name: 'Trả lại' })
    const gui = within(buoc).getByRole('button', { name: 'Trả lại' })
    expect(gui.getAttribute('aria-disabled')).toBe('true')
    fireEvent.change(within(buoc).getByLabelText('Lý do trả lại'), {
      target: { value: 'Mẫu vải sai mã màu' },
    })
    fireEvent.click(gui)
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/api/tasks/t2/reject', {
        method: 'POST',
        body: { reason: 'Mẫu vải sai mã màu' },
      }),
    )
  })

  it('Huỷ việc hỏi lại tại ngăn phải rồi mới gửi', async () => {
    giver([G()])
    fireEvent.click(within(pane()).getByRole('button', { name: 'Huỷ việc' }))
    const buoc = screen.getByRole('region', { name: 'Huỷ việc' })
    fireEvent.click(within(buoc).getByRole('button', { name: 'Huỷ việc' }))
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/api/tasks/t1/status', {
        method: 'POST',
        body: { status: 'cancelled' },
      }),
    )
  })

  it('bấm dòng khác: ngăn phải đổi theo; tìm không dấu lọc lưới', () => {
    giver([G(), G({ id: 't3', task_code: 'CV-000033', title: 'Báo giá khung nhôm MERXX', assignee_name: 'Nguyễn Anh Thi' })], { id: 't1', muc: 'giao', filter: 'open' }) // prettier-ignore
    fireEvent.click(screen.getByText('Báo giá khung nhôm MERXX'))
    expect(screen.getByRole('complementary', { name: /Báo giá khung nhôm/ })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Tìm việc'), { target: { value: 'anh thi' } })
    const grid = screen.getByRole('table', { name: 'Việc tôi giao' })
    expect(within(grid).getAllByRole('row')).toHaveLength(3)
  })

  it('việc đã xong: ngăn phải khoá thêm tệp và nói cách gỡ', async () => {
    giver([G({ status: 'done', actions: [], completed_at: '2026-11-02T03:00:00Z' })], { id: 't1', muc: 'giao', filter: 'done' }) // prettier-ignore
    expect(await screen.findByText('Việc đã đóng — mở lại rồi mới thêm tệp')).toBeTruthy()
    expect(document.getElementById('tep-dinh-kem-input')).toBeNull()
  })

  it('gửi trao đổi đi qua /comments', async () => {
    giver([G()])
    fireEvent.change(screen.getByLabelText('Viết trao đổi'), {
      target: { value: 'Đã gửi bản rev.3' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Gửi' }))
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/api/tasks/t1/comments', {
        method: 'POST',
        body: { body: 'Đã gửi bản rev.3', kind: 'comment' },
      }),
    )
  })
})

describe('phiếu Giao việc ở ngăn phải', () => {
  function moPhieu() {
    fireEvent.click(within(pane()).getByRole('button', { name: '+ Giao việc' }))
    return screen.getByRole('form', { name: 'Giao việc' })
  }
  function dien(form: HTMLElement, file?: File) {
    const o = within(form).getByRole('combobox')
    fireEvent.focus(o)
    fireEvent.change(o, { target: { value: 'quang' } })
    fireEvent.keyDown(o, { key: 'Enter' })
    fireEvent.change(within(form).getByLabelText('Việc'), {
      target: { value: ' Làm mẫu rập Siena ' },
    })
    if (file)
      fireEvent.change(document.getElementById('pcv-tep')!, { target: { files: [file] } })
  }

  it('thiếu thì nút chốt khoá, bấm vào nói thiếu gì và nhảy tới ô', () => {
    giver([])
    const form = moPhieu()
    const nut = within(form).getByRole('button', { name: 'Giao việc' })
    expect(nut.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(nut)
    expect(within(form).getByText(/Còn thiếu:/).textContent).toBe(
      'Còn thiếu: người nhận · việc',
    )
    expect(api).not.toHaveBeenCalledWith('/api/tasks', expect.anything())
    expect(document.activeElement?.id).toBe('pcv-nguoi')
  })

  it('danh sách người nhóm theo phòng; Bán Hàng gõ người ngoài thì được nói vì sao', () => {
    giver([])
    const form = moPhieu()
    const o = within(form).getByRole('combobox')
    fireEvent.focus(o)
    expect(screen.getByText('Kỹ Thuật', { selector: 'li' })).toBeTruthy()
    fireEvent.change(o, { target: { value: 'thiet' } })
    expect(
      screen.getByText(/Bán Hàng chỉ giao được cho Kỹ thuật và Cung ứng/),
    ).toBeTruthy()
  })

  it('giao kèm tệp: tạo việc trước, rồi tải tệp vào ĐÚNG việc vừa tạo; báo đã giao', async () => {
    upload.mockResolvedValue('fid')
    giver([])
    const form = moPhieu()
    dien(form, new File(['x'], 'ban-ve.pdf', { type: 'application/pdf' }))
    fireEvent.click(within(form).getByRole('button', { name: 'Giao cho Quang' }))
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1))
    expect(api).toHaveBeenCalledWith('/api/tasks', {
      method: 'POST',
      body: {
        title: 'Làm mẫu rập Siena',
        description: null,
        assignee_id: 'u-quang',
        due_date: null,
        priority: 'normal',
      },
    })
    expect(upload.mock.calls[0][1]).toEqual({ kind: 'task', id: 'tNew' })
    expect(await screen.findByText('Đã giao cho Dương Thái Quang.')).toBeTruthy()
    expect(refresh).toHaveBeenCalled()
  })

  it('tệp không lên được: việc vẫn giao, báo tên tệp', async () => {
    upload.mockRejectedValue(new Error('hỏng mạng'))
    giver([])
    const form = moPhieu()
    dien(form, new File(['x'], 'ban-ve.pdf', { type: 'application/pdf' }))
    fireEvent.click(within(form).getByRole('button', { name: 'Giao cho Quang' }))
    expect(await screen.findByText(/1 tệp chưa lên được: ban-ve\.pdf/)).toBeTruthy()
  })
})

describe('nhân viên — Việc của tôi', () => {
  const M = (over: Partial<AssignedItem> = {}): AssignedItem =>
    ({ ...G({ assigner_id: 'u-viet', assignee_id: 'u-quang', actions: ['start', 'submit'] }), ...over }) as AssignedItem // prettier-ignore
  const MINE: MineBoard = {
    items: [M()],
    summary: { doing: 1, overdue: 0, waiting: 0, done: 0, cancelled: 0 },
  }
  function staff() {
    render(
      <PhanCongScreen
        meId="u-quang"
        meRole="employee"
        restricted={false}
        today={TODAY}
        board={null}
        mine={MINE}
        people={[]}
        focus={null}
      />,
    )
  }

  it('chỉ một mục; Giao việc khoá và nói cách gỡ', () => {
    staff()
    expect(screen.getAllByRole('tab')).toHaveLength(1)
    fireEvent.click(within(pane()).getByRole('button', { name: '+ Giao việc' }))
    expect(screen.getByRole('status').textContent).toMatch(
      /Giao việc dành cho sếp, quản lý và phòng Bán Hàng/,
    )
  })

  it('Báo hoàn thành bắt một câu kết quả rồi gửi /submit', async () => {
    staff()
    fireEvent.click(within(pane()).getByRole('button', { name: 'Báo hoàn thành' }))
    const buoc = screen.getByRole('region', { name: 'Báo hoàn thành' })
    fireEvent.change(within(buoc).getByLabelText('Kết quả'), {
      target: { value: 'Đã ra rập tựa 1070mm' },
    })
    fireEvent.click(within(buoc).getByRole('button', { name: 'Báo hoàn thành' }))
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/api/tasks/t1/submit', {
        method: 'POST',
        body: { result: 'Đã ra rập tựa 1070mm' },
      }),
    )
  })

  it('việc bị trả lại: nút Bắt đầu đổi thành Làm tiếp', () => {
    render(
      <PhanCongScreen
        meId="u-quang"
        meRole="employee"
        restricted={false}
        today={TODAY}
        board={null}
        mine={{ ...MINE, items: [M({ status: 'rejected' })] }}
        people={[]}
        focus={null}
      />,
    )
    expect(within(pane()).getByRole('button', { name: 'Làm tiếp' })).toBeTruthy()
  })
})
