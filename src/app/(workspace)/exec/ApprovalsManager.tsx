'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { api, ApiError } from '@/lib/api'
import { PageHeader } from '@/components/erp/PageHeader'
import { StatsBar } from '@/components/erp/StatsBar'
import { DataTable, type Column } from '@/components/erp/DataTable'
import { EmptyState } from '@/components/erp/EmptyState'
import { TopProgressBar } from '@/components/erp/Spinner'

type PendingQuote = {
  id: string
  code: string
  customer_name: string
  currency: string
  valid_to: string | null
  created_at: string
}

type PendingPo = {
  id: string
  code: string
  supplier_name: string
  lsx_code: string
  order_code: string | null
  expected_at: string | null
  created_at: string
}

export function ApprovalsManager({
  quotes,
  pos,
}: {
  quotes: PendingQuote[]
  pos: PendingPo[]
}) {
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)

  async function decide(q: PendingQuote, decision: 'approve' | 'reject') {
    let reason: string | undefined
    if (decision === 'reject') {
      reason = window.prompt(`Lý do từ chối ${q.code}:`)?.trim() || undefined
      if (!reason) return
    } else {
      const ok = await confirm({
        title: `Duyệt báo giá ${q.code}?`,
        description: `Khách: ${q.customer_name}. Sau khi duyệt, Sales tạo được đơn hàng (BR-04).`,
        confirmLabel: 'Duyệt',
      })
      if (!ok) return
    }
    setBusy(true)
    try {
      await api(`/api/dept/sales/quotes/${q.id}/decide`, {
        method: 'POST',
        body: { decision, reason },
      })
      toast.success(decision === 'approve' ? 'Đã duyệt' : 'Đã từ chối', q.code)
      router.refresh()
    } catch (e) {
      toast.error('Thao tác thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  async function decidePo(p: PendingPo, decision: 'approve' | 'reject') {
    let reason: string | undefined
    if (decision === 'reject') {
      reason = window.prompt(`Lý do từ chối ${p.code}:`)?.trim() || undefined
      if (!reason) return
    } else {
      const ok = await confirm({
        title: `Duyệt đơn đặt ${p.code}?`,
        description: `NCC: ${p.supplier_name} · LSX ${p.lsx_code}. Duyệt xong Cung ứng mới gửi được cho NCC (BR-05).`,
        confirmLabel: 'Duyệt',
      })
      if (!ok) return
    }
    setBusy(true)
    try {
      await api(`/api/dept/supply/pos/${p.id}/decide`, {
        method: 'POST',
        body: { decision, reason },
      })
      toast.success(decision === 'approve' ? 'Đã duyệt' : 'Đã từ chối', p.code)
      router.refresh()
    } catch (e) {
      toast.error('Thao tác thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  const poColumns: Column<PendingPo>[] = [
    {
      key: 'code',
      header: 'Đơn đặt / NCC',
      sortValue: (p) => p.code,
      cell: (p) => (
        <div className="flex min-w-0 flex-col">
          <span className="font-mono text-xs text-zinc-400">{p.code}</span>
          <span className="truncate font-medium">{p.supplier_name}</span>
        </div>
      ),
    },
    {
      key: 'lsx',
      header: 'LSX / Đơn hàng',
      width: '160px',
      cell: (p) => (
        <div className="flex flex-col text-xs">
          <span className="font-mono">{p.lsx_code}</span>
          {p.order_code && <span className="text-zinc-400">{p.order_code}</span>}
        </div>
      ),
    },
    {
      key: 'expected',
      header: 'Hẹn giao',
      width: '110px',
      cell: (p) =>
        p.expected_at ? (
          new Date(p.expected_at).toLocaleDateString('vi-VN')
        ) : (
          <span className="text-zinc-400">—</span>
        ),
    },
    {
      key: 'print',
      header: '',
      width: '90px',
      cell: (p) => (
        <a
          href={`/print/supply/${p.id}`}
          target="_blank"
          rel="noopener"
          className="text-xs text-sky-600 underline hover:text-sky-700 dark:text-sky-400"
        >
          Xem bản in
        </a>
      ),
    },
    {
      key: 'actions',
      header: 'Quyết định',
      width: '190px',
      align: 'right',
      cell: (p) => (
        <div className="flex justify-end gap-2">
          <button
            onClick={() => void decidePo(p, 'reject')}
            className="rounded-md border border-red-300 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
          >
            Từ chối
          </button>
          <button
            onClick={() => void decidePo(p, 'approve')}
            className="rounded-md bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700"
          >
            ✓ Duyệt
          </button>
        </div>
      ),
    },
  ]

  const columns: Column<PendingQuote>[] = [
    {
      key: 'code',
      header: 'Báo giá / Khách hàng',
      sortValue: (q) => q.code,
      cell: (q) => (
        <div className="flex min-w-0 flex-col">
          <span className="font-mono text-xs text-zinc-400">{q.code}</span>
          <span className="truncate font-medium">{q.customer_name}</span>
        </div>
      ),
    },
    {
      key: 'currency',
      header: 'Tiền tệ',
      width: '80px',
      cell: (q) => <span className="font-mono text-xs">{q.currency}</span>,
    },
    {
      key: 'created',
      header: 'Gửi duyệt',
      sortValue: (q) => q.created_at,
      width: '120px',
      cell: (q) => new Date(q.created_at).toLocaleDateString('vi-VN'),
    },
    {
      key: 'print',
      header: '',
      width: '90px',
      cell: (q) => (
        <a
          href={`/print/quotes/${q.id}`}
          target="_blank"
          rel="noopener"
          className="text-xs text-sky-600 underline hover:text-sky-700 dark:text-sky-400"
        >
          Xem bản in
        </a>
      ),
    },
    {
      key: 'actions',
      header: 'Quyết định',
      width: '190px',
      align: 'right',
      cell: (q) => (
        <div className="flex justify-end gap-2">
          <button
            onClick={() => void decide(q, 'reject')}
            className="rounded-md border border-red-300 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
          >
            Từ chối
          </button>
          <button
            onClick={() => void decide(q, 'approve')}
            className="rounded-md bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700"
          >
            ✓ Duyệt
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <TopProgressBar active={busy} />
      <PageHeader
        breadcrumbs={[{ label: 'Ban Giám đốc' }]}
        title="Phê duyệt tập trung"
        description="Hai khâu duyệt bắt buộc: báo giá bán và đơn đặt vật tư (FR-ADM-03)."
      />

      <StatsBar
        stats={[
          {
            label: 'Báo giá chờ duyệt',
            value: quotes.length,
            tone: quotes.length ? 'amber' : 'green',
          },
          {
            label: 'Đơn đặt vật tư chờ duyệt',
            value: pos.length,
            tone: pos.length ? 'amber' : 'green',
          },
        ]}
      />

      <section>
        <h2 className="mb-2 text-sm font-semibold text-zinc-500 uppercase">
          Báo giá chờ duyệt ({quotes.length})
        </h2>
        <DataTable<PendingQuote>
          rows={quotes}
          columns={columns}
          storageKey="exec-pending-quotes"
          emptyState={
            <EmptyState
              icon="✓"
              title="Không có báo giá nào chờ duyệt"
              description="Sales gửi báo giá lên sẽ hiện ở đây kèm thông báo."
            />
          }
        />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-zinc-500 uppercase">
          Đơn đặt vật tư chờ duyệt ({pos.length})
        </h2>
        <DataTable<PendingPo>
          rows={pos}
          columns={poColumns}
          storageKey="exec-pending-pos"
          emptyState={
            <EmptyState
              icon="✓"
              title="Không có đơn đặt vật tư nào chờ duyệt"
              description="Cung ứng gửi đơn đặt lên sẽ hiện ở đây kèm thông báo (BR-05)."
            />
          }
        />
      </section>
    </div>
  )
}
