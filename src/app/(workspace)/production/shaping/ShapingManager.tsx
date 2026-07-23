'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/Badge'
import { PageHeader } from '@/components/erp/PageHeader'
import { StatsBar } from '@/components/erp/StatsBar'
import { Toolbar, ToolbarInput, ToolbarSelect } from '@/components/erp/Toolbar'
import { DataTable, type Column } from '@/components/erp/DataTable'
import { EmptyState } from '@/components/erp/EmptyState'
import { LSX_STATUS } from '@/lib/lsx-status'

export type ShapingItem = {
  id: string
  code: string
  order_code: string
  customer_name: string
  status: string
  /** Số dòng bảng chi tiết đã nhập. */
  comps: number
  /** Số SP đã chốt lộ trình. */
  routes: number
  /** Tổng số dòng SP của đơn (để "đã chốt x/y SP"). */
  line_total: number
}

const needsComps = (r: ShapingItem) => r.comps === 0
const needsRoutes = (r: ShapingItem) =>
  r.routes === 0 || (r.line_total > 0 && r.routes < r.line_total)
const needsShaping = (r: ShapingItem) => needsComps(r) || needsRoutes(r)

type Filter = 'all' | 'need' | 'no_comps' | 'no_routes'

export function ShapingManager({
  base,
  rootCrumb,
  canEdit,
  items,
}: {
  base: string
  rootCrumb: { label: string; href: string }
  canEdit: boolean
  items: ShapingItem[]
}) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const shown = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return items.filter((r) => {
      if (filter === 'need' && !needsShaping(r)) return false
      if (filter === 'no_comps' && !needsComps(r)) return false
      if (filter === 'no_routes' && !needsRoutes(r)) return false
      if (
        ql &&
        !`${r.code} ${r.order_code} ${r.customer_name}`.toLowerCase().includes(ql)
      )
        return false
      return true
    })
  }, [items, q, filter])

  const columns: Column<ShapingItem>[] = [
    {
      key: 'code',
      header: 'Số LSX',
      sortValue: (r) => r.code,
      width: '130px',
      cell: (r) => (
        <Link
          href={`${base}/${r.id}`}
          className="font-mono font-medium text-sky-600 hover:underline dark:text-sky-400"
        >
          {r.code}
        </Link>
      ),
    },
    {
      key: 'order',
      header: 'Đơn hàng / Khách',
      sortValue: (r) => r.customer_name,
      cell: (r) => (
        <>
          <div className="font-mono text-xs text-zinc-400">{r.order_code}</div>
          <div className="truncate">{r.customer_name}</div>
        </>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      width: '130px',
      sortValue: (r) => r.status,
      cell: (r) => {
        const b = LSX_STATUS[r.status as keyof typeof LSX_STATUS] ?? {
          label: r.status,
          tone: 'gray' as const,
        }
        return <Badge tone={b.tone}>{b.label}</Badge>
      },
    },
    {
      key: 'comps',
      header: 'Bảng chi tiết',
      width: '140px',
      sortValue: (r) => r.comps,
      cell: (r) =>
        r.comps > 0 ? (
          <span className="text-zinc-600 dark:text-zinc-300">
            {r.comps} dòng chi tiết
          </span>
        ) : (
          <Badge tone="amber">Chưa nhập</Badge>
        ),
    },
    {
      key: 'routes',
      header: 'Lộ trình giai đoạn',
      width: '150px',
      sortValue: (r) => (needsRoutes(r) ? 0 : 1),
      cell: (r) => {
        if (r.routes === 0) return <Badge tone="amber">Chưa chốt</Badge>
        if (r.line_total > 0 && r.routes < r.line_total)
          return (
            <Badge tone="amber">
              Đã chốt {r.routes}/{r.line_total} SP
            </Badge>
          )
        return (
          <Badge tone="green">
            Đã chốt {r.line_total > 0 ? `${r.routes}/${r.line_total}` : r.routes} SP
          </Badge>
        )
      },
    },
  ]

  const cntNeed = items.filter(needsShaping).length
  const cntNoComps = items.filter(needsComps).length
  const cntNoRoutes = items.filter(needsRoutes).length

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumbs={[rootCrumb, { label: 'Định hình sản xuất' }]}
        title="Định hình sản xuất"
        description="Kế hoạch lên bảng chi tiết (cụm → chi tiết → định mức) và chốt lộ trình giai đoạn cho từng SP — xong mới tới lượt xưởng nhập sản lượng."
      />

      <StatsBar
        stats={[
          { label: 'Lệnh cần định hình', value: items.length, tone: 'blue' },
          {
            label: 'Còn cần định hình',
            value: cntNeed,
            tone: cntNeed ? 'amber' : 'green',
          },
          {
            label: 'Chưa nhập chi tiết',
            value: cntNoComps,
            tone: cntNoComps ? 'amber' : 'gray',
          },
          {
            label: 'Chưa chốt lộ trình',
            value: cntNoRoutes,
            tone: cntNoRoutes ? 'amber' : 'gray',
          },
        ]}
      />

      <Toolbar
        left={
          <>
            <ToolbarInput
              value={q}
              onChange={setQ}
              placeholder="Tìm mã LSX, đơn, khách…"
              icon="⌕"
              className="w-64"
            />
            <ToolbarSelect
              value={filter}
              onChange={(v) => setFilter(v)}
              options={[
                { value: 'all' as const, label: 'Tất cả' },
                { value: 'need' as const, label: 'Còn cần định hình' },
                { value: 'no_comps' as const, label: 'Chưa nhập chi tiết' },
                { value: 'no_routes' as const, label: 'Chưa chốt lộ trình' },
              ]}
            />
          </>
        }
        right={<span className="text-xs text-zinc-500">{shown.length} lệnh</span>}
      />

      <DataTable<ShapingItem>
        rows={shown}
        columns={columns}
        storageKey="production-shaping"
        rowClassName={(r) => (needsShaping(r) ? '' : 'opacity-70')}
        emptyState={
          <EmptyState
            icon="▣"
            title={
              items.length === 0 ? 'Không có lệnh nào cần định hình' : 'Không khớp bộ lọc'
            }
            description={
              items.length === 0
                ? 'Lệnh sản xuất mới do Sales phát sẽ xuất hiện ở đây.'
                : 'Thử đổi từ khoá hoặc bộ lọc.'
            }
          />
        }
      />

      {!canEdit && (
        <p className="text-xs text-zinc-400">
          Bạn đang xem — định hình là việc của phòng Kế hoạch - Cung ứng / Ban quản lý.
        </p>
      )}
    </div>
  )
}
