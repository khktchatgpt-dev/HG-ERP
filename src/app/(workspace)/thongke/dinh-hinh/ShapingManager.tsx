'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/Badge'
import { PageHeader } from '@/components/erp/PageHeader'
import { StatsBar } from '@/components/erp/StatsBar'
import { Toolbar, ToolbarInput, ToolbarSelect } from '@/components/erp/Toolbar'
import { DataTable, type Column } from '@/components/erp/DataTable'
import { EmptyState } from '@/components/erp/EmptyState'

export type ShapingItem = {
  id: string
  code: string
  order_code: string
  customer_name: string
  status: string
  ship_date: string | null
  /** Số dòng bảng chi tiết đã nhập — 0 = chưa định hình. */
  comps: number
}

type Filter = 'all' | 'need'

const fmtD = (d: string | null) => (d ? new Date(d).toLocaleDateString('vi-VN') : '—')

export function ShapingManager({
  items,
  canEdit,
}: {
  items: ShapingItem[]
  canEdit: boolean
}) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const need = items.filter((i) => i.comps === 0).length

  const shown = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return items
      .filter((i) => {
        if (filter === 'need' && i.comps > 0) return false
        if (
          ql &&
          !`${i.code} ${i.customer_name} ${i.order_code}`.toLowerCase().includes(ql)
        )
          return false
        return true
      })
      .sort((a, b) => (a.comps === 0 ? 0 : 1) - (b.comps === 0 ? 0 : 1))
  }, [items, q, filter])

  const columns: Column<ShapingItem>[] = [
    {
      key: 'code',
      header: 'LSX',
      width: '130px',
      cell: (r) => (
        <Link
          href={`/thongke/dinh-hinh/${r.id}`}
          className="font-mono font-semibold hover:text-red-600 dark:hover:text-red-400"
        >
          {r.code}
        </Link>
      ),
    },
    {
      key: 'customer',
      header: 'Khách / Đơn',
      cell: (r) => (
        <span>
          <span className="font-medium">{r.customer_name}</span>{' '}
          <span className="text-xs text-zinc-500">· {r.order_code}</span>
        </span>
      ),
    },
    {
      key: 'comps',
      header: 'Bảng chi tiết',
      width: '170px',
      cell: (r) =>
        r.comps === 0 ? (
          <Badge tone="amber">Chưa định hình</Badge>
        ) : (
          <span className="text-sm">{r.comps} dòng chi tiết</span>
        ),
    },
    {
      key: 'ship',
      header: 'Hạn xuất',
      width: '110px',
      cell: (r) => fmtD(r.ship_date),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumbs={[
          { label: 'Thống kê xưởng', href: '/thongke' },
          { label: 'Định hình chi tiết' },
        ]}
        title="Định hình chi tiết"
        description={
          canEdit
            ? 'Kéo bảng chi tiết từ BOM Kỹ thuật, sửa định mức rồi chốt cho từng lệnh — chốt trước khi ghi sổ số liệu.'
            : 'Bạn chỉ xem — định hình là việc của thống kê xưởng.'
        }
      />
      <StatsBar
        stats={[
          { label: 'Lệnh đang chạy', value: items.length, tone: 'blue' },
          { label: 'Chưa định hình', value: need, tone: need ? 'amber' : 'gray' },
        ]}
      />
      <Toolbar
        left={
          <>
            <ToolbarInput
              value={q}
              onChange={setQ}
              placeholder="Tìm mã LSX, khách, đơn…"
              icon="⌕"
              className="w-64"
            />
            <ToolbarSelect
              value={filter}
              onChange={(v) => setFilter(v)}
              options={[
                { value: 'all' as const, label: 'Tất cả' },
                { value: 'need' as const, label: 'Chưa định hình' },
              ]}
            />
          </>
        }
        right={<span className="text-xs text-zinc-500">{shown.length} lệnh</span>}
      />
      <DataTable
        rows={shown}
        columns={columns}
        emptyState={
          <EmptyState
            icon="▥"
            title="Không có lệnh nào"
            description="LSX được duyệt sẽ chờ định hình ở đây."
          />
        }
      />
    </div>
  )
}
