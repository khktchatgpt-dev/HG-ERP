'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/Badge'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { api, ApiError } from '@/lib/api'
import { assessLateRisk } from '@/lib/late-risk'
import { orderProgress, STATUS_LABEL } from '@/lib/order-progress'
import { PageHeader } from '@/components/erp/PageHeader'
import { StatsBar } from '@/components/erp/StatsBar'
import { Toolbar, ToolbarInput, ToolbarSelect } from '@/components/erp/Toolbar'
import { DataTable, type Column } from '@/components/erp/DataTable'
import { EmptyState } from '@/components/erp/EmptyState'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'

type Row = {
  id: string
  code: string
  customer_id: string
  customer_name: string
  customer_po_no: string | null
  status: string
  currency: string
  due_date: string | null
  quote_code: string | null
  production_order_id: string | null
  lsx_code: string | null
  lsx_status: string | null
  jobs_total: number
  jobs_done: number
  ship_date: string | null
  lines_bom_pending: number
  pos_open: number
  created_at: string
}

type Stage = { code: string; label: string }

export function TrackingManager({
  rows,
  stages,
  canManage,
  lsxBase = '/sales/lsx',
}: {
  rows: Row[]
  stages: Stage[]
  canManage: boolean
  /** Gốc link chi tiết LSX theo shell đang đứng — không nhảy giao diện phòng khác. */
  lsxBase?: string
}) {
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const today = new Date().toISOString().slice(0, 10)
  // FR-SAL-09: nguy cơ trễ = sát/quá hạn giao + lý do (BOM, vật tư, LSX chưa chạy).
  const riskOf = (r: Row) => assessLateRisk(r, today)
  const isLate = (r: Row) => riskOf(r)?.level === 'overdue'

  // Tiến độ giản lược (P5) — dùng helper chung với màn Quản lý đơn hàng (GĐ).
  const simpleProgress = (r: Row) => orderProgress(r, stages, today)

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return rows.filter((r) => {
      if (statusFilter === 'late' && !isLate(r)) return false
      if (statusFilter === 'risk' && !riskOf(r)) return false
      if (
        statusFilter !== 'all' &&
        statusFilter !== 'late' &&
        statusFilter !== 'risk' &&
        r.status !== statusFilter
      )
        return false
      if (
        ql &&
        !`${r.code} ${r.customer_name} ${r.customer_po_no ?? ''} ${r.lsx_code ?? ''}`
          .toLowerCase()
          .includes(ql)
      )
        return false
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, statusFilter])

  const stats = useMemo(() => {
    let bomPending = 0
    let posOpen = 0
    let late = 0
    let risk = 0
    let inProd = 0
    for (const r of rows) {
      if (r.lines_bom_pending > 0 && r.status !== 'cancelled') bomPending++
      if (r.pos_open > 0) posOpen++
      const rk = riskOf(r)
      if (rk?.level === 'overdue') late++
      else if (rk) risk++
      if (r.status === 'in_production') inProd++
    }
    return { bomPending, posOpen, late, risk, inProd }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows])

  async function completeLsx(r: Row) {
    if (!r.production_order_id) return
    const ok = await confirm({
      title: `Báo hoàn thành ${r.lsx_code}?`,
      description: 'Đơn hàng sẽ chuyển sang Hoàn thành để giao hàng.',
      confirmLabel: 'Hoàn thành',
    })
    if (!ok) return
    setBusy(true)
    try {
      await api(`/api/dept/production/lsx/${r.production_order_id}/complete`, {
        method: 'POST',
        body: {},
      })
      toast.success('LSX hoàn thành', r.lsx_code ?? '')
      router.refresh()
    } catch (e) {
      toast.error('Thao tác thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  const columns: Column<Row>[] = [
    {
      key: 'code',
      header: 'Đơn / Khách',
      sortValue: (r) => r.code,
      cell: (r) => (
        <div className="flex min-w-0 flex-col">
          <span className="font-mono text-xs text-zinc-400">
            {r.code}
            {r.customer_po_no && <span className="ml-1">· PO {r.customer_po_no}</span>}
          </span>
          <span className="truncate font-medium">{r.customer_name}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Tiến độ',
      sortValue: (r) => simpleProgress(r).pct,
      width: '170px',
      cell: (r) => {
        const p = simpleProgress(r)
        return (
          <div
            className="flex flex-col gap-1"
            title={`${STATUS_LABEL[r.status] ?? r.status}${riskOf(r)?.reasons.length ? ` — ${riskOf(r)!.reasons.join(' · ')}` : ''}`}
          >
            <span className="flex items-center gap-1.5 text-xs font-medium">
              <span className={`h-2 w-2 shrink-0 rounded-full ${p.tone}`} />
              {p.label}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                <span
                  className={`block h-full rounded-full ${p.tone}`}
                  style={{ width: `${p.pct}%` }}
                />
              </span>
              <span className="w-8 shrink-0 text-right text-[10px] text-zinc-400 tabular-nums">
                {p.pct}%
              </span>
            </span>
          </div>
        )
      },
    },
    {
      key: 'lsx',
      header: 'LSX / Giai đoạn',
      width: '190px',
      cell: (r) => {
        if (!r.lsx_code)
          return <span className="text-xs text-zinc-400">Chưa phát LSX</span>
        // LSX huỷ theo đơn: chỉ hiện link, không cho đổi giai đoạn.
        const done = r.lsx_status === 'completed' || r.lsx_status === 'cancelled'
        return (
          <div className="flex flex-col gap-1">
            <a
              href={`${lsxBase}/${r.production_order_id}`}
              className="font-mono text-xs text-blue-600 hover:underline dark:text-blue-400"
              title="Chi tiết lệnh sản xuất"
            >
              {r.lsx_code} →
            </a>
            <Badge tone={done ? 'green' : r.jobs_done > 0 ? 'amber' : 'gray'}>
              {done
                ? 'Hoàn thành'
                : r.jobs_total > 0
                  ? `${r.jobs_done}/${r.jobs_total} công đoạn`
                  : 'Chưa lên kế hoạch'}
            </Badge>
          </div>
        )
      },
    },
    {
      key: 'bom',
      header: 'BOM',
      sortValue: (r) => r.lines_bom_pending,
      width: '100px',
      cell: (r) =>
        r.lines_bom_pending > 0 ? (
          <Badge tone="amber">Thiếu {r.lines_bom_pending} SP</Badge>
        ) : (
          <Badge tone="green">Đủ</Badge>
        ),
    },
    {
      key: 'po',
      header: 'Vật tư (PO mở)',
      sortValue: (r) => r.pos_open,
      width: '110px',
      cell: (r) =>
        r.pos_open > 0 ? (
          <Badge tone="amber">{r.pos_open} PO chờ</Badge>
        ) : (
          <span className="text-xs text-zinc-400">—</span>
        ),
    },
    {
      key: 'due',
      header: 'Hạn giao / Ngày xuất',
      sortValue: (r) => r.due_date ?? '9999',
      width: '140px',
      cell: (r) => (
        <div className="flex flex-col text-xs">
          {r.due_date && (
            <span
              className={
                riskOf(r)
                  ? riskOf(r)!.level === 'overdue'
                    ? 'font-medium text-red-600'
                    : 'font-medium text-amber-600'
                  : ''
              }
              title={riskOf(r)?.reasons.join(' · ') || undefined}
            >
              Hạn: {new Date(r.due_date).toLocaleDateString('vi-VN')}
              {riskOf(r) && ' ⚠'}
            </span>
          )}
          {r.ship_date && (
            <span className="text-zinc-500">
              Xuất: {new Date(r.ship_date).toLocaleDateString('vi-VN')}
            </span>
          )}
          {!r.due_date && !r.ship_date && <span className="text-zinc-400">—</span>}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '110px',
      align: 'right',
      cell: (r) =>
        canManage &&
        r.production_order_id &&
        r.lsx_status !== 'completed' &&
        r.lsx_status !== 'cancelled' ? (
          <button
            onClick={() => void completeLsx(r)}
            className="rounded-md border border-green-300 px-2 py-1 text-xs text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950"
          >
            ✓ Hoàn thành
          </button>
        ) : null,
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <TopProgressBar active={busy} />
      <PageHeader
        breadcrumbs={[
          { label: 'Kinh doanh', href: '/sales' },
          { label: 'Theo dõi đơn hàng' },
        ]}
        title="Theo dõi đơn hàng"
        description="Trạng thái tổng hợp để trả lời khách: BOM, vật tư, tiến độ sản xuất, hạn giao (FR-SAL-07)."
      />

      <StatsBar
        stats={[
          { label: 'Tổng đơn', value: rows.length, tone: 'default' },
          { label: 'Đang sản xuất', value: stats.inProd, tone: 'amber' },
          {
            label: 'Chờ BOM',
            value: stats.bomPending,
            tone: stats.bomPending ? 'amber' : 'gray',
          },
          {
            label: 'Chờ vật tư',
            value: stats.posOpen,
            tone: stats.posOpen ? 'amber' : 'gray',
          },
          {
            label: 'Nguy cơ trễ',
            value: stats.risk,
            tone: stats.risk ? 'amber' : 'gray',
          },
          { label: 'Trễ hạn', value: stats.late, tone: stats.late ? 'red' : 'gray' },
        ]}
      />

      <div>
        <Toolbar
          left={
            <>
              <ToolbarInput
                value={q}
                onChange={setQ}
                placeholder="Tìm đơn, PO khách, LSX…"
                icon="⌕"
                className="w-72"
              />
              <ToolbarSelect
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: 'all', label: 'Tất cả' },
                  { value: 'risk', label: '⚠ Nguy cơ trễ' },
                  { value: 'late', label: '⚠ Trễ hạn' },
                  ...Object.entries(STATUS_LABEL).map(([v, l]) => ({
                    value: v,
                    label: l,
                  })),
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

        <DataTable<Row>
          rows={filtered}
          columns={columns}
          storageKey="sales-tracking"
          rowClassName={(r) => (r.status === 'cancelled' ? 'opacity-60' : '')}
          emptyState={
            <EmptyState
              icon="◎"
              title={rows.length === 0 ? 'Chưa có đơn hàng nào' : 'Không khớp bộ lọc'}
              description="Tạo đơn từ báo giá đã duyệt rồi phát LSX — trạng thái sẽ hiện ở đây."
            />
          }
        />
      </div>
    </div>
  )
}
