import { beforeEach, describe, expect, it, vi } from 'vitest'

const notify = vi.fn()
vi.mock('@/modules/core/notifications/notifications.service', () => ({
  notificationsService: { notify: (...a: unknown[]) => notify(...a) },
}))

import { emit } from '../bus'
import {
  registerDocRequestNotificationHandlers,
  requestTitle,
} from './doc-request.notifications'

/** Chuông yêu cầu việc (0281). */
registerDocRequestNotificationHandlers()
beforeEach(() => notify.mockReset())

const BASE = {
  request_id: 'r1',
  doc_type: 'lsx' as const,
  doc_id: 'd1',
  doc_code: '01/26-27 - LAURA',
  body: 'Bổ sung ảnh SP cho 55 dòng còn trống',
}

describe('doc-request.notifications', () => {
  it('giao việc → người nhận, mở thẳng trang Yêu cầu việc (không phải chứng từ), kèm hạn', async () => {
    await emit({ name: 'doc.request.created', ...BASE, due_on: '2026-10-31', actor_id: 'u-thao', recipient_ids: ['u-phuong'] }) // prettier-ignore
    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify.mock.calls[0][0]).toEqual({
      recipientId: 'u-phuong',
      actorId: 'u-thao',
      type: 'doc_request',
      payload: {
        title: '01/26-27 - LAURA · Bổ sung ảnh SP cho 55 dòng còn trống',
        reason: 'Hạn 31/10',
        href: '/yeu-cau-viec?id=r1',
        doc_type: 'lsx',
        doc_id: 'd1',
      },
    })
  })

  it('mỗi bước một loại chuông; máy đóng theo chứng từ nói rõ lý do', async () => {
    const types: string[] = []
    for (const action of ['done', 'reopen', 'reassign', 'cancel', 'closed'] as const) {
      notify.mockReset()
      await emit({ name: 'doc.request.changed', action, ...BASE, text: 'x', actor_id: 'u-a', recipient_ids: ['u-b'] }) // prettier-ignore
      types.push(notify.mock.calls[0][0].type)
      if (action === 'closed') expect(notify.mock.calls[0][0].payload.reason).toBe('Chứng từ đã huỷ — yêu cầu tự đóng') // prettier-ignore
    }
    expect(types).toEqual(['doc_request_done', 'doc_request_reopened', 'doc_request_reassigned', 'doc_request_cancelled', 'doc_request_cancelled']) // prettier-ignore
  })

  it('không báo chính người bấm, không báo trùng', async () => {
    await emit({ name: 'doc.request.changed', action: 'reassign', ...BASE, text: null, actor_id: 'u-a', recipient_ids: ['u-a', 'u-b', 'u-b'] }) // prettier-ignore
    expect(notify.mock.calls.map((c) => c[0].recipientId)).toEqual(['u-b'])
  })

  it('tiêu đề cắt ở 80 ký tự, gộp xuống dòng', () => {
    expect(requestTitle('PO-2026-0183', 'Lấy xác nhận\n  bằng văn bản')).toBe('PO-2026-0183 · Lấy xác nhận bằng văn bản') // prettier-ignore
    const t = requestTitle('X', 'a'.repeat(120))
    expect(t).toBe(`X · ${'a'.repeat(79)}…`)
  })
})
