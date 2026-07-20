import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/modules/core/notifications/notifications.service', () => ({
  notificationsService: { notify: vi.fn() },
}))

import { _resetForTests, emit } from '../bus'
import { registerProductionNotificationHandlers } from './production.notifications'
import { notificationsService } from '@/modules/core/notifications/notifications.service'

const notify = vi.mocked(notificationsService.notify)

beforeEach(() => {
  vi.clearAllMocks()
  _resetForTests()
  registerProductionNotificationHandlers()
})

describe('production.stage.done → stage_handoff', () => {
  it('báo tổ kế tiếp "đến lượt" + quản đốc, không báo trùng người', async () => {
    await emit({
      name: 'production.stage.done',
      production_order_id: 'lsx1',
      code: 'LSX-01',
      stage: 'han',
      stage_label: 'Hàn',
      next_stages: ['son'],
      next_stage_labels: ['Sơn'],
      done_by: 'u-th',
      notify_next_ids: ['u-son', 'u-gd'],
      coordinator_ids: ['u-gd', 'u-admin'],
    })
    // u-gd nằm cả 2 danh sách → chỉ nhận 1 lần (nhánh next).
    expect(notify).toHaveBeenCalledTimes(3)
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: 'u-son',
        type: 'stage_handoff',
        payload: expect.objectContaining({
          title: 'LSX-01 — Hàn xong, đến lượt Sơn',
        }),
      }),
    )
  })

  it('công đoạn cuối (next rỗng) → chỉ quản đốc, title "công đoạn cuối"', async () => {
    await emit({
      name: 'production.stage.done',
      production_order_id: 'lsx1',
      code: 'LSX-01',
      stage: 'son',
      stage_label: 'Sơn',
      next_stages: [],
      next_stage_labels: [],
      done_by: 'u-th',
      notify_next_ids: [],
      coordinator_ids: ['u-gd'],
    })
    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: 'u-gd',
        payload: expect.objectContaining({
          title: expect.stringContaining('công đoạn cuối'),
        }),
      }),
    )
  })
})

describe('production.incident.* → incident_reported / incident_resolved', () => {
  it('reported → báo quản đốc kèm LSX + tổ trong title', async () => {
    await emit({
      name: 'production.incident.reported',
      incident_id: 'i1',
      production_order_id: 'lsx1',
      lsx_code: 'LSX-01',
      stage: 'han',
      department_name: 'Tổ Hàn',
      message: 'Máy hàn hỏng',
      reported_by: 'u-th',
      notify_ids: ['u-gd'],
    })
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: 'u-gd',
        type: 'incident_reported',
        payload: expect.objectContaining({ title: 'LSX-01 · Tổ Hàn: Máy hàn hỏng' }),
      }),
    )
  })

  it('resolved → báo người báo cáo', async () => {
    await emit({
      name: 'production.incident.resolved',
      incident_id: 'i1',
      lsx_code: null,
      message: 'Máy hàn hỏng',
      resolved_by: 'u-gd',
      notify_ids: ['u-th'],
    })
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: 'u-th',
        type: 'incident_resolved',
        payload: expect.objectContaining({ title: 'Máy hàn hỏng' }),
      }),
    )
  })
})
