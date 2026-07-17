'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/Badge'
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

type QuoteStatus = 'draft' | 'sent'

type Quote = {
  id: string
  code: string
  customer_id: string
  customer_name: string
  status: QuoteStatus
  currency: string
  valid_from: string | null
  valid_to: string | null
  price_term: string | null
  payment_terms: string | null
  note: string | null
  created_at: string
}

type CustomerOption = { id: string; name: string }

const STATUS_LABEL: Record<QuoteStatus, string> = { draft: 'Nháp', sent: 'Đã gửi khách' }
const STATUS_TONE: Record<QuoteStatus, 'gray' | 'green'> = {
  draft: 'gray',
  sent: 'green',
}

export function QuotesManager({
  quotes,
  customers,
  canEdit,
}: {
  quotes: Quote[]
  customers: CustomerOption[]
  canEdit: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)

  const [q, setQ] = useState('')
  const [customerFilter, setCustomerFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | QuoteStatus>('all')

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return quotes.filter((it) => {
      if (customerFilter !== 'all' && it.customer_id !== customerFilter) return false
      if (statusFilter !== 'all' && it.status !== statusFilter) return false
      if (ql && !`${it.code} ${it.customer_name}`.toLowerCase().includes(ql)) return false
      return true
    })
  }, [quotes, q, customerFilter, statusFilter])

  const stats = useMemo(() => {
    const by: Record<QuoteStatus, number> = { draft: 0, sent: 0 }
    for (const it of quotes) by[it.status]++
    return by
  }, [quotes])

  async function run(url: string, method: 'POST' | 'DELETE') {
    setBusy(true)
    try {
      await api(url, { method })
      router.refresh()
      return true
    } catch (e) {
      toast.error('Thao tác thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function sendQuote(it: Quote) {
    const ok = await confirm({
      title: `Chốt & gửi khách ${it.code}?`,
      description: 'Sau khi chốt sẽ không sửa được nữa và có thể tạo đơn hàng.',
      confirmLabel: 'Chốt & gửi khách',
    })
    if (!ok) return
    if (await run(`/api/dept/sales/quotes/${it.id}/send`, 'POST'))
      toast.success('Đã chốt báo giá', it.code)
  }

  async function deleteQuote(it: Quote) {
    const ok = await confirm({
      title: `Xoá báo giá nháp ${it.code}?`,
      tone: 'danger',
      confirmLabel: 'Xoá',
    })
    if (!ok) return
    if (await run(`/api/dept/sales/quotes/${it.id}`, 'DELETE'))
      toast.success('Đã xoá', it.code)
  }

  const columns: Column<Quote>[] = [
    {
      key: 'code',
      header: 'Số BG / Khách hàng',
      sortValue: (it) => it.code,
      cell: (it) => (
        <Link
          href={`/sales/quotes/${it.id}`}
          className="flex min-w-0 flex-col text-left hover:text-sky-600 dark:hover:text-sky-400"
        >
          <span className="font-mono text-xs text-zinc-400">{it.code}</span>
          <span className="truncate font-medium">{it.customer_name}</span>
        </Link>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      sortValue: (it) => it.status,
      width: '110px',
      cell: (it) => (
        <Badge tone={STATUS_TONE[it.status]}>{STATUS_LABEL[it.status]}</Badge>
      ),
    },
    {
      key: 'currency',
      header: 'Tiền tệ',
      width: '80px',
      cell: (it) => <span className="font-mono text-xs">{it.currency}</span>,
    },
    {
      key: 'valid',
      header: 'Hiệu lực đến',
      sortValue: (it) => it.valid_to ?? '',
      width: '120px',
      cell: (it) =>
        it.valid_to ? (
          new Date(it.valid_to).toLocaleDateString('vi-VN')
        ) : (
          <span className="text-zinc-400">—</span>
        ),
    },
    {
      key: 'created',
      header: 'Ngày tạo',
      sortValue: (it) => it.created_at,
      width: '110px',
      cell: (it) => new Date(it.created_at).toLocaleDateString('vi-VN'),
    },
    {
      key: 'actions',
      header: '',
      width: '56px',
      align: 'right',
      cell: (it) => {
        const items: { label: string; onClick: () => void; danger?: boolean }[] = [
          { label: 'Xem chi tiết', onClick: () => router.push(`/sales/quotes/${it.id}`) },
        ]
        if (canEdit && it.status === 'draft') {
          items.push(
            {
              label: 'Sửa',
              onClick: () => router.push(`/sales/quotes/${it.id}/edit`),
            },
            { label: 'Chốt & gửi khách', onClick: () => void sendQuote(it) },
            { label: 'Xoá', onClick: () => void deleteQuote(it), danger: true },
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
        breadcrumbs={[{ label: 'Kinh doanh', href: '/sales' }, { label: 'Báo giá' }]}
        title="Báo giá"
        description={`${filtered.length} / ${quotes.length} báo giá. Nháp → chốt & gửi khách → tạo đơn hàng. Hồ sơ riêng của Sales, không cần duyệt.`}
        actions={
          canEdit && (
            <Link href="/sales/quotes/new" className={btnPrimary}>
              + Lập báo giá
            </Link>
          )
        }
      />

      <StatsBar
        stats={[
          { label: 'Tổng', value: quotes.length, tone: 'default' },
          { label: 'Nháp', value: stats.draft, tone: 'gray' },
          { label: 'Đã gửi khách', value: stats.sent, tone: 'green' },
        ]}
      />

      <div>
        <Toolbar
          left={
            <>
              <ToolbarInput
                value={q}
                onChange={setQ}
                placeholder="Tìm số BG, khách hàng…"
                icon="⌕"
                className="w-64"
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
                  { value: 'draft' as const, label: 'Nháp' },
                  { value: 'sent' as const, label: 'Đã gửi khách' },
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

        <DataTable<Quote>
          rows={filtered}
          columns={columns}
          storageKey="sales-quotes"
          emptyState={
            <EmptyState
              icon="▤"
              title={quotes.length === 0 ? 'Chưa có báo giá nào' : 'Không khớp bộ lọc'}
              description={
                quotes.length === 0
                  ? 'Lập báo giá đầu tiên — chọn khách và các sản phẩm từ thư viện Kỹ thuật.'
                  : 'Thử điều chỉnh bộ lọc.'
              }
              action={
                canEdit && quotes.length === 0 ? (
                  <Link href="/sales/quotes/new" className={btnPrimary}>
                    + Lập báo giá
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
