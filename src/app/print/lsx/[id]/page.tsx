import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { settingsService } from '@/modules/core/settings/settings.service'
import {
  productionRepo,
  listLsxPrintLines,
} from '@/modules/dept/production/production.repo'
import { ordersRepo } from '@/modules/dept/sales/orders.repo'
import { filesService } from '@/modules/core/files/files.service'
import { LsxPrintSheet } from '../LsxPrintSheet'

/**
 * In phiếu LỆNH SẢN XUẤT chính thức (mẫu Hoàng Gia) — template dùng chung ở
 * LsxPrintSheet.tsx; bản xem trước khi CHƯA phát: /print/lsx/preview/[orderId].
 */
export default async function LsxPrintPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await authService.currentUser()
  if (!user) redirect('/login')
  const { id } = await params

  const lsx = await productionRepo.findById(id)
  if (!lsx) redirect('/sales/tracking')

  const [lines, order, company] = await Promise.all([
    listLsxPrintLines(id, lsx.sales_order_id),
    ordersRepo.findById(lsx.sales_order_id),
    settingsService.getAll(),
  ])

  // Ảnh SP (cột Hình ảnh) — signed URL ngắn hạn, lỗi thì bỏ ảnh.
  const imageUrls = new Map<string, string>()
  await Promise.all(
    [...new Set(lines.map((l) => l.image_file_id).filter(Boolean))].map(async (fid) => {
      try {
        imageUrls.set(
          fid as string,
          await filesService.getDownloadUrl(user, fid as string),
        )
      } catch {
        /* thiếu ảnh không chặn in */
      }
    }),
  )

  return (
    <LsxPrintSheet
      company={company}
      header={{
        customer_name: lsx.customer_name,
        order_ref: order?.customer_po_no || lsx.order_code,
        received_date: lsx.received_date ?? order?.created_at ?? null,
        completed_at: lsx.completed_at,
        code: lsx.code,
        note: lsx.note,
        ship_date: lsx.ship_date,
      }}
      lines={lines}
      imageUrls={imageUrls}
    />
  )
}
