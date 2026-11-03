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
import type { GivenItem, MineBoard } from '@/modules/workflow/tasks/tasks.service'
import { PhanCongScreen, type PhanCongFocus } from './PhanCongScreen'

/**
 * Ngăn kéo CHI TIẾT VIỆC + tệp trong hộp Giao việc (B3, 03/11/2026). API và tải lên
 * giả; kiểm thứ người dùng nhìn thấy và thứ gửi lên máy chủ.
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
const NO_MINE: MineBoard = {
  items: [],
  summary: { doing: 0, overdue: 0, waiting: 0, done: 0, cancelled: 0 },
}
const TITLE = 'Làm mẫu rập ghế Siena theo bản vẽ rev.3'
const ITEM = (over: Partial<GivenItem> = {}): GivenItem =>
  ({
    id: 't1',
    task_code: 'CV-000031',
    title: TITLE,
    description: 'Khách đổi tựa lưng cao thêm 20mm.',
    status: 'in_progress',
    priority: 'urgent',
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

function sale(items: GivenItem[], focus: PhanCongFocus | null = null) {
  render(
    <PhanCongScreen
      meId="u-viet"
      meRole="employee"
      restricted
      today={TODAY}
      board={{
        items,
        summary: { to_approve: 0, overdue: 0, open: items.length, done: 0, cancelled: 0 },
      }}
      mine={NO_MINE}
      people={PEOPLE}
      focus={focus}
    />,
  )
}

function fillForm(file: File) {
  const o = screen.getByRole('combobox')
  fireEvent.focus(o)
  fireEvent.change(o, { target: { value: 'quang' } })
  fireEvent.keyDown(o, { key: 'Enter' })
  fireEvent.change(screen.getByLabelText('Việc cần làm'), {
    target: { value: 'Làm mẫu rập Siena' },
  })
  fireEvent.change(document.getElementById('pcv-tep')!, { target: { files: [file] } })
  const form = screen.getByRole('form', { name: 'Giao việc' })
  fireEvent.click(within(form).getByRole('button', { name: /Giao việc/ }))
}

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

describe('Bán Hàng giao việc', () => {
  it('thấy câu giới hạn phòng nhận và dòng việc có 2 tệp', () => {
    sale([ITEM()])
    expect(
      screen.getByText(/Bán Hàng chỉ giao được cho Kỹ thuật và Cung ứng/),
    ).toBeTruthy()
    expect(screen.getByTitle('2 tệp đính kèm')).toBeTruthy()
  })

  it('giao kèm tệp: tạo việc trước, rồi tải từng tệp vào ĐÚNG việc vừa tạo', async () => {
    upload.mockResolvedValue('fid')
    sale([])
    fillForm(new File(['x'], 'ban-ve.pdf', { type: 'application/pdf' }))
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1))
    expect(upload.mock.calls[0][1]).toEqual({ kind: 'task', id: 'tNew' })
    expect(refresh).toHaveBeenCalled()
  })

  it('tệp không lên được: việc vẫn giao, báo tên tệp và có đường mở việc để thêm lại', async () => {
    upload.mockRejectedValue(new Error('hỏng mạng'))
    sale([])
    fillForm(new File(['x'], 'ban-ve.pdf', { type: 'application/pdf' }))
    expect(
      await screen.findByText(/Việc đã giao, nhưng 1 tệp chưa lên được: ban-ve\.pdf/),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Mở việc để thêm lại' })).toBeTruthy()
  })
})

describe('ngăn kéo chi tiết việc', () => {
  it('bấm tên việc: hiện mô tả, người giao và người làm, thay chỗ hộp Giao việc; đóng thì hộp quay lại', async () => {
    sale([ITEM()])
    fireEvent.click(screen.getByRole('button', { name: TITLE }))
    const d = await screen.findByRole('complementary', { name: /Chi tiết việc/ })
    expect(within(d).getByText('Khách đổi tựa lưng cao thêm 20mm.')).toBeTruthy()
    expect(within(d).getByText(/Nguyễn Võ Nam Việt/)).toBeTruthy()
    expect(within(d).getByText(/Dương Thái Quang/)).toBeTruthy()
    expect(screen.queryByRole('form', { name: 'Giao việc' })).toBeNull()
    await waitFor(() => expect(api).toHaveBeenCalledWith('/api/tasks/t1/files'))
    fireEvent.click(within(d).getByRole('button', { name: 'Đóng chi tiết việc' }))
    expect(screen.getByRole('form', { name: 'Giao việc' })).toBeTruthy()
  })

  it('việc đã xong: khoá thêm tệp và nói cách gỡ', async () => {
    sale([ITEM({ status: 'done', actions: [], completed_at: '2026-11-02T03:00:00Z' })], {
      id: 't1',
      muc: 'giao',
      filter: 'done',
    })
    fireEvent.click(screen.getByRole('button', { name: TITLE }))
    await screen.findByText('Việc đã đóng — mở lại rồi mới thêm tệp')
    expect(document.getElementById('tep-dinh-kem-input')).toBeNull()
  })

  it('người giao trả lại: bắt lý do, rồi gửi đúng /reject', async () => {
    sale([ITEM({ status: 'submitted', actions: ['approve', 'reject', 'cancel'] })])
    fireEvent.click(screen.getByRole('button', { name: TITLE }))
    const d = await screen.findByRole('complementary', { name: /Chi tiết việc/ })
    fireEvent.click(within(d).getByRole('button', { name: 'Trả lại' }))
    const gui = within(d).getAllByRole('button', { name: 'Trả lại' }).at(-1)!
    expect(gui.getAttribute('aria-disabled')).toBe('true')
    fireEvent.change(within(d).getByLabelText(/Lý do trả lại/), {
      target: { value: 'Rập tựa chưa cộng 20mm' },
    })
    fireEvent.click(gui)
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/api/tasks/t1/reject', {
        method: 'POST',
        body: { reason: 'Rập tựa chưa cộng 20mm' },
      }),
    )
  })

  it('gửi trao đổi đi qua /comments', async () => {
    sale([ITEM()])
    fireEvent.click(screen.getByRole('button', { name: TITLE }))
    const d = await screen.findByRole('complementary', { name: /Chi tiết việc/ })
    fireEvent.change(within(d).getByLabelText('Viết trao đổi'), {
      target: { value: 'Đã gửi bản rev.3' },
    })
    fireEvent.click(within(d).getByRole('button', { name: 'Gửi' }))
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/api/tasks/t1/comments', {
        method: 'POST',
        body: { body: 'Đã gửi bản rev.3', kind: 'comment' },
      }),
    )
  })
})
