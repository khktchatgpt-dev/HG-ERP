'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/Badge'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { PageHeader } from '@/components/erp/PageHeader'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'
import { DocumentFiles } from '@/components/DocumentFiles'

type OrderStatus =
  | 'confirmed'
  | 'lsx_pending'
  | 'lsx_issued'
  | 'in_production'
  | 'completed'
  | 'delivered'
  | 'cancelled'

export type OrderView = {
  id: string
  code: string
  customer_name: string
  quote_code: string | null
  customer_po_no: string | null
  status: OrderStatus
  currency: string
  due_date: string | null
  deposit_percent: number | null
  price_term: string | null
  payment_terms: string | null
  payment_method: string | null
  qty_tolerance_pct: number | null
  partial_shipment: boolean | null
  transhipment: boolean | null
  port_of_loading: string | null
  port_of_discharge: string | null
  required_docs: string | null
  container_summary: string | null
  note: string | null
  owner_name: string | null
  created_at: string
}
export type LineView = {
  product_code: string
  product_name: string
  product_unit: string
  customer_item_code: string | null
  bom_status: 'none' | 'drawing' | 'done'
  qty: number
  unit_price: number
  note: string | null
  image_url: string | null
}
export type ChangeView = {
  id: string
  changed_by_name: string | null
  change: {
    type?: string
    fields?: Record<string, { from: unknown; to: unknown }>
    lines?: unknown
  }
  note: string | null
  created_at: string
}
export type LsxView = {
  id: string
  code: string
  status: string
  issued_at: string | null
  approved_at: string | null
  completed_at: string | null
  rejected_reason: string | null
  updated_at: string
}
export type ProgressView = {
  stage: string
  action: 'start' | 'done' | 'received' | 'cancelled'
  note: string | null
  updated_by_name: string | null
  created_at: string
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  confirmed: 'Đã xác nhận',
  lsx_pending: 'Chờ duyệt LSX',
  lsx_issued: 'Đã phát LSX',
  in_production: 'Đang sản xuất',
  completed: 'Hoàn thành',
  delivered: 'Đã giao',
  cancelled: 'Đã huỷ',
}
const STATUS_TONE: Record<OrderStatus, 'gray' | 'blue' | 'amber' | 'green' | 'red'> = {
  confirmed: 'blue',
  lsx_pending: 'amber',
  lsx_issued: 'amber',
  in_production: 'amber',
  completed: 'green',
  delivered: 'green',
  cancelled: 'red',
}
const FIELD_LABEL: Record<string, string> = {
  customer_po_no: 'PO khách',
  due_date: 'Hạn giao',
  deposit_percent: '% cọc',
  price_term: 'Điều kiện giá',
  payment_terms: 'Thanh toán',
  container_summary: 'Container',
  note: 'Ghi chú',
  status: 'Trạng thái',
  qty_tolerance_pct: 'Dung sai %',
  partial_shipment: 'Giao từng phần',
  transhipment: 'Chuyển tải',
  port_of_loading: 'Cảng xếp',
  port_of_discharge: 'Cảng dỡ',
  payment_method: 'Phương thức TT',
  required_docs: 'Chứng từ',
}

const fmtD = (d: string | null) => (d ? new Date(d).toLocaleDateString('vi-VN') : '—')
const fmtDT = (d: string) => new Date(d).toLocaleString('vi-VN')

/** Hệ quả khi huỷ đơn — server tính sẵn để confirm dialog nói thật (P3). */
export type CancelImpact = {
  lsx_active: boolean
  pos_auto: string[] // PO chưa gửi NCC — sẽ tự huỷ
  pos_manual: string[] // PO đã gửi NCC — Cung ứng xử lý tay
}

type Tab = 'overview' | 'timeline' | 'docs'

export function OrderDetailView({
  order,
  lines,
  changes,
  canEdit,
  canIssue,
  lsx,
  progress,
  stageLabels,
  cancelImpact,
}: {
  order: OrderView
  lines: LineView[]
  changes: ChangeView[]
  canEdit: boolean
  canIssue: boolean
  lsx: LsxView | null
  progress: ProgressView[]
  stageLabels: Record<string, string>
  cancelImpact: CancelImpact | null
}) {
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const [tab, setTab] = useState<Tab>('overview')
  const [busy, setBusy] = useState(false)
  const [issuing, setIssuing] = useState(false)
  const [lsxCode, setLsxCode] = useState('')
  const [shipDate, setShipDate] = useState(order.due_date ?? '')
  const [container, setContainer] = useState(order.container_summary ?? '')

  const editable = order.status !== 'delivered' && order.status !== 'cancelled'
  const total = lines.reduce((s, l) => s + l.qty * l.unit_price, 0)
  const totalQty = lines.reduce((s, l) => s + l.qty, 0)
  const bomPending = lines.filter((l) => l.bom_status !== 'done').length

  // ── Timeline hợp nhất: tạo đơn → sửa → LSX → tiến độ SX → giao/huỷ ────
  const timeline = useMemo(() => {
    type Ev = {
      at: string
      title: string
      who: string | null
      detail: string | null
      tone: 'blue' | 'green' | 'red' | 'amber' | 'gray'
    }
    const evs: Ev[] = [
      {
        at: order.created_at,
        title: `Tạo đơn ${order.code}`,
        who: order.owner_name,
        detail: order.quote_code ? `Từ báo giá ${order.quote_code}` : 'Tạo trực tiếp',
        tone: 'blue',
      },
    ]
    for (const c of changes) {
      const t = c.change.type
      if (t === 'cancel') {
        evs.push({
          at: c.created_at,
          title: 'Huỷ đơn',
          who: c.changed_by_name,
          detail: c.note,
          tone: 'red',
        })
      } else if (t === 'delivered') {
        evs.push({
          at: c.created_at,
          title: 'Xác nhận đã giao hàng',
          who: c.changed_by_name,
          detail: c.note,
          tone: 'green',
        })
      } else {
        const fields = c.change.fields
          ? Object.entries(c.change.fields)
              .filter(([f]) => f !== 'status')
              .map(
                ([f, v]) =>
                  `${FIELD_LABEL[f] ?? f}: ${String(v.from ?? '—')} → ${String(v.to ?? '—')}`,
              )
          : []
        if (c.change.lines != null) fields.push('Danh sách sản phẩm thay đổi')
        evs.push({
          at: c.created_at,
          title: 'Sửa đơn (khách thay đổi)',
          who: c.changed_by_name,
          detail: [c.note, ...fields].filter(Boolean).join(' · ') || null,
          tone: 'amber',
        })
      }
    }
    if (lsx) {
      if (lsx.issued_at)
        evs.push({
          at: lsx.issued_at,
          title: `Phát LSX ${lsx.code}`,
          who: null,
          detail: null,
          tone: 'blue',
        })
      if (lsx.approved_at)
        evs.push({
          at: lsx.approved_at,
          title: 'LSX được Giám đốc duyệt',
          who: null,
          detail: null,
          tone: 'green',
        })
      if (lsx.status === 'rejected')
        evs.push({
          at: lsx.updated_at,
          title: 'LSX bị từ chối',
          who: null,
          detail: lsx.rejected_reason,
          tone: 'red',
        })
      for (const p of progress) {
        const st = stageLabels[p.stage] ?? p.stage
        evs.push({
          at: p.created_at,
          title:
            p.action === 'start'
              ? `Bắt đầu: ${st}`
              : p.action === 'done'
                ? `Hoàn thành: ${st}`
                : p.action === 'received'
                  ? 'Xưởng xác nhận nhận vật tư'
                  : 'LSX dừng theo đơn',
          who: p.updated_by_name,
          detail: p.note,
          tone: p.action === 'done' ? 'green' : p.action === 'cancelled' ? 'red' : 'gray',
        })
      }
      if (lsx.completed_at)
        evs.push({
          at: lsx.completed_at,
          title: 'Sản xuất hoàn thành',
          who: null,
          detail: null,
          tone: 'green',
        })
    }
    return evs.sort((a, b) => a.at.localeCompare(b.at))
  }, [order, changes, lsx, progress, stageLabels])

  async function issueLsx() {
    setBusy(true)
    try {
      await api('/api/dept/production/lsx', {
        method: 'POST',
        body: {
          code: lsxCode.trim(),
          order_id: order.id,
          ship_date: shipDate || null,
          container_summary: container.trim() || order.container_summary,
        },
      })
      toast.success('Đã phát LSX — chờ Giám đốc duyệt', order.code)
      setIssuing(false)
      router.refresh()
    } catch (e) {
      toast.error('Phát LSX thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  async function deliverOrder() {
    const ok = await confirm({
      title: `Xác nhận đã giao đơn ${order.code}?`,
      description: 'Đơn chuyển sang "Đã giao" và không sửa được nữa.',
      confirmLabel: 'Đã giao hàng',
    })
    if (!ok) return
    setBusy(true)
    try {
      await api(`/api/dept/sales/orders/${order.id}/deliver`, {
        method: 'POST',
        body: {},
      })
      toast.success('Đơn đã giao — chuỗi hoàn tất', order.code)
      router.refresh()
    } catch (e) {
      toast.error('Xác nhận giao thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  async function cancelOrder() {
    const reason = window.prompt(`Lý do huỷ đơn ${order.code}:`)?.trim()
    if (!reason) return
    const impact: string[] = ['Đơn đã huỷ không khôi phục được.']
    if (cancelImpact?.lsx_active && lsx) {
      impact.push(`LSX ${lsx.code} sẽ dừng (Đã huỷ).`)
    }
    if (cancelImpact?.pos_auto.length) {
      impact.push(
        `Tự huỷ ${cancelImpact.pos_auto.length} PO chưa gửi NCC: ${cancelImpact.pos_auto.join(', ')}.`,
      )
    }
    if (cancelImpact?.pos_manual.length) {
      impact.push(
        `${cancelImpact.pos_manual.length} PO ĐÃ GỬI NCC không tự huỷ — Cung ứng xử lý tay: ${cancelImpact.pos_manual.join(', ')}.`,
      )
    }
    if (cancelImpact?.lsx_active) {
      impact.push(
        'Vật tư đã xuất không tự hoàn kho — Kho lập phiếu nhập lại nếu thu hồi.',
      )
    }
    const ok = await confirm({
      title: `Huỷ đơn ${order.code}?`,
      description: impact.join(' '),
      tone: 'danger',
      confirmLabel: 'Huỷ đơn',
    })
    if (!ok) return
    setBusy(true)
    try {
      await api(`/api/dept/sales/orders/${order.id}/cancel`, {
        method: 'POST',
        body: { reason },
      })
      toast.success('Đã huỷ đơn', order.code)
      router.refresh()
    } catch (e) {
      toast.error('Huỷ thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Tổng quan' },
    { id: 'timeline', label: `Timeline (${timeline.length})` },
    { id: 'docs', label: 'Tài liệu' },
  ]

  return (
    <div className="flex flex-col gap-4">
      <TopProgressBar active={busy} />
      <PageHeader
        breadcrumbs={[
          { label: 'Kinh doanh', href: '/sales' },
          { label: 'Đơn hàng', href: '/sales/orders' },
          { label: order.code },
        ]}
        title={order.code}
        description={order.customer_name}
        meta={
          <>
            <Badge tone={STATUS_TONE[order.status]}>{STATUS_LABEL[order.status]}</Badge>
            {order.quote_code && <Badge>Từ BG {order.quote_code}</Badge>}
            {order.customer_po_no && <Badge>PO {order.customer_po_no}</Badge>}
          </>
        }
        actions={
          canEdit &&
          editable && (
            <Link
              href={`/sales/orders/${order.id}/edit`}
              className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700"
            >
              Sửa đơn
            </Link>
          )
        }
      />

      {bomPending > 0 && (
        <div className="rounded-md bg-amber-50 p-2 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">
          ⚠ {bomPending} dòng SP chưa xong BOM — phát LSX vẫn được (BR-07) nhưng Cung ứng
          thiếu định mức để đặt vật tư.
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={
              'border-b-2 px-4 py-2 text-sm font-medium transition-colors ' +
              (tab === t.id
                ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200')
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="flex flex-col gap-4">
          {/* Header đơn — 9 trường Sales cần nhất (brief) */}
          <Card title="Thông tin đơn">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-4">
              <Info label="Khách hàng" value={order.customer_name} />
              <Info label="PO khách" value={order.customer_po_no} />
              <Info label="Ngày đặt" value={fmtD(order.created_at)} />
              <Info label="Hạn giao" value={fmtD(order.due_date)} />
              <Info label="Thanh toán" value={order.payment_terms} />
              <Info
                label="Đặt cọc"
                value={order.deposit_percent != null ? `${order.deposit_percent}%` : null}
              />
              <Info label="Người phụ trách" value={order.owner_name} />
              <Info label="Từ báo giá" value={order.quote_code ?? 'Trực tiếp'} />
              <Info label="Tiền tệ" value={order.currency} />
            </div>
            {order.note && (
              <div className="mt-3 border-t border-zinc-200 pt-3 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                <span className="font-medium">Ghi chú: </span>
                {order.note}
              </div>
            )}
          </Card>

          {/* Logistics — trước đây có data nhưng không hiển thị */}
          {(order.price_term ||
            order.port_of_loading ||
            order.port_of_discharge ||
            order.container_summary ||
            order.qty_tolerance_pct != null ||
            order.partial_shipment != null ||
            order.transhipment != null ||
            order.payment_method ||
            order.required_docs) && (
            <Card title="Logistics & điều kiện giao">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-4">
                <Info label="Incoterm / ĐK giá" value={order.price_term} />
                <Info label="Cảng xếp (POL)" value={order.port_of_loading} />
                <Info label="Cảng dỡ (POD)" value={order.port_of_discharge} />
                <Info label="Container" value={order.container_summary} />
                <Info
                  label="Dung sai SL"
                  value={
                    order.qty_tolerance_pct != null
                      ? `±${order.qty_tolerance_pct}%`
                      : null
                  }
                />
                <Info
                  label="Giao từng phần"
                  value={
                    order.partial_shipment == null
                      ? null
                      : order.partial_shipment
                        ? 'Cho phép'
                        : 'Không'
                  }
                />
                <Info
                  label="Chuyển tải"
                  value={
                    order.transhipment == null
                      ? null
                      : order.transhipment
                        ? 'Cho phép'
                        : 'Không'
                  }
                />
                <Info label="Phương thức TT" value={order.payment_method} />
                <Info
                  label="Chứng từ yêu cầu"
                  value={order.required_docs}
                  className="col-span-2"
                />
              </div>
            </Card>
          )}

          {/* Dòng sản phẩm với ảnh */}
          <Card title={`Sản phẩm (${lines.length})`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 uppercase dark:border-zinc-800">
                    <th className="py-2 pr-2">Ảnh</th>
                    <th className="py-2 pr-2">Sản phẩm</th>
                    <th className="w-24 py-2 pr-2">BOM</th>
                    <th className="w-20 py-2 pr-2 text-right">SL</th>
                    <th className="w-28 py-2 pr-2 text-right">Đơn giá</th>
                    <th className="w-32 py-2 text-right">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i} className="border-b border-zinc-100 dark:border-zinc-900">
                      <td className="py-1.5 pr-2">
                        {l.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={l.image_url}
                            alt={l.product_name}
                            className="h-12 w-14 rounded object-contain"
                          />
                        ) : (
                          <span className="text-zinc-300">—</span>
                        )}
                      </td>
                      <td className="py-1.5 pr-2">
                        <div className="flex flex-col">
                          <span className="font-mono text-xs text-zinc-400">
                            {l.product_code}
                            {l.customer_item_code && ` · KH: ${l.customer_item_code}`}
                          </span>
                          <span>{l.product_name}</span>
                          {l.note && (
                            <span className="text-xs text-zinc-500">{l.note}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-1.5 pr-2">
                        <Badge
                          tone={
                            l.bom_status === 'done'
                              ? 'green'
                              : l.bom_status === 'drawing'
                                ? 'amber'
                                : 'gray'
                          }
                        >
                          {l.bom_status === 'done'
                            ? 'Đã vẽ'
                            : l.bom_status === 'drawing'
                              ? 'Đang vẽ'
                              : 'Chưa có'}
                        </Badge>
                      </td>
                      <td className="py-1.5 pr-2 text-right">
                        {l.qty.toLocaleString('vi-VN')} {l.product_unit}
                      </td>
                      <td className="py-1.5 pr-2 text-right">
                        {l.unit_price.toLocaleString('en-US')}
                      </td>
                      <td className="py-1.5 text-right font-medium">
                        {(l.qty * l.unit_price).toLocaleString('en-US')}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} className="py-2 pr-2 text-right font-semibold">
                      Tổng
                    </td>
                    <td className="py-2 pr-2 text-right font-semibold">
                      {totalQty.toLocaleString('vi-VN')}
                    </td>
                    <td />
                    <td className="py-2 text-right font-bold">
                      {total.toLocaleString('en-US')} {order.currency}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          {/* LSX đã phát — link sang chi tiết */}
          {lsx && (
            <Card title="Lệnh sản xuất">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-sm">{lsx.code}</span>
                <Badge
                  tone={
                    lsx.status === 'pending_approval'
                      ? 'amber'
                      : lsx.status === 'rejected'
                        ? 'red'
                        : lsx.status === 'completed'
                          ? 'green'
                          : lsx.status === 'cancelled'
                            ? 'gray'
                            : 'blue'
                  }
                >
                  {lsx.status === 'pending_approval'
                    ? 'Chờ GĐ duyệt'
                    : lsx.status === 'approved'
                      ? 'Đã duyệt'
                      : lsx.status === 'in_progress'
                        ? 'Đang sản xuất'
                        : lsx.status === 'completed'
                          ? 'Hoàn thành'
                          : lsx.status === 'cancelled'
                            ? 'Đã huỷ theo đơn'
                            : 'Bị từ chối'}
                </Badge>
                <a
                  href={`/print/lsx/${lsx.id}`}
                  target="_blank"
                  rel="noopener"
                  className="ml-auto rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                >
                  🖨 In LSX
                </a>
                <Link
                  href={`/sales/lsx/${lsx.id}`}
                  className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700"
                >
                  Xem / thao tác LSX →
                </Link>
              </div>
            </Card>
          )}

          {/* Phát LSX */}
          {canIssue && order.status === 'confirmed' && !lsx && (
            <Card title="Phát Lệnh sản xuất (LSX)">
              {issuing ? (
                <div className="flex flex-col gap-3">
                  <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                    Một đơn chỉ phát đúng 1 LSX (BR-01). Không bắt buộc đủ BOM (BR-07).
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                      Số LSX <span className="text-red-500">*</span>
                      <input
                        value={lsxCode}
                        onChange={(e) => setLsxCode(e.target.value)}
                        maxLength={50}
                        placeholder="Tự đặt — vd 27/25-26 (17951+17955HG/MX)"
                        className="rounded-md border border-zinc-300 px-3 py-2 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-900"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      Thời gian xuất dự kiến
                      <input
                        type="date"
                        value={shipDate}
                        onChange={(e) => setShipDate(e.target.value)}
                        className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      Container
                      <input
                        value={container}
                        onChange={(e) => setContainer(e.target.value)}
                        placeholder="3 x 40'HC"
                        className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                      />
                    </label>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    {/* Xem trước phiếu in (mẫu Hoàng Gia) với số/ngày đang gõ —
                        dò thông số trước khi phát, bản thử có watermark đỏ. */}
                    <a
                      href={`/print/lsx/preview/${order.id}?code=${encodeURIComponent(
                        lsxCode.trim(),
                      )}&ship_date=${encodeURIComponent(shipDate)}`}
                      target="_blank"
                      rel="noopener"
                      className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                    >
                      🖨 Xem trước bản in
                    </a>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setIssuing(false)}
                        className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                      >
                        Huỷ
                      </button>
                      <button
                        disabled={busy || !lsxCode.trim()}
                        onClick={() => void issueLsx()}
                        className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {busy && <Spinner size={14} />}
                        Xác nhận phát LSX
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setIssuing(true)}
                  className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  Phát LSX cho đơn này
                </button>
              )}
            </Card>
          )}

          {canEdit && editable && (
            <div className="flex justify-end gap-2 pb-6">
              {order.status === 'completed' && (
                <button
                  onClick={() => void deliverOrder()}
                  className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  ✓ Xác nhận đã giao
                </button>
              )}
              <button
                onClick={() => void cancelOrder()}
                className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
              >
                Huỷ đơn
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'timeline' && (
        <Card title="Dòng thời gian đơn hàng">
          <ol className="relative ml-2 flex flex-col gap-0 border-l border-zinc-200 dark:border-zinc-800">
            {timeline.map((ev, i) => (
              <li key={i} className="relative pb-5 pl-5 last:pb-0">
                <span
                  className={
                    'absolute top-1 -left-[5px] h-2.5 w-2.5 rounded-full ring-4 ring-white dark:ring-zinc-950 ' +
                    (ev.tone === 'green'
                      ? 'bg-green-500'
                      : ev.tone === 'red'
                        ? 'bg-red-500'
                        : ev.tone === 'amber'
                          ? 'bg-amber-500'
                          : ev.tone === 'blue'
                            ? 'bg-sky-500'
                            : 'bg-zinc-300 dark:bg-zinc-600')
                  }
                />
                <div className="text-xs text-zinc-400 tabular-nums">
                  {fmtDT(ev.at)}
                  {ev.who && <span> · {ev.who}</span>}
                </div>
                <div className="mt-0.5 text-sm font-medium">{ev.title}</div>
                {ev.detail && (
                  <div className="mt-0.5 text-xs text-zinc-500">{ev.detail}</div>
                )}
              </li>
            ))}
          </ol>
        </Card>
      )}

      {tab === 'docs' && (
        <Card title="Tài liệu đơn hàng">
          <p className="mb-3 text-xs text-zinc-400">
            PO khách · Báo giá PDF · Spec / bản vẽ · Packing list · Invoice · B/L · C/O ·
            C/Q — đính kèm tất cả vào đây để cả chuỗi cùng xem.
          </p>
          <DocumentFiles
            kind="sales_order"
            id={order.id}
            canEdit={canEdit}
            title="File đính kèm"
          />
        </Card>
      )}
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="border-b border-zinc-200 px-4 py-2.5 dark:border-zinc-800">
        <h2 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
          {title}
        </h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

function Info({
  label,
  value,
  className = '',
}: {
  label: string
  value: string | null
  className?: string
}) {
  return (
    <div className={`flex flex-col ${className}`}>
      <span className="text-[10px] font-medium text-zinc-400 uppercase">{label}</span>
      <span>{value ? value : <span className="text-zinc-400">—</span>}</span>
    </div>
  )
}
