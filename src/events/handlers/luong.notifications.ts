import { on } from '../bus'
import { notificationsService } from '@/modules/core/notifications/notifications.service'
import { rbacRepo } from '@/modules/core/rbac/rbac.repo'
import { bangLuongService } from '@/modules/dept/hr/luong/bang-luong.service'
import {
  hrefBangLuong,
  hrefDuyetLuong,
  tieuDeGui,
  tieuDeDaTinh,
  tieuDeKhongTinh,
  tieuDeQuyet,
  tieuDeTinhLoi,
} from '@/lib/luong/thong-bao-luong'

/**
 * LUỒNG LƯƠNG (bản vẽ duyệt 21/10/2026, Q2 theo đề xuất):
 *   - Nhân sự chốt kỳ công → hệ thống TỰ TÍNH bảng lương nháp (chưa gửi ai) → báo người quản lý
 *     lương (quyền `hr.payroll.run`, hiện là chị Phụng) kèm số người + thực lĩnh vừa tính.
 *   - Sếp duyệt / trả lại → báo người đã gửi.
 * Người nhận theo QUYỀN, không theo tên — đổi người quản lý lương là đổi vai, không sửa mã.
 */
export function registerLuongNotificationHandlers(): void {
  on('hr.period.closed', async (e) => {
    let title: string
    try {
      const r = await bangLuongService.tinhTuDong(e.thang)
      title = r ? tieuDeDaTinh(e.thang, e.lan, r) : tieuDeKhongTinh(e.thang)
    } catch (err) {
      // Kỳ công vẫn chốt; chỉ báo để người quản lý lương bấm Tính tay.
      console.error('[lương] tự tính khi chốt công hỏng:', err)
      title = tieuDeTinhLoi(e.thang, err instanceof Error ? err.message : String(err))
    }
    const ids = (await rbacRepo.userIdsWithPermission('hr.payroll.run')).filter(
      (id) => id !== e.closed_by,
    )
    await Promise.all(
      ids.map((rid) =>
        notificationsService.notify({
          recipientId: rid,
          actorId: e.closed_by,
          type: 'payroll_calculated',
          payload: { title, href: hrefBangLuong(e.thang) },
        }),
      ),
    )
  })

  // Gửi duyệt → báo mọi người có quyền duyệt lương (trừ người gửi — không tự duyệt).
  on('hr.payroll.submitted', async (e) => {
    const ids = (await rbacRepo.userIdsWithPermission('hr.payroll.approve')).filter(
      (id) => id !== e.submitted_by,
    )
    const title = tieuDeGui(e.thang, e.nguoi, e.thucLinh)
    await Promise.all(
      ids.map((rid) =>
        notificationsService.notify({
          recipientId: rid,
          actorId: e.submitted_by,
          type: 'payroll_submitted',
          payload: { title, href: hrefDuyetLuong(e.thang) },
        }),
      ),
    )
  })

  on('hr.payroll.decided', async (e) => {
    const ids = e.submitted_by
      ? [e.submitted_by]
      : await rbacRepo.userIdsWithPermission('hr.payroll.run')
    const title = tieuDeQuyet(e.thang, e.approved, e.reason)
    await Promise.all(
      ids
        .filter((id) => id !== e.decided_by)
        .map((rid) =>
          notificationsService.notify({
            recipientId: rid,
            actorId: e.decided_by,
            type: e.approved ? 'payroll_approved' : 'payroll_returned',
            payload: { title, href: hrefBangLuong(e.thang) },
          }),
        ),
    )
  })
}
