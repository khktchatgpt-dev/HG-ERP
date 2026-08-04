import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { settingsService } from '@/modules/core/settings/settings.service'
import { lsxLinesService } from '@/modules/dept/production/lsx-lines.service'
import { ordersRepo } from '@/modules/dept/sales/orders.repo'
import { customersRepo } from '@/modules/dept/sales/sales.repo'
import { resolveLsxTemplate } from '@/modules/dept/sales/lsx-template'
import { filesService } from '@/modules/core/files/files.service'
import { LsxPrintSheet, type LsxSheetGroup } from '../../LsxPrintSheet'
import type { LsxLine } from '@/modules/dept/production/lsx-lines.repo'

/**
 * XEM TRƯỚC bản in LSX khi CHƯA phát lệnh — Sales dò mẫu/thông số ngay trong
 * form phát (số LSX, ngày xuất truyền qua query; `orders=` là các đơn đang gộp).
 * Dòng dựng tạm từ đơn, KHÔNG ghi DB. Watermark đỏ để bản thử không bị dùng nhầm.
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

  // Chỉ nhận đơn CÙNG KHÁCH — query string là dữ liệu người dùng gửi lên.
  const merged = await Promise.all(
    str(sp.orders)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((id) => ordersRepo.findById(id)),
  )
  const orderIds = [
    orderId,
    ...merged.filter((o) => o && o.customer_id === order.customer_id).map((o) => o!.id),
  ]

  const [drafts, customer, company] = await Promise.all([
    lsxLinesService.draftFromOrders(orderIds),
    customersRepo.findById(order.customer_id),
    settingsService.getAll(),
  ])

  // Dòng nháp chưa có id thật — gán id tạm để React key và bảng chạy như thường.
  const groups: LsxSheetGroup[] = drafts.map((g, gi) => ({
    id: `draft-${gi}`,
    title: g.title ?? null,
    buyer_name: g.buyer_name ?? null,
    po_no: g.po_no ?? null,
    ship_date: g.ship_date ?? null,
    ship_label: g.ship_label ?? null,
    note: g.note ?? null,
    lines: g.lines.map(
      (l, li) =>
        ({
          ...l,
          id: `draft-${gi}-${li}`,
          production_order_id: '',
          group_id: `draft-${gi}`,
          changed_in_rev: null,
        }) as LsxLine,
    ),
  }))

  const imageUrls = new Map<string, string>()
  await Promise.all(
    [
      ...new Set(
        groups.flatMap((g) => g.lines.map((l) => l.image_file_id).filter(Boolean)),
      ),
    ].map(async (fid) => {
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
        code: str(sp.code).trim() || '(chưa đặt số)',
        issued_at: new Date().toISOString(),
        received_date: str(sp.received_date) || order.created_at,
        completed_at: null,
        container_summary: order.container_summary,
        note: null,
        revision: 1,
        revised_at: null,
      }}
      template={resolveLsxTemplate(customer?.lsx_template)}
      groups={groups}
      imageUrls={imageUrls}
      watermark="Bản xem trước — lệnh chưa phát"
    />
  )
}
