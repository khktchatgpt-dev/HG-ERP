import Link from 'next/link'
import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { notificationsService } from '@/modules/core/notifications/notifications.service'
import { AppShell } from '@/components/AppShell'
import { MarkAllRead } from './MarkAllRead'

const TYPE_LABEL: Record<string, string> = {
  assigned: 'đã giao bạn một công việc',
  reassigned: 'đã chuyển công việc cho bạn',
  status_changed: 'đã đổi trạng thái',
  submitted: 'đã báo hoàn thành',
  quote_submitted: 'gửi báo giá chờ bạn duyệt',
  quote_approved: 'đã duyệt báo giá',
  quote_rejected: 'đã từ chối báo giá',
  wh_receipt: 'đã lập phiếu nhập kho',
  wh_stock_low: 'cảnh báo tồn dưới mức tối thiểu',
  po_submitted: 'gửi đơn đặt vật tư chờ bạn duyệt',
  po_approved: 'đã duyệt đơn đặt vật tư',
  po_rejected: 'đã từ chối đơn đặt vật tư',
  lsx_submitted: 'gửi LSX chờ bạn duyệt',
  lsx_approved: 'đã duyệt LSX',
  lsx_rejected: 'đã từ chối LSX',
  order_changed: 'đã sửa đơn hàng sau khi phát LSX',
  order_cancelled: 'đã huỷ đơn hàng',
  approved: 'đã duyệt công việc của bạn',
  rejected: 'đã trả lại công việc',
  commented: 'đã bình luận',
  due_soon: 'công việc sắp đến hạn',
  overdue: 'công việc đã quá hạn',
}

export default async function NotificationsPage() {
  const user = await authService.currentUser()
  if (!user) redirect('/login')

  const items = await notificationsService.listMine(user)

  return (
    <AppShell title="Thông báo" actions={<MarkAllRead />}>
      <div className="mx-auto max-w-3xl">
        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-12 text-center text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950">
            Chưa có thông báo nào.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
            {items.map((n) => {
              const title = (n.payload as { title?: string })?.title
              return (
                <li
                  key={n.id}
                  className={`px-4 py-3 ${
                    n.read_at ? 'opacity-60' : 'bg-zinc-50 dark:bg-zinc-900/30'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <div>
                      <span className="font-medium">{TYPE_LABEL[n.type] ?? n.type}</span>
                      {title && <span className="text-zinc-500"> — {title}</span>}
                    </div>
                    {n.task_id && (
                      <Link href={`/tasks/${n.task_id}`} className="text-xs underline">
                        Mở
                      </Link>
                    )}
                  </div>
                  <time className="text-xs text-zinc-500">
                    {new Date(n.created_at).toLocaleString('vi-VN')}
                  </time>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </AppShell>
  )
}
