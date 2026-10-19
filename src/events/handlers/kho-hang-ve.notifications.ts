import { on } from '../bus'
import { notificationsService } from '@/modules/core/notifications/notifications.service'
import { nguoiKho } from '@/modules/dept/warehouse/stocktakes.repo'
import { todayVn } from '@/lib/date-vn'
import {
  baoKhiDoiHen,
  baoKhiXacNhan,
  nguoiNhan,
  tieuDeDoiHen,
  tieuDeXacNhan,
} from '@/lib/kho-bao-hang-ve'

/**
 * BÁO KHO HÀNG SẮP VỀ (Kho đợt 2 · B8b, 0251). Luật "khi nào báo" ở
 * `lib/kho-bao-hang-ve.ts`; người nhận = mọi người có vai Kho trừ người bấm
 * (tạm thời gồm cả bạn Cung ứng đang được gán vai Kho).
 *
 * Bấm thông báo mở Hàng về đã lọc đúng mốc — Kho cần biết chuẩn bị nhận, chi
 * tiết đơn mua là việc của Cung ứng.
 */
export function registerKhoHangVeNotificationHandlers(): void {
  on('po.confirmed', async (e) => {
    const today = todayVn()
    if (!baoKhiXacNhan(e.expected, today) || !e.expected) return
    const ids = nguoiNhan(await nguoiKho(), e.confirmed_by)
    const title = tieuDeXacNhan(e.code, e.supplier_name, e.expected, today)
    const href = `/warehouse/nhap?hen=${e.expected < today ? 'overdue' : e.expected === today ? 'today' : 'week'}` // prettier-ignore
    await Promise.all(
      ids.map((rid) =>
        notificationsService.notify({
          recipientId: rid,
          actorId: e.confirmed_by,
          type: 'po_inbound_soon',
          payload: { title, href },
        }),
      ),
    )
  })

  on('po.rescheduled', async (e) => {
    if (!baoKhiDoiHen(e.from, e.to)) return
    const ids = nguoiNhan(await nguoiKho(), e.moved_by)
    const title = tieuDeDoiHen(e.code, e.supplier_name, e.from, e.to, e.dot, e.reason)
    await Promise.all(
      ids.map((rid) =>
        notificationsService.notify({
          recipientId: rid,
          actorId: e.moved_by,
          type: 'po_inbound_moved',
          payload: { title, href: '/warehouse/nhap' },
        }),
      ),
    )
  })
}
