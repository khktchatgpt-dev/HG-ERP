'use client'

import { useMemo, useState } from 'react'
import { Badge } from '@/components/Badge'
import { PageHeader } from '@/components/erp/PageHeader'
import { StatsBar } from '@/components/erp/StatsBar'
import { DataTable, type Column } from '@/components/erp/DataTable'
import { EmptyState } from '@/components/erp/EmptyState'

type Customer = {
  id: string
  code: string | null
  name: string
  email: string | null
  phone: string | null
  address: string | null
  notes: string | null
  owner_id: string | null
  owner_name: string | null
  owner_email: string | null
  tax_code: string | null
  country: string | null
  contact_person: string | null
  default_currency: string | null
  default_price_term: string | null
  default_payment_terms: string | null
  port_of_discharge: string | null
  fax: string | null
  representative_title: string | null
  fsc_cert: string | null
  is_active: boolean
  created_at: string
}

type QuoteRow = {
  id: string
  code: string
  status: string
  currency: string
  valid_from: string | null
  valid_to: string | null
  created_at: string
}

type OrderRow = {
  id: string
  code: string
  quote_code: string | null
  customer_po_no: string | null
  status: string
  currency: string
  due_date: string | null
  created_at: string
}

const QUOTE_STATUS: Record<string, { label: string; tone: 'gray' | 'green' }> = {
  draft: { label: 'Nháp', tone: 'gray' },
  sent: { label: 'Đã chốt', tone: 'green' },
}
const ORDER_STATUS: Record<
  string,
  { label: string; tone: 'gray' | 'blue' | 'amber' | 'green' | 'red' }
> = {
  confirmed: { label: 'Đã xác nhận', tone: 'blue' },
  lsx_pending: { label: 'Chờ duyệt LSX', tone: 'amber' },
  lsx_issued: { label: 'Đã phát LSX', tone: 'amber' },
  in_production: { label: 'Đang sản xuất', tone: 'amber' },
  completed: { label: 'Hoàn thành', tone: 'green' },
  delivered: { label: 'Đã giao', tone: 'green' },
  cancelled: { label: 'Đã huỷ', tone: 'red' },
}

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('vi-VN') : '—')

export function CustomerDetail({
  customer: c,
  quotes,
  orders,
}: {
  customer: Customer
  quotes: QuoteRow[]
  orders: OrderRow[]
}) {
  const [tab, setTab] = useState<'quotes' | 'orders'>('quotes')

  const today = new Date().toISOString().slice(0, 10)
  const stats = useMemo(() => {
    const openOrders = orders.filter(
      (o) => o.status !== 'delivered' && o.status !== 'cancelled',
    ).length
    const late = orders.filter(
      (o) =>
        o.due_date &&
        o.due_date < today &&
        o.status !== 'delivered' &&
        o.status !== 'cancelled',
    ).length
    const sentQuotes = quotes.filter((q) => q.status === 'sent').length
    return { openOrders, late, sentQuotes }
  }, [orders, quotes, today])

  const quoteCols: Column<QuoteRow>[] = [
    {
      key: 'code',
      header: 'Mã báo giá',
      sortValue: (q) => q.code,
      cell: (q) => (
        <a
          href={`/print/quotes/${q.id}`}
          target="_blank"
          rel="noopener"
          className="font-mono text-xs text-blue-600 hover:underline dark:text-blue-400"
        >
          {q.code}
        </a>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      width: '120px',
      sortValue: (q) => q.status,
      cell: (q) => {
        const s = QUOTE_STATUS[q.status] ?? { label: q.status, tone: 'gray' as const }
        return <Badge tone={s.tone}>{s.label}</Badge>
      },
    },
    { key: 'currency', header: 'Tiền tệ', width: '90px', cell: (q) => q.currency },
    {
      key: 'valid',
      header: 'Hiệu lực',
      width: '180px',
      cell: (q) =>
        q.valid_from || q.valid_to
          ? `${fmtDate(q.valid_from)} → ${fmtDate(q.valid_to)}`
          : '—',
    },
    {
      key: 'created_at',
      header: 'Lập ngày',
      width: '120px',
      sortValue: (q) => q.created_at,
      cell: (q) => fmtDate(q.created_at),
    },
  ]

  const orderCols: Column<OrderRow>[] = [
    {
      key: 'code',
      header: 'Mã đơn',
      sortValue: (o) => o.code,
      cell: (o) => (
        <div className="flex flex-col">
          <a
            href={`/sales/orders/${o.id}`}
            className="font-mono text-xs text-blue-600 hover:underline dark:text-blue-400"
          >
            {o.code}
          </a>
          {o.customer_po_no && (
            <span className="text-[11px] text-zinc-400">PO {o.customer_po_no}</span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      width: '130px',
      sortValue: (o) => o.status,
      cell: (o) => {
        const s = ORDER_STATUS[o.status] ?? { label: o.status, tone: 'gray' as const }
        return <Badge tone={s.tone}>{s.label}</Badge>
      },
    },
    {
      key: 'quote',
      header: 'Từ báo giá',
      width: '120px',
      cell: (o) =>
        o.quote_code ? (
          <span className="font-mono text-xs text-zinc-500">{o.quote_code}</span>
        ) : (
          <span className="text-xs text-zinc-400">Trực tiếp</span>
        ),
    },
    {
      key: 'due',
      header: 'Hạn giao',
      width: '120px',
      sortValue: (o) => o.due_date ?? '9999',
      cell: (o) => {
        const late =
          o.due_date &&
          o.due_date < today &&
          o.status !== 'delivered' &&
          o.status !== 'cancelled'
        return (
          <span className={late ? 'font-medium text-red-600' : ''}>
            {fmtDate(o.due_date)}
            {late && ' ⚠'}
          </span>
        )
      },
    },
    {
      key: 'created_at',
      header: 'Tạo ngày',
      width: '120px',
      sortValue: (o) => o.created_at,
      cell: (o) => fmtDate(o.created_at),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumbs={[
          { label: 'Kinh doanh', href: '/sales' },
          { label: 'Khách hàng', href: '/sales/customers' },
          { label: c.name },
        ]}
        title={c.name}
        description={c.code ? `Mã KH: ${c.code}` : undefined}
        meta={
          <>
            <Badge tone={c.is_active ? 'green' : 'gray'}>
              {c.is_active ? 'Đang giao dịch' : 'Ngừng giao dịch'}
            </Badge>
            {c.owner_name && <Badge tone="blue">Phụ trách: {c.owner_name}</Badge>}
            {c.country && <Badge tone="gray">{c.country}</Badge>}
          </>
        }
      />

      <StatsBar
        stats={[
          { label: 'Báo giá', value: quotes.length, tone: 'default' },
          { label: 'Đã chốt', value: stats.sentQuotes, tone: 'green' },
          { label: 'Đơn hàng', value: orders.length, tone: 'default' },
          {
            label: 'Đơn đang mở',
            value: stats.openOrders,
            tone: stats.openOrders ? 'amber' : 'gray',
          },
          {
            label: 'Trễ hạn',
            value: stats.late,
            tone: stats.late ? 'red' : 'gray',
          },
        ]}
      />

      {/* Thông tin liên hệ + điều khoản mặc định */}
      <div className="grid gap-4 lg:grid-cols-2">
        <InfoCard title="Liên hệ">
          <Field label="Người liên hệ" value={c.contact_person} />
          <Field label="Chức danh" value={c.representative_title} />
          <Field label="Email" value={c.email} />
          <Field label="Điện thoại" value={c.phone} />
          <Field label="Fax" value={c.fax} />
          <Field label="Địa chỉ" value={c.address} />
          <Field label="Quốc gia" value={c.country} />
          <Field label="Mã số thuế" value={c.tax_code} />
          <Field label="FSC Cert" value={c.fsc_cert} />
        </InfoCard>
        <InfoCard title="Điều khoản mặc định (auto-fill báo giá)">
          <Field label="Tiền tệ" value={c.default_currency} />
          <Field label="Điều kiện giá" value={c.default_price_term} />
          <Field label="Thanh toán" value={c.default_payment_terms} />
          <Field label="Cảng đích" value={c.port_of_discharge} />
          <Field label="Ghi chú" value={c.notes} />
        </InfoCard>
      </div>

      {/* Tabs lịch sử */}
      <div>
        <div className="mb-3 flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
          <TabBtn active={tab === 'quotes'} onClick={() => setTab('quotes')}>
            Báo giá ({quotes.length})
          </TabBtn>
          <TabBtn active={tab === 'orders'} onClick={() => setTab('orders')}>
            Đơn hàng ({orders.length})
          </TabBtn>
        </div>

        {tab === 'quotes' ? (
          <DataTable<QuoteRow>
            rows={quotes}
            columns={quoteCols}
            storageKey="customer-quotes"
            emptyState={
              <EmptyState
                icon="◷"
                title="Chưa có báo giá"
                description="Khách này chưa có báo giá nào."
              />
            }
          />
        ) : (
          <DataTable<OrderRow>
            rows={orders}
            columns={orderCols}
            storageKey="customer-orders"
            emptyState={
              <EmptyState
                icon="◷"
                title="Chưa có đơn hàng"
                description="Khách này chưa có đơn hàng nào."
              />
            }
          />
        )}
      </div>
    </div>
  )
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="mb-3 text-xs font-semibold tracking-wider text-zinc-500 uppercase">
        {title}
      </h2>
      <dl className="grid gap-2">{children}</dl>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-2 text-sm">
      <dt className="w-32 shrink-0 text-zinc-500">{label}</dt>
      <dd className="min-w-0 flex-1 break-words">
        {value ? value : <span className="text-zinc-400">—</span>}
      </dd>
    </div>
  )
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
        active
          ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
          : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
      }`}
    >
      {children}
    </button>
  )
}
