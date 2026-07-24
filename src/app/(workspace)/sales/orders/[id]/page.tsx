import { notFound } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { usersRepo } from '@/modules/core/users/users.repo'
import { ordersService } from '@/modules/dept/sales/orders.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { jobsRepo } from '@/modules/dept/production/jobs.repo'
import { posRepo } from '@/modules/dept/supply/pos.repo'
import { filesService } from '@/modules/core/files/files.service'
import { HttpError } from '@/server/http'
import {
  OrderDetailView,
  type CancelImpact,
  type ChangeView,
} from '@/components/sales/OrderDetailView'

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

  // Timeline: owner + công đoạn đã xong (jobs — 0084) + nhãn giai đoạn.
  const [owner, jobs, stages] = await Promise.all([
    order.created_by ? usersRepo.findById(order.created_by) : null,
    lsx ? jobsRepo.listByLsx(lsx.id) : Promise.resolve([]),
    productionRepo.listStages(),
  ])
  // Map jobs → sự kiện timeline (giữ nguyên OrderDetailView): job done = mốc
  // "Hoàn thành công đoạn"; nhận vật tư = mốc trên header lệnh.
  const progress = [
    ...(lsx?.materials_received_at
      ? [
          {
            stage: '',
            action: 'received' as const,
            note: null,
            updated_by_name: null,
            created_at: lsx.materials_received_at,
          },
        ]
      : []),
    ...jobs
      .filter((j) => j.status === 'done' && j.done_at)
      .map((j) => ({
        stage: j.stage,
        action: 'done' as const,
        note: j.note,
        updated_by_name: j.team_name,
        created_at: j.done_at!,
      })),
  ]

  // Hệ quả nếu huỷ đơn — confirm dialog nói thật thay vì câu chung chung (P3).
  let cancelImpact: CancelImpact | null = null
  if (lsx && order.status !== 'delivered' && order.status !== 'cancelled') {
    const { rows: pos } = await posRepo.list({
      production_order_id: lsx.id,
      page: 1,
      page_size: 200,
    })
    cancelImpact = {
      lsx_active: ['pending_approval', 'approved', 'in_progress'].includes(lsx.status),
      pos_auto: pos
        .filter((p) => p.status === 'pending_approval' || p.status === 'approved')
        .map((p) => p.code),
      pos_manual: pos
        .filter((p) =>
          ['ordered', 'confirmed', 'in_transit', 'partial'].includes(p.status),
        )
        .map((p) => p.code),
    }
  }

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
        deposit_percent: order.deposit_percent,
        price_term: order.price_term,
        payment_terms: order.payment_terms,
        payment_method: order.payment_method,
        qty_tolerance_pct: order.qty_tolerance_pct,
        partial_shipment: order.partial_shipment,
        transhipment: order.transhipment,
        port_of_loading: order.port_of_loading,
        port_of_discharge: order.port_of_discharge,
        required_docs: order.required_docs,
        container_summary: order.container_summary,
        note: order.note,
        owner_name: owner?.name ?? null,
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
      lsx={
        lsx
          ? {
              id: lsx.id,
              code: lsx.code,
              status: lsx.status,
              issued_at: lsx.issued_at,
              approved_at: lsx.approved_at,
              completed_at: lsx.completed_at,
              rejected_reason: lsx.rejected_reason,
              updated_at: lsx.updated_at,
            }
          : null
      }
      progress={progress.map((p) => ({
        stage: p.stage,
        action: p.action,
        note: p.note,
        updated_by_name: p.updated_by_name,
        created_at: p.created_at,
      }))}
      stageLabels={Object.fromEntries(stages.map((s) => [s.code, s.label]))}
      cancelImpact={cancelImpact}
    />
  )
}
