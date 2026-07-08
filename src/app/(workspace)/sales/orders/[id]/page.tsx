import { notFound } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { ordersService } from '@/modules/dept/sales/orders.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { filesService } from '@/modules/core/files/files.service'
import { HttpError } from '@/server/http'
import { OrderDetailView, type ChangeView } from '@/components/sales/OrderDetailView'

/** Trang chi tiết đơn hàng: thông tin đầy đủ + ảnh SP + file + phát LSX / sửa / huỷ. */
export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = (await authService.currentUser())!
  const { id } = await params

  let data
  try {
    data = await ordersService.detail(user, id)
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound()
    throw e
  }
  const { order, lines, changes } = data

  const dept = user.department_id
    ? await departmentsRepo.findById(user.department_id)
    : null
  const canEdit = user.role === 'admin' || dept?.name === 'Bán Hàng'
  const canIssue = user.role === 'admin' || dept?.name === 'Bán Hàng' // Sales phát LSX
  const lsx = await productionRepo.findByOrder(order.id)

  // Ảnh SP (signed URL ngắn hạn) — lỗi thì bỏ ảnh, không chặn xem đơn.
  const imageUrls = new Map<string, string>()
  await Promise.all(
    [...new Set(lines.map((l) => l.image_file_id).filter(Boolean))].map(async (fid) => {
      try {
        imageUrls.set(
          fid as string,
          await filesService.getDownloadUrl(user, fid as string),
        )
      } catch {
        /* ignore */
      }
    }),
  )

  return (
    <OrderDetailView
      order={{
        id: order.id,
        code: order.code,
        customer_name: order.customer_name,
        quote_code: order.quote_code,
        customer_po_no: order.customer_po_no,
        status: order.status,
        currency: order.currency,
        due_date: order.due_date,
        container_summary: order.container_summary,
        note: order.note,
        created_at: order.created_at,
      }}
      lines={lines.map((l) => ({
        product_code: l.product_code,
        product_name: l.product_name,
        product_unit: l.product_unit,
        customer_item_code: l.customer_item_code,
        bom_status: l.bom_status,
        qty: l.qty,
        unit_price: l.unit_price,
        note: l.note,
        image_url: l.image_file_id ? (imageUrls.get(l.image_file_id) ?? null) : null,
      }))}
      changes={changes.map((c) => ({
        id: c.id,
        changed_by_name: c.changed_by_name,
        change: c.change as ChangeView['change'],
        note: c.note,
        created_at: c.created_at,
      }))}
      canEdit={canEdit}
      canIssue={canIssue}
      lsx={lsx ? { id: lsx.id, code: lsx.code, status: lsx.status } : null}
    />
  )
}
