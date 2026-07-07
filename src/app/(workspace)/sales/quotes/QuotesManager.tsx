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

type QuoteStatus = 'draft' | 'pending' | 'approved' | 'rejected'

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
  rejected_reason: string | null
  created_at: string
}

type QuoteLine = {
  product_id: string
  qty: number
  unit_price: number
  note: string | null
  product_code?: string
  product_name?: string
  product_unit?: string
  customer_item_code?: string | null
}

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

/** Dòng đang biên tập trong form. */
type LineRow = {
  product_id: string
  qty: number | ''
  unit_price: number | ''
  note: string
}

const STATUS_LABEL: Record<QuoteStatus, string> = {
  draft: 'Nháp',
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
}
const STATUS_TONE: Record<QuoteStatus, 'gray' | 'amber' | 'green' | 'red'> = {
  draft: 'gray',
  pending: 'amber',
  approved: 'green',
  rejected: 'red',
}

function fmtMoney(n: number, currency: string): string {
  return `${n.toLocaleString(currency === 'VND' ? 'vi-VN' : 'en-US')} ${currency}`
}

export function QuotesManager({
  quotes,
  customers,
  products,
  canEdit,
  canApprove,
}: {
  quotes: Quote[]
  customers: CustomerOption[]
  products: ProductOption[]
  canEdit: boolean
  canApprove: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)
  const [openCreate, setOpenCreate] = useState(false)
  const [editing, setEditing] = useState<{ quote: Quote; lines: LineRow[] } | null>(null)
  const [viewing, setViewing] = useState<{ quote: Quote; lines: QuoteLine[] } | null>(
    null,
  )

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
    const by: Record<QuoteStatus, number> = {
      draft: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
    }
    for (const it of quotes) by[it.status]++
    return by
  }, [quotes])

  async function send(url: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown) {
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

  async function openView(quote: Quote) {
    setBusy(true)
    try {
      const data = await api<{ lines: QuoteLine[] }>(`/api/dept/sales/quotes/${quote.id}`)
      setViewing({ quote, lines: data.lines })
    } catch (e) {
      toast.error('Không tải được báo giá', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  async function openEdit(quote: Quote) {
    setBusy(true)
    try {
      const data = await api<{ lines: QuoteLine[] }>(`/api/dept/sales/quotes/${quote.id}`)
      setEditing({
        quote,
        lines: data.lines.map((l) => ({
          product_id: l.product_id,
          qty: l.qty,
          unit_price: l.unit_price,
          note: l.note ?? '',
        })),
      })
    } catch (e) {
      toast.error('Không tải được báo giá', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  async function submitQuote(quote: Quote) {
    const ok = await confirm({
      title: `Gửi ${quote.code} lên Giám đốc duyệt?`,
      description: 'Sau khi gửi sẽ không sửa được nữa.',
      confirmLabel: 'Gửi duyệt',
    })
    if (!ok) return
    const ok2 = await send(`/api/dept/sales/quotes/${quote.id}/submit`, 'POST')
    if (ok2) toast.success('Đã gửi duyệt', quote.code)
  }

  async function decide(quote: Quote, decision: 'approve' | 'reject') {
    let reason: string | undefined
    if (decision === 'reject') {
      reason = window.prompt(`Lý do từ chối ${quote.code}:`)?.trim() || undefined
      if (!reason) return
    } else {
      const ok = await confirm({
        title: `Duyệt báo giá ${quote.code}?`,
        description: `Khách: ${quote.customer_name}. Báo giá duyệt rồi mới tạo được đơn hàng (BR-04).`,
        confirmLabel: 'Duyệt',
      })
      if (!ok) return
    }
    const ok2 = await send(`/api/dept/sales/quotes/${quote.id}/decide`, 'POST', {
      decision,
      reason,
    })
    if (ok2) {
      toast.success(decision === 'approve' ? 'Đã duyệt' : 'Đã từ chối', quote.code)
      setViewing(null)
    }
  }

  async function deleteQuote(quote: Quote) {
    const ok = await confirm({
      title: `Xoá báo giá nháp ${quote.code}?`,
      tone: 'danger',
      confirmLabel: 'Xoá',
    })
    if (!ok) return
    const ok2 = await send(`/api/dept/sales/quotes/${quote.id}`, 'DELETE')
    if (ok2) toast.success('Đã xoá', quote.code)
  }

  const columns: Column<Quote>[] = [
    {
      key: 'code',
      header: 'Số BG / Khách hàng',
      sortValue: (it) => it.code,
      cell: (it) => (
        <button
          onClick={() => void openView(it)}
          className="flex min-w-0 flex-col text-left hover:text-sky-600 dark:hover:text-sky-400"
        >
          <span className="font-mono text-xs text-zinc-400">{it.code}</span>
          <span className="truncate font-medium">{it.customer_name}</span>
        </button>
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
          { label: 'Xem chi tiết', onClick: () => void openView(it) },
        ]
        if (canEdit && it.status === 'draft') {
          items.push(
            { label: 'Sửa', onClick: () => void openEdit(it) },
            { label: 'Gửi duyệt', onClick: () => void submitQuote(it) },
            { label: 'Xoá', onClick: () => void deleteQuote(it), danger: true },
          )
        }
        if (canApprove && it.status === 'pending') {
          items.push(
            { label: 'Duyệt', onClick: () => void decide(it, 'approve') },
            { label: 'Từ chối', onClick: () => void decide(it, 'reject'), danger: true },
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
        description={`${filtered.length} / ${quotes.length} báo giá. Nháp → gửi duyệt → Giám đốc duyệt → tạo đơn hàng.`}
        actions={
          canEdit && (
            <button onClick={() => setOpenCreate(true)} className={btnPrimary}>
              + Lập báo giá
            </button>
          )
        }
      />

      <StatsBar
        stats={[
          { label: 'Tổng', value: quotes.length, tone: 'default' },
          { label: 'Nháp', value: stats.draft, tone: 'gray' },
          {
            label: 'Chờ duyệt',
            value: stats.pending,
            tone: stats.pending ? 'amber' : 'gray',
          },
          { label: 'Đã duyệt', value: stats.approved, tone: 'green' },
          {
            label: 'Từ chối',
            value: stats.rejected,
            tone: stats.rejected ? 'red' : 'gray',
          },
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
                  { value: 'pending' as const, label: 'Chờ duyệt' },
                  { value: 'approved' as const, label: 'Đã duyệt' },
                  { value: 'rejected' as const, label: 'Từ chối' },
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
                  <button onClick={() => setOpenCreate(true)} className={btnPrimary}>
                    + Lập báo giá
                  </button>
                ) : undefined
              }
            />
          }
        />
      </div>

      {/* Create */}
      <Modal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        title="Lập báo giá"
        maxWidth="sm:max-w-3xl"
      >
        <QuoteForm
          customers={customers}
          products={products}
          submitLabel="Lưu nháp"
          onSubmit={async (body) => {
            const ok = await send('/api/dept/sales/quotes', 'POST', body)
            if (ok) {
              setOpenCreate(false)
              toast.success('Đã tạo báo giá nháp')
            }
          }}
        />
      </Modal>

      {/* Edit (draft only) */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `Sửa — ${editing.quote.code}` : ''}
        maxWidth="sm:max-w-3xl"
      >
        {editing && (
          <QuoteForm
            initial={editing.quote}
            initialLines={editing.lines}
            customers={customers}
            products={products}
            submitLabel="Lưu thay đổi"
            onSubmit={async (body) => {
              const ok = await send(
                `/api/dept/sales/quotes/${editing.quote.id}`,
                'PATCH',
                body,
              )
              if (ok) {
                setEditing(null)
                toast.success('Đã cập nhật', editing.quote.code)
              }
            }}
          />
        )}
      </Modal>

      {/* View detail */}
      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing ? `${viewing.quote.code} — ${viewing.quote.customer_name}` : ''}
        maxWidth="sm:max-w-3xl"
      >
        {viewing && (
          <QuoteDetail
            quote={viewing.quote}
            lines={viewing.lines}
            canEdit={canEdit}
            canApprove={canApprove}
            onSubmit={() => void submitQuote(viewing.quote)}
            onDecide={(d) => void decide(viewing.quote, d)}
            onEdit={() => {
              const v = viewing
              setViewing(null)
              void openEdit(v.quote)
            }}
          />
        )}
      </Modal>
    </div>
  )
}

// ── Detail ───────────────────────────────────────────────────────────────

function QuoteDetail({
  quote,
  lines,
  canEdit,
  canApprove,
  onSubmit,
  onDecide,
  onEdit,
}: {
  quote: Quote
  lines: QuoteLine[]
  canEdit: boolean
  canApprove: boolean
  onSubmit: () => void
  onDecide: (d: 'approve' | 'reject') => void
  onEdit: () => void
}) {
  const total = lines.reduce((s, l) => s + l.qty * l.unit_price, 0)
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={STATUS_TONE[quote.status]}>{STATUS_LABEL[quote.status]}</Badge>
        {quote.price_term && <Badge>{quote.price_term}</Badge>}
        {quote.payment_terms && <Badge>{quote.payment_terms}</Badge>}
        {(quote.valid_from || quote.valid_to) && (
          <span className="text-xs text-zinc-500">
            Hiệu lực:{' '}
            {quote.valid_from
              ? new Date(quote.valid_from).toLocaleDateString('vi-VN')
              : '…'}{' '}
            →{' '}
            {quote.valid_to ? new Date(quote.valid_to).toLocaleDateString('vi-VN') : '…'}
          </span>
        )}
      </div>

      {quote.status === 'rejected' && quote.rejected_reason && (
        <div className="rounded-md bg-red-50 p-3 text-red-700 dark:bg-red-950 dark:text-red-300">
          <b>Lý do từ chối:</b> {quote.rejected_reason}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 uppercase dark:border-zinc-800">
              <th className="py-2 pr-2">Sản phẩm</th>
              <th className="w-20 py-2 pr-2 text-right">SL</th>
              <th className="w-16 py-2 pr-2">ĐVT</th>
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
                    {l.note && <span className="text-xs text-zinc-500">{l.note}</span>}
                  </div>
                </td>
                <td className="py-1.5 pr-2 text-right">
                  {l.qty.toLocaleString('vi-VN')}
                </td>
                <td className="py-1.5 pr-2 text-zinc-500">{l.product_unit}</td>
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
                {fmtMoney(total, quote.currency)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {quote.note && <p className="text-zinc-500">{quote.note}</p>}

      <div className="mt-1 flex justify-end gap-2">
        {canEdit && quote.status === 'draft' && (
          <>
            <button
              onClick={onEdit}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Sửa
            </button>
            <button
              onClick={onSubmit}
              className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700"
            >
              Gửi duyệt
            </button>
          </>
        )}
        {canApprove && quote.status === 'pending' && (
          <>
            <button
              onClick={() => onDecide('reject')}
              className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
            >
              Từ chối
            </button>
            <button
              onClick={() => onDecide('approve')}
              className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
            >
              Duyệt báo giá
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── Form (create / edit draft) ───────────────────────────────────────────

function QuoteForm({
  initial,
  initialLines,
  customers,
  products,
  submitLabel,
  onSubmit,
}: {
  initial?: Quote
  initialLines?: LineRow[]
  customers: CustomerOption[]
  products: ProductOption[]
  submitLabel: string
  onSubmit: (body: Record<string, unknown>) => Promise<void> | void
}) {
  const [busy, setBusy] = useState(false)
  const [customerId, setCustomerId] = useState(initial?.customer_id ?? '')
  const [lines, setLines] = useState<LineRow[]>(initialLines ?? [])
  const cls =
    'w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'

  // Ưu tiên SP của đúng khách đang chọn (thư viện theo khách), rồi tới mẫu chung.
  const productChoices = useMemo(() => {
    const own = products.filter((p) => p.customer_id === customerId)
    const common = products.filter((p) => !p.customer_id)
    const others = products.filter((p) => p.customer_id && p.customer_id !== customerId)
    return { own, common, others }
  }, [products, customerId])

  const usedIds = new Set(lines.map((l) => l.product_id))
  const invalid =
    !customerId ||
    lines.length !== usedIds.size ||
    lines.some(
      (l) => !l.product_id || l.qty === '' || Number(l.qty) <= 0 || l.unit_price === '',
    )

  function setLine(i: number, patch: Partial<LineRow>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }

  async function handle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const body: Record<string, unknown> = {
      customer_id: customerId,
      currency: String(fd.get('currency') ?? 'USD'),
      valid_from: String(fd.get('valid_from') ?? '') || null,
      valid_to: String(fd.get('valid_to') ?? '') || null,
      price_term: String(fd.get('price_term') ?? '').trim() || null,
      payment_terms: String(fd.get('payment_terms') ?? '').trim() || null,
      note: String(fd.get('note') ?? '').trim() || null,
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

  function renderOption(p: ProductOption) {
    const bomMark =
      p.bom_status === 'done' ? '✓BOM' : p.bom_status === 'drawing' ? '…BOM' : ''
    return (
      <option key={p.id} value={p.id} disabled={usedIds.has(p.id)}>
        {p.code} — {p.name} {bomMark}
      </option>
    )
  }

  return (
    <form onSubmit={handle} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          Khách hàng <span className="text-red-500">*</span>
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            required
            className={cls}
          >
            <option value="">— chọn khách —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Tiền tệ
          <select
            name="currency"
            defaultValue={initial?.currency ?? 'USD'}
            className={cls}
          >
            <option value="USD">USD</option>
            <option value="VND">VND</option>
            <option value="EUR">EUR</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Hiệu lực từ
          <input
            name="valid_from"
            type="date"
            defaultValue={initial?.valid_from ?? ''}
            className={cls}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Đến ngày
          <input
            name="valid_to"
            type="date"
            defaultValue={initial?.valid_to ?? ''}
            className={cls}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Điều kiện giá
          <input
            name="price_term"
            maxLength={100}
            placeholder="FOB Quy Nhon"
            defaultValue={initial?.price_term ?? ''}
            className={cls}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-3">
          Điều khoản thanh toán
          <input
            name="payment_terms"
            maxLength={500}
            placeholder="L/C at sight · 20% deposit, 80% balance…"
            defaultValue={initial?.payment_terms ?? ''}
            className={cls}
          />
        </label>
      </div>

      {/* Lines */}
      <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
        <div className="mb-2 text-xs font-semibold text-zinc-500 uppercase">
          Dòng sản phẩm ({lines.length})
        </div>
        {lines.length === 0 && (
          <p className="py-2 text-center text-xs text-zinc-400">
            Chưa có dòng nào — chọn sản phẩm từ thư viện Kỹ thuật.
          </p>
        )}
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
        Ghi chú
        <textarea
          name="note"
          rows={2}
          maxLength={2000}
          defaultValue={initial?.note ?? ''}
          className={cls}
        />
      </label>

      <div className="flex justify-end">
        <button
          disabled={busy || invalid}
          className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {busy && <Spinner size={14} />}
          {busy ? 'Đang lưu…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
