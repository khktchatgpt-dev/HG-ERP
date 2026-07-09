'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { api, ApiError } from '@/lib/api'
import { Modal } from '@/components/Modal'
import { PageHeader } from '@/components/erp/PageHeader'
import { StatsBar } from '@/components/erp/StatsBar'
import { DataTable, type Column } from '@/components/erp/DataTable'
import { EmptyState } from '@/components/erp/EmptyState'
import { TopProgressBar } from '@/components/erp/Spinner'
import {
  PoDetail,
  type Po,
  type PoLine,
  type StatusLine,
} from '@/app/(workspace)/planning/pos/PosManager'

type PendingPo = {
  id: string
  code: string
  supplier_name: string
  lsx_code: string
  order_code: string | null
  expected_at: string | null
  created_at: string
  currency: string
  total: number
  lines_count: number
}
type PendingLsx = {
  id: string
  code: string
  order_code: string
  customer_name: string
  created_at: string
}

export function ApprovalsManager({
  pos,
  lsxs,
}: {
  pos: PendingPo[]
  lsxs: PendingLsx[]
}) {
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)
  // Xem chi tiết PO (dòng, tổng tiền, hồ sơ file) trước khi duyệt — read-only.
  const [viewing, setViewing] = useState<{
    po: Po
    lines: PoLine[]
    statusLines: StatusLine[]
  } | null>(null)

  async function openPo(p: PendingPo) {
    setBusy(true)
    try {
      const data = await api<{ po: Po; lines: PoLine[]; status_lines: StatusLine[] }>(
        `/api/dept/supply/pos/${p.id}`,
      )
      setViewing({
        po: { ...data.po, supplier_name: p.supplier_name, lsx_code: p.lsx_code },
        lines: data.lines,
        statusLines: data.status_lines,
      })
    } catch (e) {
      toast.error('Không tải được đơn đặt', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  async function decideLsx(l: PendingLsx, decision: 'approve' | 'reject') {
    let reason: string | undefined
    if (decision === 'reject') {
      reason = window.prompt(`Lý do từ chối LSX ${l.code}:`)?.trim() || undefined
      if (!reason) return
    } else {
      const ok = await confirm({
        title: `Duyệt LSX ${l.code}?`,
        description: `${l.customer_name} · đơn ${l.order_code}. Duyệt xong Cung ứng mới đặt được vật tư.`,
        confirmLabel: 'Duyệt',
      })
      if (!ok) return
    }
    setBusy(true)
    try {
      await api(
        `/api/dept/production/lsx/${l.id}/${decision === 'approve' ? 'approve' : 'reject'}`,
        { method: 'POST', body: decision === 'reject' ? { reason } : {} },
      )
      toast.success(decision === 'approve' ? 'Đã duyệt LSX' : 'Đã từ chối LSX', l.code)
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
      setViewing(null)
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
        <button
          onClick={() => void openPo(p)}
          className="flex min-w-0 flex-col text-left hover:text-sky-600 dark:hover:text-sky-400"
          title="Xem chi tiết dòng, tổng tiền, hồ sơ trước khi duyệt"
        >
          <span className="font-mono text-xs text-zinc-400">{p.code}</span>
          <span className="truncate font-medium">{p.supplier_name}</span>
        </button>
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
      key: 'total',
      header: 'Giá trị',
      width: '140px',
      align: 'right',
      sortValue: (p) => p.total,
      cell: (p) => (
        <div className="flex flex-col items-end">
          <span className="font-semibold">
            {p.total.toLocaleString('vi-VN')} {p.currency}
          </span>
          <span className="text-xs text-zinc-400">{p.lines_count} dòng</span>
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

  const lsxColumns: Column<PendingLsx>[] = [
    {
      key: 'code',
      header: 'LSX / Khách hàng',
      sortValue: (l) => l.code,
      cell: (l) => (
        <a href={`/sales/lsx/${l.id}`} className="flex min-w-0 flex-col">
          <span className="font-mono text-xs text-blue-600 dark:text-blue-400">
            {l.code}
          </span>
          <span className="truncate font-medium">{l.customer_name}</span>
        </a>
      ),
    },
    {
      key: 'order',
      header: 'Đơn hàng',
      width: '140px',
      cell: (l) => <span className="font-mono text-xs">{l.order_code}</span>,
    },
    {
      key: 'created',
      header: 'Phát ngày',
      width: '110px',
      cell: (l) => new Date(l.created_at).toLocaleDateString('vi-VN'),
    },
    {
      key: 'actions',
      header: 'Quyết định',
      width: '190px',
      align: 'right',
      cell: (l) => (
        <div className="flex justify-end gap-2">
          <button
            onClick={() => void decideLsx(l, 'reject')}
            className="rounded-md border border-red-300 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
          >
            Từ chối
          </button>
          <button
            onClick={() => void decideLsx(l, 'approve')}
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
        description="Duyệt Lệnh sản xuất (FR-SAL-06) + đơn đặt vật tư trước khi gửi NCC (BR-05). Báo giá bán là hồ sơ riêng của Sales — không duyệt ở đây."
      />

      <StatsBar
        stats={[
          {
            label: 'LSX chờ duyệt',
            value: lsxs.length,
            tone: lsxs.length ? 'amber' : 'green',
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
          Lệnh sản xuất chờ duyệt ({lsxs.length})
        </h2>
        <DataTable<PendingLsx>
          rows={lsxs}
          columns={lsxColumns}
          storageKey="exec-pending-lsx"
          emptyState={
            <EmptyState
              icon="✓"
              title="Không có LSX nào chờ duyệt"
              description="Sales phát LSX sẽ hiện ở đây kèm thông báo (FR-SAL-06)."
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

      {/* Chi tiết PO trước khi duyệt — read-only + nút Duyệt/Từ chối */}
      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing ? `${viewing.po.code} — ${viewing.po.supplier_name}` : ''}
        maxWidth="sm:max-w-4xl"
      >
        {viewing && (
          <PoDetail
            po={viewing.po}
            lines={viewing.lines}
            statusLines={viewing.statusLines}
            canEdit={false}
            canApprove
            onDecide={(d) =>
              void decidePo(
                {
                  id: viewing.po.id,
                  code: viewing.po.code,
                  supplier_name: viewing.po.supplier_name,
                  lsx_code: viewing.po.lsx_code,
                } as PendingPo,
                d,
              )
            }
            onAdvance={() => {}}
            onCancel={() => {}}
          />
        )}
      </Modal>
    </div>
  )
}
