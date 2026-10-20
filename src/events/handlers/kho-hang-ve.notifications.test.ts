import { beforeEach, describe, expect, it, vi } from 'vitest'

const notify = vi.fn()
vi.mock('@/modules/core/notifications/notifications.service', () => ({
  notificationsService: { notify: (...a: unknown[]) => notify(...a) },
}))
vi.mock('@/modules/dept/warehouse/stocktakes.repo', () => ({
  nguoiKho: async () => [
    { id: 'u-hao', name: 'Lê Khắc Hào' },
    { id: 'u-nu', name: 'Hà Nguyễn Nữ' },
    { id: 'u-nga', name: 'Đặng Thị Thanh Nga' },
  ],
}))
vi.mock('@/lib/date-vn', () => ({ todayVn: () => '2026-10-19' }))

import { emit } from '../bus'
import { registerKhoHangVeNotificationHandlers } from './kho-hang-ve.notifications'

/** Báo Kho hàng sắp về (B8b, loại 0251). */
registerKhoHangVeNotificationHandlers()
beforeEach(() => notify.mockReset())

const xacNhan = (expected: string | null) =>
  emit({
    name: 'po.confirmed',
    po_id: 'po1',
    code: 'PO-2026-0144',
    supplier_name: 'Phú Khang',
    expected,
    confirmed_by: 'u-nga',
  })

describe('kho-hang-ve.notifications', () => {
  it('NCC xác nhận hẹn trong 3 ngày → báo vai Kho trừ người bấm, mở Hàng về đúng mốc', async () => {
    await xacNhan('2026-10-21')
    expect(notify.mock.calls.map((c) => c[0].recipientId)).toEqual(['u-hao', 'u-nu'])
    expect(notify.mock.calls[0][0]).toMatchObject({
      type: 'po_inbound_soon',
      payload: { title: 'PO-2026-0144 · Phú Khang hẹn giao 21/10', href: '/warehouse/nhap?hen=week' }, // prettier-ignore
    })
  })

  it('hẹn hôm nay / đã quá → đúng tab', async () => {
    await xacNhan('2026-10-19')
    expect(notify.mock.calls[0][0].payload.href).toBe('/warehouse/nhap?hen=today')
    notify.mockReset()
    await xacNhan('2026-10-12')
    expect(notify.mock.calls[0][0].payload.href).toBe('/warehouse/nhap?hen=overdue')
  })

  it('hẹn xa hơn 3 ngày hoặc chưa có ngày → KHÔNG báo (Q4)', async () => {
    await xacNhan('2026-10-25')
    await xacNhan(null)
    expect(notify).not.toHaveBeenCalled()
  })

  it('dời hẹn → báo Kho; ngày không đổi thì thôi', async () => {
    await emit({ name: 'po.rescheduled', po_id: 'po1', code: 'PO-2026-0126', supplier_name: 'Việt Eco', from: '2026-10-19', to: '2026-10-23', dot: 'đợt 2', reason: 'NCC thiếu nhôm', moved_by: 'u-nga' }) // prettier-ignore
    expect(notify).toHaveBeenCalledTimes(2)
    expect(notify.mock.calls[0][0]).toMatchObject({
      type: 'po_inbound_moved',
      payload: { title: 'PO-2026-0126 (đợt 2) · Việt Eco dời hẹn 19/10 → 23/10 — NCC thiếu nhôm' }, // prettier-ignore
    })
    notify.mockReset()
    await emit({ name: 'po.rescheduled', po_id: 'po1', code: 'PO-2026-0126', supplier_name: 'Việt Eco', from: '2026-10-19', to: '2026-10-19', dot: null, reason: null, moved_by: 'u-nga' }) // prettier-ignore
    expect(notify).not.toHaveBeenCalled()
  })
})
