import { beforeEach, describe, expect, it, vi } from 'vitest'

const notify = vi.fn()
const tinhTuDong = vi.fn()
vi.mock('@/modules/core/notifications/notifications.service', () => ({
  notificationsService: { notify: (...a: unknown[]) => notify(...a) },
}))
vi.mock('@/modules/core/rbac/rbac.repo', () => ({
  rbacRepo: {
    userIdsWithPermission: async (k: string) =>
      k === 'hr.payroll.approve' ? ['u-sep', 'u-phung'] : ['u-phung', 'u-ns'],
  },
}))
vi.mock('@/modules/dept/hr/luong/bang-luong.service', () => ({
  bangLuongService: { tinhTuDong: (...a: unknown[]) => tinhTuDong(...a) },
}))

import { emit } from '../bus'
import { registerLuongNotificationHandlers } from './luong.notifications'

/** Luồng lương 21/10/2026: chốt công → tự tính → báo chị Phụng; sếp quyết → báo người gửi. */
registerLuongNotificationHandlers()
beforeEach(() => {
  notify.mockReset()
  tinhTuDong.mockReset()
})

const chot = (lan = 1) =>
  emit({ name: 'hr.period.closed', thang: '2026-10', lan, closed_by: 'u-ns' })

describe('luong.notifications', () => {
  it('chốt công → tự tính → báo người quản lý lương (trừ người chốt), kèm số vừa tính', async () => {
    tinhTuDong.mockResolvedValue({ nguoi: 135, thucLinh: 1_264_226_277, vuong: 3 })
    await chot()
    expect(tinhTuDong).toHaveBeenCalledWith('2026-10')
    expect(notify.mock.calls.map((c) => c[0].recipientId)).toEqual(['u-phung'])
    expect(notify.mock.calls[0][0]).toMatchObject({
      type: 'payroll_calculated',
      payload: {
        title:
          'Kỳ công 10/2026 đã chốt — bảng lương nháp đã tính sẵn: 135 người, thực lĩnh 1.264.226.277 · 3 người còn vướng (thiếu hồ sơ / STK)',
        href: '/bang-luong?thang=2026-10',
      },
    })
  })

  it('chốt lại lần 2 nói rõ là tính lại', async () => {
    tinhTuDong.mockResolvedValue({ nguoi: 2, thucLinh: 100, vuong: 0 })
    await chot(2)
    expect(notify.mock.calls[0][0].payload.title).toBe(
      'Kỳ công 10/2026 chốt lại (lần 2) — bảng lương nháp đã tính lại: 2 người, thực lĩnh 100',
    )
  })

  it('bảng đã gửi duyệt → không tính đè, vẫn báo', async () => {
    tinhTuDong.mockResolvedValue(null)
    await chot()
    expect(notify.mock.calls[0][0].payload.title).toMatch(/KHÔNG tự tính lại/)
  })

  it('tính hỏng → kỳ công không bị ảnh hưởng, báo để bấm Tính tay', async () => {
    tinhTuDong.mockRejectedValue(new Error('Kỳ công chốt không ghi bản cách tính'))
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    await chot()
    log.mockRestore()
    expect(notify.mock.calls[0][0].payload.title).toBe(
      'Kỳ công 10/2026 đã chốt nhưng hệ thống chưa tính được lương: Kỳ công chốt không ghi bản cách tính — vào Bảng lương bấm Tính',
    )
  })

  it('chị Phụng gửi → báo người có quyền duyệt (trừ người gửi), mở màn duyệt', async () => {
    await emit({
      name: 'hr.payroll.submitted',
      thang: '2026-10',
      submitted_by: 'u-phung',
      nguoi: 135,
      thucLinh: 1_264_226_277,
    })
    expect(notify.mock.calls.map((c) => c[0].recipientId)).toEqual(['u-sep'])
    expect(notify.mock.calls[0][0]).toMatchObject({
      type: 'payroll_submitted',
      payload: {
        title: 'Bảng lương 10/2026 chờ duyệt: 135 người, thực lĩnh 1.264.226.277',
        href: '/exec/approvals/luong/2026-10',
      },
    })
  })

  it('sếp trả lại → báo đúng người gửi kèm lý do', async () => {
    await emit({
      name: 'hr.payroll.decided',
      thang: '2026-10',
      approved: false,
      reason: 'Tổ Hoàn Thiện tăng 18 %',
      decided_by: 'u-sep',
      submitted_by: 'u-phung',
    })
    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify.mock.calls[0][0]).toMatchObject({
      recipientId: 'u-phung',
      actorId: 'u-sep',
      type: 'payroll_returned',
      payload: { title: 'Sếp trả lại bảng lương 10/2026: “Tổ Hoàn Thiện tăng 18 %”' },
    })
  })

  it('sếp duyệt → báo người gửi', async () => {
    await emit({
      name: 'hr.payroll.decided',
      thang: '2026-10',
      approved: true,
      reason: null,
      decided_by: 'u-sep',
      submitted_by: 'u-phung',
    })
    expect(notify.mock.calls[0][0]).toMatchObject({ type: 'payroll_approved' })
  })
})
