import { beforeEach, describe, expect, it, vi } from 'vitest'

const notify = vi.fn()
vi.mock('@/modules/core/notifications/notifications.service', () => ({
  notificationsService: { notify: (...a: unknown[]) => notify(...a) },
}))

import { emit } from '../bus'
import { registerDeNghiNotificationHandlers } from './de-nghi.notifications'

/** Thông báo đề nghị mua (0236 · Đ2, loại 0237). */
registerDeNghiNotificationHandlers()
beforeEach(() => notify.mockReset())

describe('de-nghi.notifications', () => {
  it('gửi duyệt → mỗi người duyệt một thông báo, mở thẳng màn duyệt', async () => {
    await emit({
      name: 'de_nghi.submitted',
      request_id: 'dn1',
      code: 'DNM-2026-0001',
      department: 'Kho vật tư',
      submitted_by: 'u-hao',
      approver_ids: ['u-alex', 'u-dien'],
      so_dong: 9,
      tong: 1_234_000,
    })
    expect(notify).toHaveBeenCalledTimes(2)
    expect(notify.mock.calls[0][0]).toMatchObject({
      recipientId: 'u-alex',
      type: 'dnm_submitted',
      payload: {
        title: 'DNM-2026-0001 — Kho vật tư · 9 dòng · dự kiến 1.234.000 đ',
        href: '/duyet/de-nghi/dn1',
      },
    })
  })

  it('duyệt → CHỈ báo người đề nghị (Kho tự đi mua, không qua Cung ứng); không báo chính người duyệt', async () => {
    await emit({ name: 'de_nghi.decided', request_id: 'dn1', code: 'DNM-2026-0001', decision: 'approved', reason: null, decided_by: 'u-alex', requester_id: 'u-hao' }) // prettier-ignore
    expect(notify.mock.calls.map((c) => [c[0].recipientId, c[0].type, c[0].payload.href])).toEqual([['u-hao', 'dnm_approved', '/warehouse/de-nghi/dn1']]) // prettier-ignore
    notify.mockReset()
    await emit({ name: 'de_nghi.decided', request_id: 'dn1', code: 'DNM-2026-0001', decision: 'approved', reason: null, decided_by: 'u-hao', requester_id: 'u-hao' }) // prettier-ignore
    expect(notify).not.toHaveBeenCalled()
  })

  it('từ chối → chỉ người đề nghị, kèm lý do', async () => {
    await emit({
      name: 'de_nghi.decided',
      request_id: 'dn1',
      code: 'DNM-2026-0001',
      decision: 'rejected',
      reason: 'Kiểm lại tồn găng tay',
      decided_by: 'u-alex',
      requester_id: 'u-hao',
    })
    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify.mock.calls[0][0]).toMatchObject({ type: 'dnm_rejected', payload: { reason: 'Kiểm lại tồn găng tay' } }) // prettier-ignore
  })
})
