'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/Badge'
import { Modal } from '@/components/Modal'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { api, ApiError } from '@/lib/api'
import { PageHeader } from '@/components/erp/PageHeader'
import { StatsBar } from '@/components/erp/StatsBar'
import { Toolbar, ToolbarInput, ToolbarSelect } from '@/components/erp/Toolbar'
import { DataTable, type Column } from '@/components/erp/DataTable'
import { EmptyState } from '@/components/erp/EmptyState'
import { RowMenu } from '@/components/erp/RowMenu'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'

type OrderStatus =
  'confirmed' | 'lsx_issued' | 'in_production' | 'completed' | 'delivered' | 'cancelled'

type Order = {
  id: string
  code: string
  quote_code: string | null
  customer_id: string
  customer_name: string
  customer_po_no: string | null
  status: OrderStatus
  currency: string
  due_date: string | null
  deposit_percent: number | null
  price_term: string | null
  payment_terms: string | null
  container_summary: string | null
  note: string | null
  created_at: string
}

type OrderLine = {
  product_id: string
  qty: number
  unit_price: number
  note: string | null
  product_code: string
  product_name: string
  product_unit: string
  customer_item_code: string | null
  bom_status: 'none' | 'drawing' | 'done'
}

type OrderChange = {
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

type QuoteOption = { id: string; code: string; customer_name: string; currency: string }
type CustomerOption = { id: string; name: string }
type ProductOption = {
  id: string
  code: string
  name: string
  unit: string
  customer_id: string | null
  customer_item_code: string | null
  bom_status: 'none' | 'drawing' | 'done'
}
type LineRow = {
  product_id: string
  qty: number | ''
  unit_price: number | ''
  note: string
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  confirmed: 'Đã xác nhận',
  lsx_issued: 'Đã phát LSX',
  in_production: 'Đang sản xuất',
  completed: 'Hoàn thành',
  delivered: 'Đã giao',
  cancelled: 'Đã huỷ',
}
const STATUS_TONE: Record<OrderStatus, 'gray' | 'blue' | 'amber' | 'green' | 'red'> = {
  confirmed: 'blue',
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
}

export function OrdersManager({
  orders,
  approvedQuotes,
  customers,
  products,
  canEdit,
}: {
  orders: Order[]
  approvedQuotes: QuoteOption[]
  customers: CustomerOption[]
  products: ProductOption[]
  canEdit: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)
  const [openCreate, setOpenCreate] = useState(false)
  const [viewing, setViewing] = useState<{
    order: Order
    lines: OrderLine[]
    changes: OrderChange[]
  } | null>(null)
  const [editing, setEditing] = useState<{ order: Order; lines: LineRow[] } | null>(null)

  const [q, setQ] = useState('')
  const [customerFilter, setCustomerFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all')

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return orders.filter((o) => {
      if (customerFilter !== 'all' && o.customer_id !== customerFilter) return false
      if (statusFilter !== 'all' && o.status !== statusFilter) return false
      if (
        ql &&
        !`${o.code} ${o.customer_name} ${o.customer_po_no ?? ''}`
          .toLowerCase()
          .includes(ql)
      )
        return false
      return true
    })
  }, [orders, q, customerFilter, statusFilter])

  const stats = useMemo(() => {
    let open = 0
    let production = 0
    let done = 0
    let late = 0
    const today = new Date().toISOString().slice(0, 10)
    for (const o of orders) {
      if (o.status === 'confirmed' || o.status === 'lsx_issued') open++
      if (o.status === 'in_production') production++
      if (o.status === 'completed' || o.status === 'delivered') done++
      if (
        o.due_date &&
        o.due_date < today &&
        o.status !== 'delivered' &&
        o.status !== 'cancelled'
      )
        late++
    }
    return { open, production, done, late }
  }, [orders])

  async function send(url: string, method: 'POST' | 'PATCH', body?: unknown) {
    setBusy(true)
    try {
      await api(url, { method, body })
      router.refresh()
      return true
    } catch (e) {
      toast.error('Thao tác thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function openView(order: Order) {
    setBusy(true)
    try {
      const data = await api<{ lines: OrderLine[]; changes: OrderChange[] }>(
        `/api/dept/sales/orders/${order.id}`,
      )
      setViewing({ order, lines: data.lines, changes: data.changes })
    } catch (e) {
      toast.error('Không tải được đơn hàng', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  async function openEdit(order: Order) {
    setBusy(true)
    try {
      const data = await api<{ lines: OrderLine[] }>(`/api/dept/sales/orders/${order.id}`)
      setEditing({
        order,
        lines: data.lines.map((l) => ({
          product_id: l.product_id,
          qty: l.qty,
          unit_price: l.unit_price,
          note: l.note ?? '',
        })),
      })
    } catch (e) {
      toast.error('Không tải được đơn hàng', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  async function cancelOrder(order: Order) {
    const reason = window.prompt(`Lý do huỷ đơn ${order.code}:`)?.trim()
    if (!reason) return
    const ok = await confirm({
      title: `Huỷ đơn ${order.code}?`,
      description: 'Đơn đã huỷ không khôi phục được.',
      tone: 'danger',
      confirmLabel: 'Huỷ đơn',
    })
    if (!ok) return
    const ok2 = await send(`/api/dept/sales/orders/${order.id}/cancel`, 'POST', {
      reason,
    })
    if (ok2) {
      toast.success('Đã huỷ đơn', order.code)
      setViewing(null)
    }
  }

  const editable = (o: Order) => o.status !== 'delivered' && o.status !== 'cancelled'

  const columns: Column<Order>[] = [
    {
      key: 'code',
      header: 'Số đơn / Khách hàng',
      sortValue: (o) => o.code,
      cell: (o) => (
        <button
          onClick={() => void openView(o)}
          className="flex min-w-0 flex-col text-left hover:text-sky-600 dark:hover:text-sky-400"
        >
          <span className="font-mono text-xs text-zinc-400">
            {o.code}
            {o.customer_po_no && (
              <span className="ml-1 text-sky-600 dark:text-sky-400">
                · PO: {o.customer_po_no}
              </span>
            )}
          </span>
          <span className="truncate font-medium">{o.customer_name}</span>
        </button>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      sortValue: (o) => o.status,
      width: '130px',
      cell: (o) => <Badge tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge>,
    },
    {
      key: 'due',
      header: 'Hạn giao',
      sortValue: (o) => o.due_date ?? '9999',
      width: '110px',
      cell: (o) => {
        if (!o.due_date) return <span className="text-zinc-400">—</span>
        const late =
          o.due_date < new Date().toISOString().slice(0, 10) &&
          o.status !== 'delivered' &&
          o.status !== 'cancelled'
        return (
          <span className={late ? 'font-medium text-red-600' : ''}>
            {new Date(o.due_date).toLocaleDateString('vi-VN')}
            {late && ' ⚠'}
          </span>
        )
      },
    },
    {
      key: 'quote',
      header: 'Từ BG',
      width: '120px',
      cell: (o) =>
        o.quote_code ? (
          <span className="font-mono text-xs text-zinc-500">{o.quote_code}</span>
        ) : (
          <span className="text-zinc-400">—</span>
        ),
    },
    {
      key: 'created',
      header: 'Ngày tạo',
      sortValue: (o) => o.created_at,
      width: '110px',
      cell: (o) => new Date(o.created_at).toLocaleDateString('vi-VN'),
    },
    {
      key: 'actions',
      header: '',
      width: '56px',
      align: 'right',
      cell: (o) => {
        const items: { label: string; onClick: () => void; danger?: boolean }[] = [
          { label: 'Xem chi tiết', onClick: () => void openView(o) },
        ]
        if (canEdit && editable(o)) {
          items.push(
            { label: 'Sửa (khách thay đổi)', onClick: () => void openEdit(o) },
            { label: 'Huỷ đơn', onClick: () => void cancelOrder(o), danger: true },
          )
        }
        return <RowMenu items={items} />
      },
    },
  ]

  const btnPrimary =
    'rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700'

  return (
    <div className="flex flex-col gap-4">
      <TopProgressBar active={busy} />
      <PageHeader
        breadcrumbs={[{ label: 'Kinh doanh', href: '/sales' }, { label: 'Đơn hàng' }]}
        title="Đơn hàng bán"
        description={`${filtered.length} / ${orders.length} đơn. Tạo từ báo giá đã duyệt — mỗi đơn phát đúng 1 LSX.`}
        actions={
          canEdit && (
            <button onClick={() => setOpenCreate(true)} className={btnPrimary}>
              + Tạo đơn từ báo giá
            </button>
          )
        }
      />

      <StatsBar
        stats={[
          { label: 'Tổng đơn', value: orders.length, tone: 'default' },
          { label: 'Chờ sản xuất', value: stats.open, tone: 'blue' },
          { label: 'Đang sản xuất', value: stats.production, tone: 'amber' },
          { label: 'Hoàn thành/giao', value: stats.done, tone: 'green' },
          { label: 'Trễ hạn', value: stats.late, tone: stats.late ? 'red' : 'gray' },
        ]}
      />

      <div>
        <Toolbar
          left={
            <>
              <ToolbarInput
                value={q}
                onChange={setQ}
                placeholder="Tìm số đơn, PO khách, khách hàng…"
                icon="⌕"
                className="w-72"
              />
              <ToolbarSelect
                value={customerFilter}
                onChange={setCustomerFilter}
                options={[
                  { value: 'all', label: 'Mọi khách hàng' },
                  ...customers.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
              <ToolbarSelect
                value={statusFilter}
                onChange={(v) => setStatusFilter(v)}
                options={[
                  { value: 'all' as const, label: 'Mọi trạng thái' },
                  ...(Object.keys(STATUS_LABEL) as OrderStatus[]).map((s) => ({
                    value: s,
                    label: STATUS_LABEL[s],
                  })),
                ]}
              />
            </>
          }
          right={
            busy ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
                <Spinner size={12} /> Đang xử lý…
              </span>
            ) : undefined
          }
        />

        <DataTable<Order>
          rows={filtered}
          columns={columns}
          storageKey="sales-orders"
          rowClassName={(o) => (o.status === 'cancelled' ? 'opacity-60' : '')}
          emptyState={
            <EmptyState
              icon="◫"
              title={orders.length === 0 ? 'Chưa có đơn hàng nào' : 'Không khớp bộ lọc'}
              description={
                orders.length === 0
                  ? 'Đơn hàng được tạo từ báo giá đã được Giám đốc duyệt (BR-04).'
                  : 'Thử điều chỉnh bộ lọc.'
              }
              action={
                canEdit && orders.length === 0 && approvedQuotes.length > 0 ? (
                  <button onClick={() => setOpenCreate(true)} className={btnPrimary}>
                    + Tạo đơn từ báo giá
                  </button>
                ) : undefined
              }
            />
          }
        />
      </div>

      {/* Create from approved quote */}
      <Modal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        title="Tạo đơn hàng từ báo giá đã duyệt"
      >
        <CreateOrderForm
          approvedQuotes={approvedQuotes}
          onSubmit={async (body) => {
            const ok = await send('/api/dept/sales/orders', 'POST', body)
            if (ok) {
              setOpenCreate(false)
              toast.success('Đã tạo đơn hàng')
            }
          }}
        />
      </Modal>

      {/* Edit (khách thay đổi) */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `Khách thay đổi — ${editing.order.code}` : ''}
        maxWidth="sm:max-w-3xl"
      >
        {editing && (
          <EditOrderForm
            order={editing.order}
            initialLines={editing.lines}
            products={products}
            onSubmit={async (body) => {
              const ok = await send(
                `/api/dept/sales/orders/${editing.order.id}`,
                'PATCH',
                body,
              )
              if (ok) {
                setEditing(null)
                toast.success('Đã cập nhật + ghi lịch sử', editing.order.code)
              }
            }}
          />
        )}
      </Modal>

      {/* Detail */}
      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing ? `${viewing.order.code} — ${viewing.order.customer_name}` : ''}
        maxWidth="sm:max-w-3xl"
      >
        {viewing && (
          <OrderDetail
            order={viewing.order}
            lines={viewing.lines}
            changes={viewing.changes}
            canEdit={canEdit && editable(viewing.order)}
            onEdit={() => {
              const v = viewing
              setViewing(null)
              void openEdit(v.order)
            }}
            onCancel={() => void cancelOrder(viewing.order)}
          />
        )}
      </Modal>
    </div>
  )
}

// ── Create form ──────────────────────────────────────────────────────────

function CreateOrderForm({
  approvedQuotes,
  onSubmit,
}: {
  approvedQuotes: QuoteOption[]
  onSubmit: (body: Record<string, unknown>) => Promise<void> | void
}) {
  const [busy, setBusy] = useState(false)
  const cls =
    'w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'

  async function handle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const body: Record<string, unknown> = {
      quote_id: String(fd.get('quote_id') ?? ''),
      customer_po_no: String(fd.get('customer_po_no') ?? '').trim() || null,
      due_date: String(fd.get('due_date') ?? '') || null,
      deposit_percent: String(fd.get('deposit_percent') ?? '').trim()
        ? Number(fd.get('deposit_percent'))
        : null,
      container_summary: String(fd.get('container_summary') ?? '').trim() || null,
      note: String(fd.get('note') ?? '').trim() || null,
    }
    setBusy(true)
    await onSubmit(body)
    setBusy(false)
  }

  if (approvedQuotes.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-zinc-500">
        Chưa có báo giá nào được duyệt. Gửi báo giá lên Giám đốc duyệt trước (BR-04).
      </p>
    )
  }

  return (
    <form onSubmit={handle} className="grid gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        Báo giá đã duyệt <span className="text-red-500">*</span>
        <select name="quote_id" required className={cls}>
          <option value="">— chọn báo giá —</option>
          {approvedQuotes.map((qt) => (
            <option key={qt.id} value={qt.id}>
              {qt.code} — {qt.customer_name} ({qt.currency})
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Số PO của khách
        <input
          name="customer_po_no"
          maxLength={100}
          placeholder="31032191120"
          className={`${cls} font-mono`}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Hạn giao
        <input name="due_date" type="date" className={cls} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        % Cọc (deposit)
        <input
          name="deposit_percent"
          type="number"
          min="0"
          max="100"
          step="0.01"
          placeholder="20"
          className={cls}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Container
        <input
          name="container_summary"
          maxLength={100}
          placeholder="1 x 40'HC"
          className={cls}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        Ghi chú
        <textarea name="note" rows={2} maxLength={2000} className={cls} />
      </label>
      <p className="text-xs text-zinc-500 sm:col-span-2">
        Dòng sản phẩm + đơn giá được copy nguyên từ báo giá; điều kiện giá & thanh toán
        giữ theo báo giá. Sau khi tạo, mọi thay đổi đều được ghi lịch sử.
      </p>
      <div className="flex justify-end sm:col-span-2">
        <button
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {busy && <Spinner size={14} />}
          {busy ? 'Đang tạo…' : 'Tạo đơn hàng'}
        </button>
      </div>
    </form>
  )
}

// ── Edit form (khách thay đổi — FR-SAL-05) ───────────────────────────────

function EditOrderForm({
  order,
  initialLines,
  products,
  onSubmit,
}: {
  order: Order
  initialLines: LineRow[]
  products: ProductOption[]
  onSubmit: (body: Record<string, unknown>) => Promise<void> | void
}) {
  const [busy, setBusy] = useState(false)
  const [lines, setLines] = useState<LineRow[]>(initialLines)
  const cls =
    'w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'

  const productChoices = useMemo(() => {
    const own = products.filter((p) => p.customer_id === order.customer_id)
    const common = products.filter((p) => !p.customer_id)
    const others = products.filter(
      (p) => p.customer_id && p.customer_id !== order.customer_id,
    )
    return { own, common, others }
  }, [products, order.customer_id])

  const usedIds = new Set(lines.map((l) => l.product_id))
  const invalid =
    lines.length === 0 ||
    lines.length !== usedIds.size ||
    lines.some(
      (l) => !l.product_id || l.qty === '' || Number(l.qty) <= 0 || l.unit_price === '',
    )

  function setLine(i: number, patch: Partial<LineRow>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }

  function renderOption(p: ProductOption) {
    return (
      <option key={p.id} value={p.id} disabled={usedIds.has(p.id)}>
        {p.code} — {p.name}
      </option>
    )
  }

  async function handle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const body: Record<string, unknown> = {
      customer_po_no: String(fd.get('customer_po_no') ?? '').trim() || null,
      due_date: String(fd.get('due_date') ?? '') || null,
      deposit_percent: String(fd.get('deposit_percent') ?? '').trim()
        ? Number(fd.get('deposit_percent'))
        : null,
      container_summary: String(fd.get('container_summary') ?? '').trim() || null,
      note: String(fd.get('note') ?? '').trim() || null,
      change_note: String(fd.get('change_note') ?? '').trim() || null,
      lines: lines.map((l) => ({
        product_id: l.product_id,
        qty: Number(l.qty),
        unit_price: Number(l.unit_price),
        note: l.note.trim() || null,
      })),
    }
    setBusy(true)
    await onSubmit(body)
    setBusy(false)
  }

  return (
    <form onSubmit={handle} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Số PO của khách
          <input
            name="customer_po_no"
            maxLength={100}
            defaultValue={order.customer_po_no ?? ''}
            className={`${cls} font-mono`}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Hạn giao
          <input
            name="due_date"
            type="date"
            defaultValue={order.due_date ?? ''}
            className={cls}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          % Cọc
          <input
            name="deposit_percent"
            type="number"
            min="0"
            max="100"
            step="0.01"
            defaultValue={order.deposit_percent ?? ''}
            className={cls}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Container
          <input
            name="container_summary"
            maxLength={100}
            defaultValue={order.container_summary ?? ''}
            className={cls}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          Ghi chú đơn
          <textarea
            name="note"
            rows={2}
            maxLength={2000}
            defaultValue={order.note ?? ''}
            className={cls}
          />
        </label>
      </div>

      <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
        <div className="mb-2 text-xs font-semibold text-zinc-500 uppercase">
          Dòng sản phẩm ({lines.length})
        </div>
        <div className="flex flex-col gap-2">
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-12 items-center gap-2">
              <select
                value={l.product_id}
                onChange={(e) => setLine(i, { product_id: e.target.value })}
                className={`${cls} col-span-5`}
              >
                <option value="">— chọn SP —</option>
                {productChoices.own.length > 0 && (
                  <optgroup label="SP của khách này">
                    {productChoices.own.map(renderOption)}
                  </optgroup>
                )}
                {productChoices.common.length > 0 && (
                  <optgroup label="Mẫu chung">
                    {productChoices.common.map(renderOption)}
                  </optgroup>
                )}
                {productChoices.others.length > 0 && (
                  <optgroup label="SP khách khác">
                    {productChoices.others.map(renderOption)}
                  </optgroup>
                )}
              </select>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="SL"
                value={l.qty}
                onChange={(e) =>
                  setLine(i, { qty: e.target.value === '' ? '' : Number(e.target.value) })
                }
                className={`${cls} col-span-2`}
              />
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Đơn giá"
                value={l.unit_price}
                onChange={(e) =>
                  setLine(i, {
                    unit_price: e.target.value === '' ? '' : Number(e.target.value),
                  })
                }
                className={`${cls} col-span-2`}
              />
              <input
                placeholder="Ghi chú"
                value={l.note}
                maxLength={500}
                onChange={(e) => setLine(i, { note: e.target.value })}
                className={`${cls} col-span-2`}
              />
              <button
                type="button"
                onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}
                className="col-span-1 rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                aria-label="Xoá dòng"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            setLines((ls) => [
              ...ls,
              { product_id: '', qty: '', unit_price: '', note: '' },
            ])
          }
          className="mt-2 rounded-md border border-dashed border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:border-sky-400 hover:text-sky-600 dark:border-zinc-700 dark:text-zinc-400"
        >
          + Thêm dòng
        </button>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Lý do thay đổi (khách yêu cầu gì?)
        <input
          name="change_note"
          maxLength={1000}
          placeholder="vd: khách tăng SL ghế từ 48 → 60, đổi màu nệm"
          className={cls}
        />
      </label>

      <div className="flex justify-end">
        <button
          disabled={busy || invalid}
          className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {busy && <Spinner size={14} />}
          {busy ? 'Đang lưu…' : 'Lưu + ghi lịch sử'}
        </button>
      </div>
    </form>
  )
}

// ── Detail ───────────────────────────────────────────────────────────────

function OrderDetail({
  order,
  lines,
  changes,
  canEdit,
  onEdit,
  onCancel,
}: {
  order: Order
  lines: OrderLine[]
  changes: OrderChange[]
  canEdit: boolean
  onEdit: () => void
  onCancel: () => void
}) {
  const total = lines.reduce((s, l) => s + l.qty * l.unit_price, 0)
  const bomPending = lines.filter((l) => l.bom_status !== 'done').length
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={STATUS_TONE[order.status]}>{STATUS_LABEL[order.status]}</Badge>
        {order.customer_po_no && <Badge>PO: {order.customer_po_no}</Badge>}
        {order.deposit_percent != null && <Badge>Cọc {order.deposit_percent}%</Badge>}
        {order.container_summary && <Badge>{order.container_summary}</Badge>}
        {order.due_date && (
          <span className="text-xs text-zinc-500">
            Hạn giao: {new Date(order.due_date).toLocaleDateString('vi-VN')}
          </span>
        )}
      </div>

      {bomPending > 0 && (
        <div className="rounded-md bg-amber-50 p-2 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">
          ⚠ {bomPending} dòng SP chưa xong BOM — phát LSX vẫn được (BR-07) nhưng Cung ứng
          sẽ thiếu định mức để đặt vật tư.
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 uppercase dark:border-zinc-800">
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
                  <div className="flex flex-col">
                    <span className="font-mono text-xs text-zinc-400">
                      {l.product_code}
                      {l.customer_item_code && ` · KH: ${l.customer_item_code}`}
                    </span>
                    <span>{l.product_name}</span>
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
              <td colSpan={4} className="py-2 pr-2 text-right font-semibold">
                Tổng cộng
              </td>
              <td className="py-2 text-right font-bold">
                {total.toLocaleString('en-US')} {order.currency}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Lịch sử thay đổi (FR-SAL-05) */}
      <div className="rounded-md bg-zinc-50 p-3 dark:bg-zinc-900">
        <div className="mb-2 text-xs font-semibold text-zinc-500 uppercase">
          Lịch sử thay đổi ({changes.length})
        </div>
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
                    Danh sách sản phẩm thay đổi (xem chi tiết trong dữ liệu)
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {canEdit && (
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
          >
            Huỷ đơn
          </button>
          <button
            onClick={onEdit}
            className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700"
          >
            Khách thay đổi — sửa đơn
          </button>
        </div>
      )}
    </div>
  )
}
