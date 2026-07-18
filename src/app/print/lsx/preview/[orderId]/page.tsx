import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { settingsService } from '@/modules/core/settings/settings.service'
import { listLsxPrintLines } from '@/modules/dept/production/production.repo'
import { ordersRepo } from '@/modules/dept/sales/orders.repo'
import { filesService } from '@/modules/core/files/files.service'
import { LsxPrintSheet } from '../../LsxPrintSheet'

/**
 * XEM TRƯỚC bản in LSX khi CHƯA phát lệnh — Sales dò thông số/mẫu phiếu ngay
 * trong form phát (số LSX, ngày xuất truyền qua query). Watermark đỏ để bản
 * in thử không bị dùng nhầm làm bản chính thức.
 */
export default async function LsxPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await authService.currentUser()
  if (!user) redirect('/login')
  const { orderId } = await params
  const sp = await searchParams
  const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''

  const order = await ordersRepo.findById(orderId)
  if (!order) redirect('/sales/orders')

  const [lines, company] = await Promise.all([
    // null = chưa có lệnh → thông số mặc định của SP, không có override.
    listLsxPrintLines(null, orderId),
    settingsService.getAll(),
  ])

  const imageUrls = new Map<string, string>()
  await Promise.all(
    [...new Set(lines.map((l) => l.image_file_id).filter(Boolean))].map(async (fid) => {
      try {
        imageUrls.set(
          fid as string,
          await filesService.getDownloadUrl(user, fid as string),
        )
      } catch {
        /* thiếu ảnh không chặn xem trước */
      }
    }),
  )

  return (
    <LsxPrintSheet
      company={company}
      header={{
        customer_name: order.customer_name,
        order_ref: order.customer_po_no || order.code,
        received_date: str(sp.received_date) || order.created_at,
        completed_at: null,
        code: str(sp.code).trim() || '(chưa đặt số)',
        note: null,
        ship_date: str(sp.ship_date) || null,
      }}
      lines={lines}
      imageUrls={imageUrls}
      watermark="Bản xem trước — lệnh chưa phát"
    />
  )
}
