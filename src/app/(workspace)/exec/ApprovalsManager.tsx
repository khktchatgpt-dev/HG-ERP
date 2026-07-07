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

export function ApprovalsManager({
  quotes,
  pendingPoCount,
}: {
  quotes: PendingQuote[]
  pendingPoCount: number
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
            value: pendingPoCount,
            tone: pendingPoCount ? 'amber' : 'green',
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
          Đơn đặt vật tư chờ duyệt ({pendingPoCount})
        </h2>
        <p className="rounded-md border border-dashed border-zinc-300 p-4 text-sm text-zinc-500 dark:border-zinc-700">
          Danh sách duyệt mua vật tư (BR-05) sẽ đổ về đây khi phân hệ Cung ứng hoàn thành
          — bảng dữ liệu đã sẵn sàng.
        </p>
      </section>
    </div>
  )
}
