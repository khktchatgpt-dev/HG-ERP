// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { AssignedItem } from '@/modules/workflow/tasks/tasks.service'
import { ViecDuocGiao } from './viec-duoc-giao'

/**
 * Ô "Việc được giao" trên Bàn làm việc (phân công việc P3) — dựng thật, API giả.
 * Kiểm: báo hoàn thành bắt câu kết quả ngay dưới dòng rồi gửi đúng bản server
 * nhận; chờ tải lại thì không còn nút; người duyệt xem bàn người khác không có nút.
 */

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
const api = vi.fn()
vi.mock('@/lib/api', async (orig) => ({
  ...(await orig<typeof import('@/lib/api')>()),
  api: (...a: unknown[]) => api(...a),
}))

const ITEM = (over: Partial<AssignedItem> = {}): AssignedItem =>
  ({
    id: 't1',
    task_code: 'CV-000031',
    title: 'Lập danh sách NCC xốp đang dùng',
    description: 'Gồm cả NCC ở Bình Dương',
    status: 'todo',
    priority: 'normal',
    kind: 'assigned',
    assigner_id: 'u-thao',
    assigner_name: 'Vũ Phương Thảo',
    assignee_id: 'u-nga',
    due_date: '2026-11-05T16:59:59Z',
    overdue_days: 0,
    actions: ['start', 'submit'],
    last_reject: null,
    ...over,
  }) as AssignedItem

beforeEach(() => {
  api.mockReset()
  refresh.mockReset()
})
afterEach(cleanup)

describe('ViecDuocGiao', () => {
  it('dòng: hạn · việc + chi tiết · người giao · tình trạng; trả lại thì hiện lý do', () => {
    render(
      <ViecDuocGiao
        items={[ITEM(), ITEM({ id: 't2', status: 'rejected', overdue_days: 1, last_reject: 'Thiếu NCC ở Bình Dương', actions: ['start', 'submit'] })]} // prettier-ignore
        readOnly={false}
        who="bạn"
      />,
    )
    expect(screen.getAllByText('05/11')).toHaveLength(2) // 05/11 16:59 UTC = 23:59 cùng ngày giờ VN
    expect(screen.getAllByText('Vũ Phương Thảo')).toHaveLength(2)
    expect(screen.getByText('Quá hạn 1 ngày')).toBeTruthy()
    expect(screen.getByText('Trả lại: “Thiếu NCC ở Bình Dương”')).toBeTruthy()
    // Việc bị trả lại: không cần "Bắt đầu" — báo hoàn thành lại là đủ.
    expect(screen.getAllByRole('button', { name: /Bắt đầu/ })).toHaveLength(1)
    expect(screen.getByText(/2 việc đang giao cho bạn · 1 quá hạn/)).toBeTruthy()
  })

  it('báo hoàn thành: khoá + câu nhắc khi chưa ghi; ghi xong gửi { result }, chờ tải lại thì hết nút', async () => {
    api.mockResolvedValue({ task: {} })
    render(<ViecDuocGiao items={[ITEM()]} readOnly={false} who="bạn" />)
    fireEvent.click(screen.getByRole('button', { name: /Báo hoàn thành/ }))
    const gui = screen.getByRole('button', { name: /Báo hoàn thành/ })
    expect(gui.getAttribute('aria-disabled')).toBe('true')
    expect(
      screen.getByText('Ghi một câu kết quả để người giao biết đã làm gì'),
    ).toBeTruthy()
    fireEvent.click(gui)
    expect(api).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText(/Kết quả/), {
      target: { value: 'Đã lập xong, 12 NCC' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Báo hoàn thành/ }))
    await vi.waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(api).toHaveBeenCalledWith('/api/tasks/t1/submit', { method: 'POST', body: { result: 'Đã lập xong, 12 NCC' } }) // prettier-ignore
    expect(screen.getByText('Đã ghi — đang cập nhật…')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Báo hoàn thành/ })).toBeNull()
  })

  it('Bắt đầu gọi đường đổi trạng thái', async () => {
    api.mockResolvedValue({ task: {} })
    render(<ViecDuocGiao items={[ITEM()]} readOnly={false} who="bạn" />)
    fireEvent.click(screen.getByRole('button', { name: /Bắt đầu/ }))
    await vi.waitFor(() => expect(api).toHaveBeenCalledWith('/api/tasks/t1/status', { method: 'POST', body: { status: 'in_progress' } })) // prettier-ignore
  })

  it('người duyệt xem bàn người khác: không có nút, chân bảng nói rõ chỉ xem', () => {
    render(
      <ViecDuocGiao items={[ITEM({ actions: [] })]} readOnly who="Đặng Thị Thanh Nga" />,
    )
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.getByText(/chỉ xem — Đặng Thị Thanh Nga tự báo hoàn thành trên bàn của mình/)).toBeTruthy() // prettier-ignore
  })
})
