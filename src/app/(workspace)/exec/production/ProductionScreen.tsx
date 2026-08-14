'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/erp/PageHeader'
import { DataTable, type Column } from '@/components/erp/DataTable'
import { EmptyState } from '@/components/erp/EmptyState'
import { Toolbar, ToolbarInput } from '@/components/erp/Toolbar'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/shadcn/button'
import { LSX_STATUS } from '@/lib/lsx-status'
import type { LsxStatus } from '@/modules/dept/production/production.schema'
import type { ProductionOrderWithOrders } from '@/modules/dept/production/production.repo'

/**
 * SẢN XUẤT (/exec/production) — tầng THEO DÕI của khu Giám đốc (15/08/2026,
 * docs/exec-v3-approval-center.md): mọi lệnh sản xuất theo trạng thái, chỉ đọc.
 * Duyệt lệnh ở Trung tâm phê duyệt; chi tiết mở bản /exec/lsx/[id] (không nhảy
 * shell Sales). Tiến độ công đoạn chi tiết là việc của xưởng (/production,
 * /thongke) — màn này chỉ trả lời "bao nhiêu lệnh, đang nằm ở bước nào".
 */

/** Thứ tự chip lọc = thứ tự vòng đời lệnh. */
const CHIP_STATUSES: LsxStatus[] = [
  'pending_approval',
  'approved',
  'in_progress',
  'completed',
  'draft',
  'rejected',
]

export function ProductionScreen({ rows }: { rows: ProductionOrderWithOrders[] }) {
  const [status, setStatus] = useState<LsxStatus | 'all'>('all')
  const [q, setQ] = useState('')

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of rows) m.set(r.status, (m.get(r.status) ?? 0) + 1)
    return m
  }, [rows])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return rows.filter((r) => {
      if (status !== 'all' && r.status !== status) return false
      if (!needle) return true
      return (
        r.code.toLowerCase().includes(needle) ||
        r.customer_name.toLowerCase().includes(needle) ||
        r.order_codes.some((c) => c.toLowerCase().includes(needle))
      )
    })
  }, [rows, status, q])

  const columns: Column<ProductionOrderWithOrders>[] = [
    {
      key: 'code',
      header: 'Mã lệnh',
      width: '140px',
      cell: (r) => (
        <Link href={`/exec/lsx/${r.id}`} className="font-semibold hover:underline">
          {r.code}
        </Link>
      ),
      sortValue: (r) => r.code,
    },
    {
      key: 'customer',
      header: 'Khách hàng',
      cell: (r) => (
        <div className="min-w-0">
          <div className="truncate">{r.customer_name}</div>
          <div className="text-muted-foreground truncate text-xs">
            {r.order_codes.length > 1
              ? `${r.order_codes.length} đơn: ${r.order_codes.join(', ')}`
              : `đơn ${r.order_codes[0] ?? '—'}`}
          </div>
        </div>
      ),
      sortValue: (r) => r.customer_name,
    },
    {
      key: 'status',
      header: 'Trạng thái',
      width: '150px',
      cell: (r) => {
        const s = LSX_STATUS[r.status]
        return <Badge tone={s?.tone ?? 'gray'}>{s?.label ?? r.status}</Badge>
      },
      sortValue: (r) => r.status,
    },
    {
      key: 'ship_date',
      header: 'Hạn xuất',
      width: '110px',
      cell: (r) => <span className="text-sm tabular-nums">{r.ship_date ?? '—'}</span>,
      sortValue: (r) => r.ship_date ?? '',
    },
    {
      key: 'created_at',
      header: 'Ngày lập',
      width: '110px',
      cell: (r) => (
        <span className="text-muted-foreground text-sm tabular-nums">
          {r.created_at.slice(0, 10)}
        </span>
      ),
      sortValue: (r) => r.created_at,
    },
  ]

  const pendingCount = counts.get('pending_approval') ?? 0

  return (
    <div className="space-y-4">
      <PageHeader
        title="Sản xuất"
        description="Lệnh sản xuất theo trạng thái — theo dõi, không thao tác. Tiến độ chi tiết từng công đoạn nằm ở khu xưởng."
        actions={
          pendingCount > 0 ? (
            <Button asChild>
              <Link href="/exec/approvals?loai=lsx">Duyệt {pendingCount} lệnh chờ →</Link>
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={status === 'all' ? 'default' : 'outline'}
          onClick={() => setStatus('all')}
        >
          Tất cả<span className="ms-1.5 tabular-nums opacity-70">{rows.length}</span>
        </Button>
        {CHIP_STATUSES.filter((s) => (counts.get(s) ?? 0) > 0).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={status === s ? 'default' : 'outline'}
            onClick={() => setStatus(s)}
          >
            {LSX_STATUS[s].label}
            <span className="ms-1.5 tabular-nums opacity-70">{counts.get(s)}</span>
          </Button>
        ))}
      </div>

      <div>
        <Toolbar
          left={
            <ToolbarInput
              value={q}
              onChange={setQ}
              placeholder="Tìm mã lệnh / khách / mã đơn…"
            />
          }
        />
        <DataTable
          rows={filtered}
          columns={columns}
          storageKey="exec-production"
          emptyState={
            rows.length === 0 ? (
              <EmptyState
                title="Chưa có lệnh sản xuất nào trên hệ thống"
                description="Phòng Kinh doanh phát lệnh thì danh sách này mới có dữ liệu."
              />
            ) : (
              <EmptyState
                title="Không có lệnh nào khớp bộ lọc"
                description="Đổi trạng thái hoặc xoá từ khoá tìm."
              />
            )
          }
        />
      </div>
    </div>
  )
}
