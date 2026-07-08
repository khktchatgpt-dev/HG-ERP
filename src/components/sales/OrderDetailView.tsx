'use client'

import { useState } from 'react'
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
  container_summary: string | null
  note: string | null
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

export function OrderDetailView({
  order,
  lines,
  changes,
  canEdit,
  canIssue,
  lsx,
}: {
  order: OrderView
  lines: LineView[]
  changes: ChangeView[]
  canEdit: boolean
  canIssue: boolean
  lsx: { id: string; code: string; status: string } | null
}) {
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)
  const [issuing, setIssuing] = useState(false)
  const [lsxCode, setLsxCode] = useState('')
  const [shipDate, setShipDate] = useState(order.due_date ?? '')
  const [container, setContainer] = useState(order.container_summary ?? '')

  const editable = order.status !== 'delivered' && order.status !== 'cancelled'
  const total = lines.reduce((s, l) => s + l.qty * l.unit_price, 0)
  const totalQty = lines.reduce((s, l) => s + l.qty, 0)
  const bomPending = lines.filter((l) => l.bom_status !== 'done').length

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

  async function cancelOrder() {
    const reason = window.prompt(`Lý do huỷ đơn ${order.code}:`)?.trim()
    if (!reason) return
    const ok = await confirm({
      title: `Huỷ đơn ${order.code}?`,
      description: 'Đơn đã huỷ không khôi phục được.',
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

  return (
    <div className="flex flex-col gap-5">
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

      {/* Thông tin đơn (tối giản) */}
      <Card title="Thông tin đơn">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-4">
          <Info label="Khách hàng" value={order.customer_name} />
          <Info label="Tiền tệ" value={order.currency} />
          <Info label="Từ báo giá" value={order.quote_code ?? 'Trực tiếp'} />
          <Info label="PO khách" value={order.customer_po_no} />
          <Info label="Hạn giao" value={fmtD(order.due_date)} />
          <Info label="Container" value={order.container_summary} />
          <Info label="Ngày tạo" value={fmtD(order.created_at)} />
        </div>
        {order.note && (
          <div className="mt-3 border-t border-zinc-200 pt-3 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
            <span className="font-medium">Ghi chú: </span>
            {order.note}
          </div>
        )}
      </Card>

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
                      {l.note && <span className="text-xs text-zinc-500">{l.note}</span>}
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

      {/* File hợp đồng / chứng từ */}
      <Card title="File hợp đồng / chứng từ đơn">
        <DocumentFiles
          kind="sales_order"
          id={order.id}
          canEdit={canEdit}
          title="File đính kèm"
        />
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
                      : 'Bị từ chối'}
            </Badge>
            <Link
              href={`/sales/lsx/${lsx.id}`}
              className="ml-auto rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700"
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
              <div className="flex justify-end gap-2">
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

      {/* Lịch sử thay đổi */}
      <Card title={`Lịch sử thay đổi (${changes.length})`}>
        {changes.length === 0 ? (
          <p className="text-xs text-zinc-400">Chưa có thay đổi nào từ khi tạo đơn.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {changes.map((c) => (
              <li
                key={c.id}
                className="border-l-2 border-zinc-300 pl-2 text-xs dark:border-zinc-700"
              >
                <div className="text-zinc-500">
                  {new Date(c.created_at).toLocaleString('vi-VN')} —{' '}
                  {c.changed_by_name ?? 'Hệ thống'}
                  {c.note && <span className="italic"> · {c.note}</span>}
                </div>
                {c.change.fields && (
                  <ul className="mt-0.5 text-zinc-600 dark:text-zinc-400">
                    {Object.entries(c.change.fields).map(([f, v]) => (
                      <li key={f}>
                        {FIELD_LABEL[f] ?? f}: <s>{String(v.from ?? '—')}</s> →{' '}
                        <b>{String(v.to ?? '—')}</b>
                      </li>
                    ))}
                  </ul>
                )}
                {c.change.lines != null && (
                  <div className="mt-0.5 text-zinc-600 dark:text-zinc-400">
                    Danh sách sản phẩm được thay đổi.
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {canEdit && editable && (
        <div className="flex justify-end pb-6">
          <button
            onClick={() => void cancelOrder()}
            className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
          >
            Huỷ đơn
          </button>
        </div>
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

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-medium text-zinc-400 uppercase">{label}</span>
      <span>{value ? value : <span className="text-zinc-400">—</span>}</span>
    </div>
  )
}
