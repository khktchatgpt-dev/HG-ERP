import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/modules/core/notifications/notifications.service', () => ({
  notificationsService: { notify: vi.fn() },
}))

import { _resetForTests, emit } from '../bus'
import { registerPoNotificationHandlers } from './po.notifications'
import { notificationsService } from '@/modules/core/notifications/notifications.service'

/**
 * SỰ CỐ GIAO HÀNG → thông báo người phụ trách đơn (Kho đợt 2 · Bước 3, 0231).
 * Kho báo, Cung ứng đi làm việc với NCC — nên người nhận là NGƯỜI PHỤ TRÁCH đơn,
 * và chính họ ghi thì khỏi báo.
 */

const notify = vi.mocked(notificationsService.notify)

beforeEach(() => {
  vi.clearAllMocks()
  _resetForTests()
  registerPoNotificationHandlers()
})

const suCo = (
  p: Partial<{ owner_id: string | null; reported_by: string; description: string }>,
) =>
  emit({
    name: 'po.issue_recorded',
    po_id: 'po-90',
    code: 'PO-2026-0090',
    supplier_name: 'CÔNG TY TNHH HIỆP HƯNG',
    owner_id: 'u-nga',
    reported_by: 'u-hao',
    kind_label: 'Hàng hỏng / lỗi',
    description: '[Từ chối nhận] Thùng bị ướt, móp góc khoảng 140/2.814 thùng',
    ...p,
  })

describe('po.issue_recorded → po_issue', () => {
  it('Kho báo → người phụ trách đơn nhận, câu nói đơn · NCC · loại · mô tả', async () => {
    await suCo({})
    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify).toHaveBeenCalledWith({
      recipientId: 'u-nga',
      actorId: 'u-hao',
      type: 'po_issue',
      payload: {
        title:
          'PO-2026-0090 — CÔNG TY TNHH HIỆP HƯNG · Hàng hỏng / lỗi: [Từ chối nhận] Thùng bị ướt, móp góc khoảng 140/2.814 thùng',
      },
    })
  })

  it('chính người phụ trách ghi → không tự báo mình', async () => {
    await suCo({ reported_by: 'u-nga' })
    expect(notify).not.toHaveBeenCalled()
  })

  it('đơn không có người phụ trách → không báo ai', async () => {
    await suCo({ owner_id: null })
    expect(notify).not.toHaveBeenCalled()
  })

  it('mô tả dài cắt 140 ký tự cho chuông thông báo', async () => {
    await suCo({ description: 'x'.repeat(300) })
    const title = String((notify.mock.calls[0][0].payload as { title: string }).title)
    expect(title.endsWith('x…')).toBe(true)
    expect(title.length).toBeLessThan(220)
  })
})
