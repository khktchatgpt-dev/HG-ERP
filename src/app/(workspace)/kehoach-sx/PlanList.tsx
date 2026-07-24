'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/Badge'
import { PageHeader } from '@/components/erp/PageHeader'
import { StatsBar } from '@/components/erp/StatsBar'
import { Toolbar, ToolbarInput, ToolbarSelect } from '@/components/erp/Toolbar'
import { DataTable, type Column } from '@/components/erp/DataTable'
import { EmptyState } from '@/components/erp/EmptyState'
import { TopProgressBar } from '@/components/erp/Spinner'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'

export type PlanRow = {
  id: string
  code: string
  order_code: string
  customer_name: string
  status: string
  priority: number
  ship_date: string | null
  late: 'overdue' | 'at_risk' | null
  jobs_total: number
  jobs_done: number
  plan_overdue: number
}

type Filter = 'all' | 'no_plan' | 'plan_overdue'

const fmtD = (d: string | null) => (d ? new Date(d).toLocaleDateString('vi-VN') : '—')

export function PlanList({ rows, canEdit }: { rows: PlanRow[]; canEdit: boolean }) {
  const router = useRouter()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [busy, setBusy] = useState(false)

  const noPlan = rows.filter((r) => r.jobs_total === 0).length
  const overdue = rows.filter((r) => r.plan_overdue > 0).length

  const shown = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return (
      rows
        .filter((r) => {
          if (filter === 'no_plan' && r.jobs_total > 0) return false
          if (filter === 'plan_overdue' && r.plan_overdue === 0) return false
          if (
            ql &&
            !`${r.code} ${r.customer_name} ${r.order_code}`.toLowerCase().includes(ql)
          )
            return false
          return true
        })
        // Chưa lên KH nổi lên đầu, rồi theo ưu tiên + hạn xuất.
        .sort(
          (a, b) =>
            (a.jobs_total === 0 ? 0 : 1) - (b.jobs_total === 0 ? 0 : 1) ||
            b.priority - a.priority ||
            (a.ship_date ?? '9999').localeCompare(b.ship_date ?? '9999'),
        )
    )
  }, [rows, q, filter])

  async function setPriority(row: PlanRow, priority: number) {
    setBusy(true)
    try {
      await api(`/api/dept/production/lsx/${row.id}/priority`, {
        method: 'PATCH',
        body: JSON.stringify({ priority }),
      })
      toast.success(`${row.code}: ưu tiên = ${priority}`)
      router.refresh()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Không đổi được ưu tiên')
    } finally {
      setBusy(false)
    }
  }

  const columns: Column<PlanRow>[] = [
    {
      key: 'code',
      header: 'LSX',
      width: '130px',
      cell: (r) => (
        <Link
          href={`/kehoach-sx/${r.id}`}
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
      key: 'plan',
      header: 'Kế hoạch',
      width: '190px',
      cell: (r) =>
        r.jobs_total === 0 ? (
          <Badge tone="amber">Chưa lên lộ trình</Badge>
        ) : (
          <span className="text-sm">
            {r.jobs_done}/{r.jobs_total} công đoạn xong
            {r.plan_overdue > 0 && (
              <Badge tone="red">{` ${r.plan_overdue} quá hạn`}</Badge>
            )}
          </span>
        ),
    },
    {
      key: 'ship',
      header: 'Hạn xuất',
      width: '120px',
      cell: (r) => (
        <span className={r.late === 'overdue' ? 'font-semibold text-red-600' : ''}>
          {fmtD(r.ship_date)}
        </span>
      ),
    },
    {
      key: 'priority',
      header: 'Ưu tiên',
      width: '110px',
      align: 'center',
      cell: (r) =>
        canEdit ? (
          <input
            type="number"
            min={0}
            max={999}
            defaultValue={r.priority}
            onBlur={(e) => {
              const v = Number(e.target.value)
              if (Number.isFinite(v) && v !== r.priority) setPriority(r, v)
            }}
            className="w-16 rounded border border-zinc-300 px-2 py-1 text-center text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        ) : (
          <span>{r.priority}</span>
        ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <TopProgressBar active={busy} />
      <PageHeader
        breadcrumbs={[{ label: 'Kế hoạch sản xuất' }]}
        title="Kế hoạch sản xuất"
        description="Lệnh đã duyệt chờ lên lộ trình công đoạn + giao tổ + hạn. Số ưu tiên lớn = xưởng làm trước."
      />
      <StatsBar
        stats={[
          { label: 'Đang chạy', value: rows.length, tone: 'blue' },
          { label: 'Chưa lên lộ trình', value: noPlan, tone: noPlan ? 'amber' : 'gray' },
          { label: 'Trễ hạn kế hoạch', value: overdue, tone: overdue ? 'red' : 'gray' },
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
                { value: 'no_plan' as const, label: 'Chưa lên lộ trình' },
                { value: 'plan_overdue' as const, label: 'Trễ hạn kế hoạch' },
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
            icon="◈"
            title="Không có lệnh nào"
            description="LSX được Giám đốc duyệt sẽ vào hàng đợi kế hoạch ở đây."
          />
        }
      />
    </div>
  )
}
