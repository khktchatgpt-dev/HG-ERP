import { on } from '../bus'
import { notificationsRepo } from '@/modules/core/notifications/notifications.repo'
import { quyetDinhTin } from '@/lib/lenh-doi'

const LOAI = 'lsx_doi_cho_soat' as const

/**
 * NGOÀI PRODUCTION KHÔNG GỬI TIN CHO NGƯỜI THẬT. Máy dev / worktree chạy trên
 * CHÍNH DB thật (02/11/2026), mà tin chờ soát phát ngay khi tính trạng thái —
 * không chặn thì mở màn dev là trưởng phòng + người mua nhận tin trỏ vào tính
 * năng chưa có trên main. Thử thì đặt `HG_BAO_LENH_DOI_THU=<user_id>` trong
 * `.env.local`: mọi tin lẽ ra gửi đi DỒN về đúng người đó (một tin mỗi lệnh),
 * người nhận thật không bị làm phiền.
 */
function locNguoiNhan(ids: string[]): string[] {
  if (process.env.NODE_ENV === 'production') return ids
  const thu = process.env.HG_BAO_LENH_DOI_THU
  return thu && ids.length > 0 ? [thu] : []
}

/** Chạy lần lượt trong tiến trình — hai lần tính cùng lúc không chèn trùng tin. */
type Hang = { p: Promise<void> }
const hang: Hang = ((globalThis as { __hgTinLenhDoi?: Hang }).__hgTinLenhDoi ??= {
  p: Promise.resolve(),
})
function noiHang(viec: () => Promise<void>): Promise<void> {
  hang.p = hang.p.then(viec, viec)
  return hang.p
}

/**
 * Tin "lệnh đổi — chờ soát" (0283). Danh sách người nhận do service Cung ứng
 * tính (trưởng phòng + người cầm đơn của lệnh); ở đây chỉ còn luật MỖI NGƯỜI
 * MỖI LỆNH MỘT TIN CHƯA ĐỌC (`quyetDinhTin`) và tắt tin khi đã soát.
 */
export function registerLenhDoiNotificationHandlers(): void {
  on('supply.lsx.cho_soat', (e) =>
    noiHang(async () => {
      const items = e.items
        .map((it) => ({ ...it, recipient_ids: locNguoiNhan(it.recipient_ids) }))
        .filter((it) => it.recipient_ids.length > 0)
      if (items.length === 0) return
      const users = [...new Set(items.flatMap((it) => it.recipient_ids))]
      const cu = await notificationsRepo.latestByPayloadKey(
        LOAI,
        'lsx_id',
        items.map((it) => it.lsx_id),
        users,
      )
      for (const it of items) {
        const payload = {
          lsx_id: it.lsx_id,
          dau: it.dau,
          title: it.title,
          href: `/mua-hang/soat/${it.lsx_id}`,
        }
        for (const uid of it.recipient_ids) {
          const n = cu.get(`${uid}|${it.lsx_id}`)
          const v = quyetDinhTin(
            n ? { dau: (n.payload?.dau as string | undefined) ?? null, daDoc: !!n.read_at } : null, // prettier-ignore
            it.dau,
          )
          if (v === 'cap_nhat') await notificationsRepo.refreshUnread(n!.id, payload, e.actor_id) // prettier-ignore
          else if (v === 'them')
            await notificationsRepo.insert({ user_id: uid, actor_id: e.actor_id, type: LOAI, payload }) // prettier-ignore
        }
      }
    }),
  )

  on('supply.lsx.da_soat', (e) =>
    noiHang(() => notificationsRepo.markReadByPayloadKey(LOAI, 'lsx_id', e.lsx_id)),
  )

  /*
    Định mức / lệnh đổi trên màn → tính lại NGAY các lệnh liên quan (không đợi
    lần tính định kỳ 2 phút). Nạp service Cung ứng lúc chạy: nó import
    '@/events/register' (để phát sự kiện) — nạp tĩnh ở đây là vòng tròn.
  */
  on('product.bom.changed', async (e) => {
    const { capNhatLenhDoi } = await import('@/modules/dept/supply/lenh-doi.service')
    capNhatLenhDoi({ product_id: e.product_id }, e.changed_by)
  })
  for (const ten of [
    'lsx.revised',
    'lsx.header.changed',
    'lsx.orders.changed',
  ] as const) {
    on(ten, async (e) => {
      const { capNhatLenhDoi } = await import('@/modules/dept/supply/lenh-doi.service')
      const actor = 'revised_by' in e ? e.revised_by : e.changed_by
      capNhatLenhDoi({ lsx_id: e.production_order_id }, actor)
    })
  }
}
