// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ApiError } from '@/lib/api'
import type { RequestListItem } from '@/modules/core/doc-notes/doc-requests.service'
import { addDays, fold, nextMonday } from './request-ui'
import { RequestComposer } from './RequestComposer'
import { OpenRequests } from './OpenRequests'

/**
 * Khối yêu cầu việc (0281, B2) — dựng thật trên happy-dom, API giả. Kiểm ba điều
 * dễ trượt nhất: nút bị chặn nói đúng chỗ thiếu, bản gửi đúng thứ server nhận,
 * và nút trên mỗi yêu cầu theo `actions` server trả (không tự đoán luật).
 */

const api = vi.fn()
vi.mock('@/lib/api', async (orig) => ({
  ...(await orig<typeof import('@/lib/api')>()),
  api: (...a: unknown[]) => api(...a),
}))

const LSX = '3a1ec4a4-83c7-4f94-bb36-74b204ee6311'
const PEOPLE = [
  { id: 'u-phuong', name: 'Nguyễn Phạm Thanh Phương', department: 'Bán Hàng' },
  { id: 'u-quang', name: 'Dương Thái Quang', department: 'Kỹ Thuật' },
  { id: 'u-thao', name: 'Vũ Phương Thảo', department: 'Cung Ứng - Mua Hàng' },
]
const TODAY = '2026-10-29' // thứ Năm

beforeEach(() => api.mockReset())
afterEach(cleanup)

describe('request-ui', () => {
  it('ngày nhanh: Mai / Thứ Hai tới (hôm nay thứ Hai thì là tuần sau)', () => {
    expect(addDays(TODAY, 1)).toBe('2026-10-30')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(nextMonday(TODAY)).toBe('2026-11-02')
    expect(nextMonday('2026-11-02')).toBe('2026-11-09')
  })
  it('tìm không dấu: "phuong" ra Phương, "ky thuat" ra Kỹ Thuật, "đ" ra "d"', () => {
    expect(fold('Nguyễn Phạm Thanh Phương')).toContain('phuong')
    expect(fold('Kỹ Thuật')).toBe('ky thuat')
    expect(fold('Đặng')).toBe('dang')
  })
})

function composer(onCreated = vi.fn()) {
  render(
    <RequestComposer
      docType="lsx"
      docId={LSX}
      people={PEOPLE}
      peopleLoading={false}
      meId="u-thao"
      today={TODAY}
      onCreated={onCreated}
    />,
  )
  return onCreated
}

describe('RequestComposer', () => {
  it('chưa điền gì: nút khoá mềm + nói thiếu người nhận và việc cần làm; bấm không gọi API', () => {
    composer()
    const nut = screen.getByRole('button', { name: /Giao việc/ })
    expect(nut.getAttribute('aria-disabled')).toBe('true')
    expect(screen.getByText(/Còn thiếu:/).textContent).toBe('Còn thiếu: chọn người nhận · ghi việc cần làm') // prettier-ignore
    fireEvent.click(nut)
    expect(api).not.toHaveBeenCalled()
    // Bấm nút chặn là nhảy tới chỗ thiếu đầu tiên.
    expect(document.activeElement).toBe(screen.getByRole('combobox'))
  })

  it('hạn đã qua / sai dạng nói tại chỗ', () => {
    composer()
    const han = screen.getByLabelText('Hạn')
    fireEvent.change(han, { target: { value: '01102026' } })
    expect((han as HTMLInputElement).value).toBe('01/10/2026')
    expect(screen.getByText(/hạn đã qua/)).toBeTruthy()
    fireEvent.change(han, { target: { value: '31/02/2026' } })
    expect(screen.getByText(/hạn chưa đúng dạng/)).toBeTruthy()
  })

  it('chọn người không dấu + hạn "Thứ Hai" → gửi đúng bản server nhận, xoá form, báo ra ngoài', async () => {
    api.mockResolvedValue({ request: { id: 'r1' } })
    const onCreated = composer()
    const o = screen.getByRole('combobox')
    fireEvent.focus(o)
    fireEvent.change(o, { target: { value: 'ban hang' } })
    expect(screen.getAllByRole('option')).toHaveLength(1)
    fireEvent.keyDown(o, { key: 'Enter' })
    fireEvent.click(screen.getByRole('button', { name: 'Thứ Hai' }))
    fireEvent.change(screen.getByLabelText('Việc cần làm'), { target: { value: 'Bổ sung ảnh 55 dòng' } }) // prettier-ignore
    expect(screen.getByText(/Nguyễn Phạm Thanh Phương nhận chuông/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Giao việc/ }))
    await vi.waitFor(() =>
      expect(onCreated).toHaveBeenCalledWith('Nguyễn Phạm Thanh Phương'),
    )
    expect(api).toHaveBeenCalledWith('/api/doc-requests', {
      method: 'POST',
      body: { doc_type: 'lsx', doc_id: LSX, assignee_id: 'u-phuong', due_on: '2026-11-02', body: 'Bổ sung ảnh 55 dòng' }, // prettier-ignore
    })
    expect((screen.getByLabelText('Việc cần làm') as HTMLTextAreaElement).value).toBe('')
  })

  it('server từ chối → giữ nguyên chữ, nói lỗi của server', async () => {
    api.mockRejectedValueOnce(new ApiError(400, 'Dương Thái Quang không còn hoạt động — chọn người khác')) // prettier-ignore
    composer()
    const o = screen.getByRole('combobox')
    fireEvent.focus(o)
    fireEvent.change(o, { target: { value: 'quang' } })
    fireEvent.keyDown(o, { key: 'Enter' })
    fireEvent.change(screen.getByLabelText('Việc cần làm'), { target: { value: 'Xác nhận định mức' } }) // prettier-ignore
    fireEvent.click(screen.getByRole('button', { name: /Giao việc/ }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/không còn hoạt động/)
    expect((screen.getByLabelText('Việc cần làm') as HTMLTextAreaElement).value).toBe('Xác nhận định mức') // prettier-ignore
  })
})

const REQ = (over: Partial<RequestListItem> = {}): RequestListItem => ({
  id: 'r1',
  doc_type: 'lsx',
  doc_id: LSX,
  author_id: 'u-thao',
  author_name: 'Vũ Phương Thảo',
  audience: 'internal',
  body: 'Bổ sung ảnh SP cho 55 dòng còn trống',
  reply_to: null,
  created_at: '2026-10-29T02:12:00Z',
  deleted_at: null,
  kind: 'request',
  assignee_id: 'u-phuong',
  assignee_name: 'Nguyễn Phạm Thanh Phương',
  due_on: '2026-10-31',
  resolved_at: null,
  resolved_by: null,
  resolved_how: null,
  doc_code: '01/26-27 - LAURA',
  overdue_days: 0,
  actions: ['done', 'reassign'],
  ...over,
})

function block(
  requests: RequestListItem[],
  meId: string,
  onChanged = vi.fn(),
  notes = [],
) {
  render(
    <OpenRequests
      requests={requests}
      notes={notes}
      people={PEOPLE}
      peopleLoading={false}
      needPeople={vi.fn()}
      meId={meId}
      today={TODAY}
      onChanged={onChanged}
    />,
  )
  return onChanged
}

describe('OpenRequests', () => {
  it('không có yêu cầu đang mở / vừa xong → không vẽ gì', () => {
    block(
      [REQ({ resolved_at: '2026-10-29T01:00:00Z', resolved_how: 'cancelled' })],
      'u-thao',
    )
    expect(screen.queryByRole('region')).toBeNull()
    expect(screen.queryByText(/Yêu cầu đang mở/)).toBeNull()
  })

  it('người nhận: "Báo xong" là nút chính; bắt câu kết quả rồi mới gửi', async () => {
    api.mockResolvedValue({ request: {} })
    const onChanged = block([REQ()], 'u-phuong')
    expect(screen.getByText(/Yêu cầu đang mở/).textContent).toContain('1')
    expect(screen.queryByRole('button', { name: /Huỷ/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Báo xong/ }))
    const gui = screen.getByRole('button', { name: 'Báo xong' })
    expect(gui.getAttribute('aria-disabled')).toBe('true')
    expect(
      screen.getByText('Ghi một câu kết quả để người giao biết đã làm gì'),
    ).toBeTruthy()
    fireEvent.click(gui)
    expect(api).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Kết quả'), {
      target: { value: 'Đã tải ảnh' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Báo xong' }))
    await vi.waitFor(() => expect(onChanged).toHaveBeenCalled())
    // Chờ khung cha tải lại: không còn nút để bấm lần hai.
    expect(screen.getByRole('status').textContent).toBe('Đã ghi — đang cập nhật…')
    expect(screen.queryByRole('button', { name: /Báo xong/ })).toBeNull()
    expect(api).toHaveBeenCalledWith('/api/doc-requests/r1', { method: 'POST', body: { action: 'done', text: 'Đã tải ảnh' } }) // prettier-ignore
  })

  it('quá hạn hiện nhãn đỏ; vừa xong hiện câu kết quả + "Mở lại" cho người giao', () => {
    block(
      [
        REQ({ id: 'qua', overdue_days: 2, due_on: '2026-10-27', actions: ['done', 'reassign', 'cancel'] }), // prettier-ignore
        REQ({ id: 'xong', resolved_at: '2026-10-28T03:00:00Z', resolved_how: 'done', actions: ['reopen'] }), // prettier-ignore
      ],
      'u-thao',
      vi.fn(),
      [{ id: 'n1', reply_to: 'xong', body: 'Xong: Đã tải ảnh 4 SP', created_at: '2026-10-28T03:00:00Z', deleted_at: null }] as never, // prettier-ignore
    )
    expect(screen.getByText('Quá hạn 2 ngày')).toBeTruthy()
    expect(screen.getByText('“Đã tải ảnh 4 SP”')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Mở lại/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Báo xong thay/ })).toBeTruthy()
  })

  it('chuyển: phải chọn người mới, không chọn được chính người đang giữ', async () => {
    api.mockResolvedValue({ request: {} })
    block([REQ({ actions: ['done', 'reassign', 'cancel'] })], 'u-thao')
    fireEvent.click(screen.getByRole('button', { name: /Chuyển/ }))
    expect(screen.getByText('Chọn người nhận mới')).toBeTruthy()
    const o = screen.getByRole('combobox')
    fireEvent.focus(o)
    expect(screen.getAllByRole('option').map((x) => x.textContent)).not.toContain('Nguyễn Phạm Thanh PhươngBán Hàng') // prettier-ignore
    fireEvent.change(o, { target: { value: 'quang' } })
    fireEvent.keyDown(o, { key: 'Enter' })
    fireEvent.click(screen.getByRole('button', { name: 'Chuyển' }))
    await vi.waitFor(() => expect(api).toHaveBeenCalled())
    expect(api.mock.calls[0][1]).toEqual({ method: 'POST', body: { action: 'reassign', assignee_id: 'u-quang', text: undefined } }) // prettier-ignore
  })
})
