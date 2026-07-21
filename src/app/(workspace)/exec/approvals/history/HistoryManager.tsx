'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/erp/PageHeader'
import { StatsBar } from '@/components/erp/StatsBar'
import { Toolbar, ToolbarSelect } from '@/components/erp/Toolbar'
import { DataTable, type Column } from '@/components/erp/DataTable'
import { EmptyState } from '@/components/erp/EmptyState'
import { Badge } from '@/components/Badge'

type Ev = {
  id: string
  entity_type: 'po' | 'lsx'
  entity_id: string
  entity_code: string
  action: 'approved' | 'rejected'
  actor_id: string | null
  actor_name: string | null
  reason: string | null
  created_at: string
}

const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

const TYPE_LABEL = { lsx: 'Lệnh SX', po: 'Đơn vật tư' } as const

export function HistoryManager({ events }: { events: Ev[] }) {
  const [type, setType] = useState<'all' | 'lsx' | 'po'>('all')
  const [action, setAction] = useState<'all' | 'approved' | 'rejected'>('all')

  const rows = useMemo(
    () =>
      events.filter(
        (e) =>
          (type === 'all' || e.entity_type === type) &&
          (action === 'all' || e.action === action),
      ),
    [events, type, action],
  )

  const approved = events.filter((e) => e.action === 'approved').length
  const rejected = events.filter((e) => e.action === 'rejected').length

  const columns: Column<Ev>[] = [
    {
      key: 'created_at',
      header: 'Thời điểm',
      width: '150px',
      sortValue: (e) => e.created_at,
      cell: (e) => (
        <span className="whitespace-nowrap tabular-nums">
          {fmtDateTime(e.created_at)}
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Loại',
      width: '110px',
      sortValue: (e) => e.entity_type,
      cell: (e) => (
        <Badge tone={e.entity_type === 'lsx' ? 'amber' : 'blue'}>
          {TYPE_LABEL[e.entity_type]}
        </Badge>
      ),
    },
    {
      key: 'code',
      header: 'Mã phiếu',
      width: '150px',
      sortValue: (e) => e.entity_code,
      cell: (e) =>
        e.entity_type === 'lsx' ? (
          <Link
            href={`/exec/lsx/${e.entity_id}`}
            className="font-mono text-xs text-sky-600 hover:underline dark:text-sky-400"
          >
            {e.entity_code}
          </Link>
        ) : (
          <span className="font-mono text-xs">{e.entity_code}</span>
        ),
    },
    {
      key: 'action',
      header: 'Quyết định',
      width: '120px',
      sortValue: (e) => e.action,
      cell: (e) => (
        <Badge tone={e.action === 'approved' ? 'green' : 'red'}>
          {e.action === 'approved' ? 'Đã duyệt' : 'Từ chối'}
        </Badge>
      ),
    },
    {
      key: 'actor',
      header: 'Người quyết',
      width: '170px',
      sortValue: (e) => e.actor_name ?? '',
      cell: (e) => <span className="truncate">{e.actor_name ?? '—'}</span>,
    },
    {
      key: 'reason',
      header: 'Lý do (nếu từ chối)',
      cell: (e) => (
        <span className="text-zinc-600 dark:text-zinc-400">
          {e.reason?.trim() || '—'}
        </span>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumbs={[
          { label: 'Ban Giám đốc', href: '/exec/approvals' },
          { label: 'Lịch sử phê duyệt' },
        ]}
        title="Lịch sử phê duyệt"
        description="Nhật ký mọi quyết định duyệt / từ chối Lệnh sản xuất và đơn đặt vật tư — ai quyết, khi nào, lý do gì."
        actions={
          <Link
            href="/exec/approvals"
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:bg-zinc-900"
          >
            ‹ Về phê duyệt
          </Link>
        }
      />

      <StatsBar
        stats={[
          { label: 'Tổng quyết định', value: events.length, tone: 'default' },
          { label: 'Đã duyệt', value: approved, tone: 'green' },
          { label: 'Từ chối', value: rejected, tone: rejected ? 'red' : 'gray' },
        ]}
      />

      <div>
        <Toolbar
          left={
            <>
              <ToolbarSelect
                value={type}
                onChange={(v) => setType(v as typeof type)}
                options={[
                  { value: 'all', label: 'Mọi loại' },
                  { value: 'lsx', label: 'Lệnh SX' },
                  { value: 'po', label: 'Đơn vật tư' },
                ]}
              />
              <ToolbarSelect
                value={action}
                onChange={(v) => setAction(v as typeof action)}
                options={[
                  { value: 'all', label: 'Mọi quyết định' },
                  { value: 'approved', label: 'Đã duyệt' },
                  { value: 'rejected', label: 'Từ chối' },
                ]}
              />
            </>
          }
        />

        {rows.length === 0 ? (
          <EmptyState
            icon="🗒"
            title={
              events.length === 0 ? 'Chưa có lịch sử phê duyệt' : 'Không khớp bộ lọc'
            }
            description={
              events.length === 0
                ? 'Mỗi lần duyệt/từ chối một phiếu, hệ thống sẽ ghi lại vào đây.'
                : 'Thử đổi bộ lọc loại / quyết định.'
            }
          />
        ) : (
          <DataTable<Ev> rows={rows} columns={columns} storageKey="approval-history" />
        )}
      </div>
    </div>
  )
}
