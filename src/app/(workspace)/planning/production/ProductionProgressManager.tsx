'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/Badge'
import { PageHeader } from '@/components/erp/PageHeader'
import { StatsBar } from '@/components/erp/StatsBar'
import { Toolbar, ToolbarInput, ToolbarSelect } from '@/components/erp/Toolbar'
import { DataTable, type Column } from '@/components/erp/DataTable'
import { EmptyState } from '@/components/erp/EmptyState'

type LsxStatus =
  'pending_approval' | 'approved' | 'in_progress' | 'completed' | 'rejected'

type Row = {
  id: string
  code: string
  order_code: string
  customer_name: string
  status: LsxStatus
  current_stage: string | null
  ship_date: string | null
  completed_at: string | null
}

const ST: Record<
  LsxStatus,
  { label: string; tone: 'gray' | 'blue' | 'amber' | 'green' | 'red' }
> = {
  pending_approval: { label: 'Chờ GĐ duyệt', tone: 'amber' },
  approved: { label: 'Đã duyệt — chờ SX', tone: 'blue' },
  in_progress: { label: 'Đang sản xuất', tone: 'amber' },
  completed: { label: 'Hoàn thành', tone: 'green' },
  rejected: { label: 'Bị từ chối', tone: 'red' },
}

const fmtD = (d: string | null) => (d ? new Date(d).toLocaleDateString('vi-VN') : '—')

export function ProductionProgressManager({
  rows,
  stages,
}: {
  rows: Row[]
  stages: { code: string; label: string }[]
}) {
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | LsxStatus>('all')

  const stageLabel = (code: string | null) =>
    code ? (stages.find((s) => s.code === code)?.label ?? code) : null

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return rows.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (
        ql &&
        !`${r.code} ${r.order_code} ${r.customer_name}`.toLowerCase().includes(ql)
      )
        return false
      return true
    })
  }, [rows, q, statusFilter])

  const count = (st: LsxStatus) => rows.filter((r) => r.status === st).length

  const columns: Column<Row>[] = [
    {
      key: 'code',
      header: 'Số LSX',
      sortValue: (r) => r.code,
      cell: (r) => (
        <Link
          href={`/sales/lsx/${r.id}`}
          className="font-mono text-sm font-medium text-sky-600 hover:underline dark:text-sky-400"
        >
          {r.code}
        </Link>
      ),
    },
    {
      key: 'order',
      header: 'Đơn hàng / Khách',
      cell: (r) => (
        <div className="flex min-w-0 flex-col">
          <span className="font-mono text-xs text-zinc-400">{r.order_code}</span>
          <span className="truncate">{r.customer_name}</span>
        </div>
      ),
    },
    {
      key: 'stage',
      header: 'Giai đoạn hiện tại',
      width: '160px',
      cell: (r) => {
        const label = stageLabel(r.current_stage)
        if (r.status === 'in_progress' && label)
          return <Badge tone="amber">{label}</Badge>
        return <span className="text-xs text-zinc-400">{label ?? '—'}</span>
      },
    },
    {
      key: 'ship',
      header: 'Ngày xuất hàng',
      width: '130px',
      sortValue: (r) => r.ship_date ?? '',
      cell: (r) => <span className="text-sm">{fmtD(r.ship_date)}</span>,
    },
    {
      key: 'status',
      header: 'Trạng thái',
      width: '150px',
      sortValue: (r) => r.status,
      cell: (r) => <Badge tone={ST[r.status].tone}>{ST[r.status].label}</Badge>,
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumbs={[
          { label: 'Kế hoạch - Cung ứng', href: '/planning' },
          { label: 'Tiến độ sản xuất' },
        ]}
        title="Tiến độ sản xuất"
        description="Theo dõi và cập nhật giai đoạn từng LSX (FR-SUP-08) — bấm số LSX để vào chi tiết, cập nhật giai đoạn hoặc báo hoàn thành."
      />

      <StatsBar
        stats={[
          { label: 'Chờ GĐ duyệt', value: count('pending_approval'), tone: 'amber' },
          { label: 'Chờ sản xuất', value: count('approved'), tone: 'blue' },
          { label: 'Đang sản xuất', value: count('in_progress'), tone: 'amber' },
          { label: 'Hoàn thành', value: count('completed'), tone: 'green' },
        ]}
      />

      <div>
        <Toolbar
          left={
            <>
              <ToolbarInput
                value={q}
                onChange={setQ}
                placeholder="Tìm số LSX, đơn hàng, khách…"
                icon="⌕"
                className="w-64"
              />
              <ToolbarSelect
                value={statusFilter}
                onChange={(v) => setStatusFilter(v)}
                options={[
                  { value: 'all' as const, label: 'Mọi trạng thái' },
                  { value: 'pending_approval' as const, label: 'Chờ GĐ duyệt' },
                  { value: 'approved' as const, label: 'Chờ sản xuất' },
                  { value: 'in_progress' as const, label: 'Đang sản xuất' },
                  { value: 'completed' as const, label: 'Hoàn thành' },
                  { value: 'rejected' as const, label: 'Bị từ chối' },
                ]}
              />
            </>
          }
        />

        <DataTable<Row>
          rows={filtered}
          columns={columns}
          storageKey="planning-production"
          emptyState={
            <EmptyState
              icon="▣"
              title={rows.length === 0 ? 'Chưa có LSX nào' : 'Không khớp bộ lọc'}
              description="LSX do Sales phát từ đơn hàng đã xác nhận; GĐ duyệt xong sẽ hiện ở đây để theo dõi tiến độ."
            />
          }
        />
      </div>
    </div>
  )
}
