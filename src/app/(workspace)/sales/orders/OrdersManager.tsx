'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/Badge'
import { PageHeader } from '@/components/erp/PageHeader'
import { StatsBar } from '@/components/erp/StatsBar'
import { Toolbar, ToolbarInput, ToolbarSelect } from '@/components/erp/Toolbar'
import { DataTable, type Column } from '@/components/erp/DataTable'
import { EmptyState } from '@/components/erp/EmptyState'

type OrderStatus =
  | 'confirmed'
  | 'lsx_pending'
  | 'lsx_issued'
  | 'in_production'
  | 'completed'
  | 'delivered'
  | 'cancelled'

type Order = {
  id: string
  code: string
  quote_code: string | null
  customer_id: string
  customer_name: string
  customer_po_no: string | null
  status: OrderStatus
  due_date: string | null
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

export function OrdersManager({
  orders,
  customers,
  canEdit,
}: {
  orders: Order[]
  customers: { id: string; name: string }[]
  canEdit: boolean
}) {
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

  const columns: Column<Order>[] = [
    {
      key: 'code',
      header: 'Số đơn / Khách hàng',
      sortValue: (o) => o.code,
      cell: (o) => (
        <Link
          href={`/sales/orders/${o.id}`}
          className="flex min-w-0 flex-col hover:text-sky-600 dark:hover:text-sky-400"
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
        </Link>
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
      width: '90px',
      align: 'right',
      cell: (o) => (
        <Link
          href={`/sales/orders/${o.id}`}
          className="text-xs text-sky-600 hover:underline dark:text-sky-400"
        >
          Chi tiết →
        </Link>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumbs={[{ label: 'Kinh doanh', href: '/sales' }, { label: 'Đơn hàng' }]}
        title="Đơn hàng bán"
        description={`${filtered.length} / ${orders.length} đơn. Bấm vào đơn để xem chi tiết, sửa, phát LSX và đính kèm file.`}
        actions={
          canEdit && (
            <Link
              href="/sales/orders/new"
              className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700"
            >
              + Tạo đơn hàng
            </Link>
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
                  ? 'Đơn hàng do Sales tự tạo — từ báo giá đã chốt hoặc trực tiếp.'
                  : 'Thử điều chỉnh bộ lọc.'
              }
              action={
                canEdit && orders.length === 0 ? (
                  <Link
                    href="/sales/orders/new"
                    className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700"
                  >
                    + Tạo đơn hàng
                  </Link>
                ) : undefined
              }
            />
          }
        />
      </div>
    </div>
  )
}
