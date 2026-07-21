'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, Flame, Package, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { assessLateRisk } from '@/lib/late-risk'
import { orderProgress, type Stage } from '@/lib/order-progress'
import { Button } from '@/components/shadcn/button'
import { PageHeader } from '@/components/erp/PageHeader'
import { EmptyState } from '@/components/erp/EmptyState'
import { fmtD } from '../approval-parts'
import type { OrderRow } from '../orders/OrdersOverview'
import { KpiCard, ProgressMeter, fmtMoney } from '../orders/order-parts'

type Health = 'overdue' | 'incident' | 'at_risk' | 'blocked' | 'ok'

const HEALTH_FILTERS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'late', label: '⚠ Trễ / nguy cơ' },
  { key: 'blocked', label: 'Chờ vật tư/BOM' },
  { key: 'incident', label: 'Có sự cố' },
] as const
type HealthFilter = (typeof HEALTH_FILTERS)[number]['key']

// Cột cố định 2 đầu; ở giữa là các công đoạn từ danh mục.
const PENDING = 'pending'
const READY = 'ready'
const DONE = 'done'

export function ProductionPipeline({
  rows,
  stages,
  incidentLsxIds,
  todayQty,
  defectRate,
}: {
  rows: OrderRow[]
  stages: Stage[]
  incidentLsxIds: string[]
  todayQty: number
  defectRate: number
}) {
  const today = new Date().toISOString().slice(0, 10)
  const [q, setQ] = useState('')
  const [health, setHealth] = useState<HealthFilter>('all')

  const incidentSet = useMemo(() => new Set(incidentLsxIds), [incidentLsxIds])
  const stageCodes = useMemo(() => new Set(stages.map((s) => s.code)), [stages])

  const riskOf = (r: OrderRow) => assessLateRisk(r, today)

  const healthOf = (r: OrderRow): Health => {
    const risk = riskOf(r)
    if (risk?.level === 'overdue') return 'overdue'
    if (r.production_order_id && incidentSet.has(r.production_order_id)) return 'incident'
    if (risk?.level === 'at_risk') return 'at_risk'
    if (r.lines_bom_pending > 0 || r.pos_open > 0) return 'blocked'
    return 'ok'
  }

  /** LSX thuộc cột nào; null = ngoài dây chuyền (loại khỏi board). */
  const columnKeyOf = (r: OrderRow): string | null => {
    if (['delivered', 'cancelled'].includes(r.status)) return null
    if (['rejected', 'cancelled'].includes(r.lsx_status ?? '')) return null
    if (r.status === 'completed' || r.lsx_status === 'completed') return DONE
    if (r.lsx_status === 'pending_approval') return PENDING
    if (!r.production_order_id) return null // chưa phát LSX — chưa vào SX
    if (r.current_stage && stageCodes.has(r.current_stage)) return r.current_stage
    return READY
  }

  // ── Lọc + gom theo cột ────────────────────────────────────────────────────
  const { grouped, running } = useMemo(() => {
    const ql = q.trim().toLowerCase()
    const map = new Map<string, OrderRow[]>()
    const run: OrderRow[] = []
    for (const r of rows) {
      const key = columnKeyOf(r)
      if (!key) continue
      if (
        ql &&
        !`${r.code} ${r.customer_name} ${r.customer_po_no ?? ''} ${r.lsx_code ?? ''}`
          .toLowerCase()
          .includes(ql)
      )
        continue
      const h = healthOf(r)
      if (health === 'late' && h !== 'overdue' && h !== 'at_risk') continue
      if (health === 'blocked' && !(r.lines_bom_pending > 0 || r.pos_open > 0)) continue
      if (health === 'incident' && h !== 'incident') continue
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
      if (key !== DONE) run.push(r)
    }
    // Trong mỗi cột: sức khoẻ xấu lên trước, rồi hạn giao gần.
    const rank = (r: OrderRow) => {
      const h = healthOf(r)
      return h === 'overdue' || h === 'incident'
        ? 0
        : h === 'at_risk' || h === 'blocked'
          ? 1
          : 2
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          rank(a) - rank(b) || (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'),
      )
    }
    return { grouped: map, running: run }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, health])

  const columns = useMemo(
    () => [
      { key: PENDING, label: 'Chờ duyệt', kind: 'pending' as const },
      { key: READY, label: 'Chuẩn bị SX', kind: 'ready' as const },
      ...stages.map((s) => ({ key: s.code, label: s.label, kind: 'stage' as const })),
      { key: DONE, label: 'Hoàn thành', kind: 'done' as const },
    ],
    [stages],
  )

  // Nút thắt = công đoạn (kind stage) có nhiều LSX nhất.
  const bottleneck = useMemo(() => {
    let best: { key: string; label: string; count: number } | null = null
    for (const c of columns) {
      if (c.kind !== 'stage') continue
      const n = grouped.get(c.key)?.length ?? 0
      if (n > 0 && (!best || n > best.count))
        best = { key: c.key, label: c.label, count: n }
    }
    return best
  }, [columns, grouped])

  const kpi = useMemo(() => {
    let late = 0
    let blocked = 0
    for (const r of running) {
      const h = healthOf(r)
      if (h === 'overdue' || h === 'at_risk') late++
      if (r.lines_bom_pending > 0 || r.pos_open > 0) blocked++
    }
    return { running: running.length, late, blocked }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumbs={[
          { label: 'Ban Giám đốc', href: '/exec' },
          { label: 'Tiến độ sản xuất' },
        ]}
        title="Tiến độ sản xuất"
        description="Toàn bộ lệnh sản xuất theo công đoạn dây chuyền — nút thắt, hạn giao, năng suất, chất lượng."
      />

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="Đang chạy" value={kpi.running} hint="LSX trong dây chuyền" />
        <KpiCard
          label="Nút thắt"
          value={bottleneck ? bottleneck.count : 0}
          hint={bottleneck ? bottleneck.label : 'Không có'}
          tone={bottleneck ? 'amber' : 'default'}
        />
        <KpiCard
          label="Trễ / nguy cơ"
          value={kpi.late}
          tone={kpi.late ? 'red' : 'default'}
        />
        <KpiCard
          label="Chờ vật tư/BOM"
          value={kpi.blocked}
          tone={kpi.blocked ? 'amber' : 'default'}
        />
        <KpiCard
          label="Sản lượng hôm nay"
          value={todayQty.toLocaleString('vi-VN')}
          hint="chi tiết đã làm"
          tone="emerald"
        />
        <KpiCard
          label="Tỷ lệ phế 7 ngày"
          value={`${defectRate.toFixed(1)}%`}
          tone={defectRate >= 3 ? 'red' : defectRate > 0 ? 'amber' : 'emerald'}
        />
      </div>

      {/* Lọc */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm đơn, khách, PO, LSX…"
            className="bg-card focus-visible:ring-ring/40 h-9 w-64 rounded-lg border border-zinc-200/70 py-1 pr-3 pl-8 text-sm shadow-sm outline-none focus-visible:border-zinc-300 focus-visible:ring-[3px] dark:border-zinc-800"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {HEALTH_FILTERS.map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={health === f.key ? 'default' : 'outline'}
              onClick={() => setHealth(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Kanban */}
      {running.length === 0 && (grouped.get(DONE)?.length ?? 0) === 0 ? (
        <EmptyState
          icon="▦"
          title="Không có lệnh sản xuất khớp bộ lọc"
          description="Đơn đã phát LSX sẽ xuất hiện theo công đoạn ở đây."
        />
      ) : (
        <div className="-mx-1 overflow-x-auto pb-2">
          <div className="flex min-w-max gap-3 px-1">
            {columns.map((c) => {
              const list = grouped.get(c.key) ?? []
              const isBottleneck = bottleneck?.key === c.key
              return (
                <section
                  key={c.key}
                  className="flex w-64 shrink-0 flex-col rounded-xl border border-zinc-200/70 bg-zinc-50/40 dark:border-zinc-800 dark:bg-zinc-900/30"
                >
                  <header
                    className={cn(
                      'flex items-center justify-between rounded-t-xl border-b px-3 py-2',
                      isBottleneck
                        ? 'border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30'
                        : 'border-zinc-200/70 dark:border-zinc-800',
                    )}
                  >
                    <span
                      className={cn(
                        'truncate text-sm font-semibold',
                        isBottleneck && 'text-red-700 dark:text-red-300',
                      )}
                    >
                      {c.label}
                    </span>
                    <span
                      className={cn(
                        'ml-2 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums',
                        isBottleneck
                          ? 'bg-red-600 text-white'
                          : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
                      )}
                    >
                      {list.length}
                    </span>
                  </header>
                  <div className="flex max-h-[65vh] flex-col gap-2 overflow-y-auto p-2">
                    {list.length === 0 ? (
                      <p className="text-muted-foreground px-1 py-3 text-center text-xs">
                        —
                      </p>
                    ) : (
                      list.map((r) => (
                        <LsxCard
                          key={r.id}
                          r={r}
                          progress={orderProgress(r, stages, today)}
                          health={healthOf(r)}
                          hasIncident={
                            !!r.production_order_id &&
                            incidentSet.has(r.production_order_id)
                          }
                        />
                      ))
                    )}
                  </div>
                </section>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

const HEALTH_RAIL: Record<Health, string> = {
  overdue: 'before:bg-red-500',
  incident: 'before:bg-red-500',
  at_risk: 'before:bg-amber-400',
  blocked: 'before:bg-amber-400',
  ok: 'before:bg-emerald-400/70',
}

function LsxCard({
  r,
  progress,
  health,
  hasIncident,
}: {
  r: OrderRow
  progress: ReturnType<typeof orderProgress>
  health: Health
  hasIncident: boolean
}) {
  const href = r.production_order_id ? `/exec/lsx/${r.production_order_id}` : undefined
  const late = health === 'overdue'
  const atRisk = health === 'at_risk'
  return (
    <a
      href={href}
      className={cn(
        'group bg-card relative block overflow-hidden rounded-lg border border-zinc-200/70 py-2 pr-2.5 pl-3 shadow-sm transition-all hover:shadow-md dark:border-zinc-800',
        "before:absolute before:inset-y-1.5 before:left-0 before:w-1 before:rounded-full before:content-['']",
        HEALTH_RAIL[health],
      )}
    >
      <div className="flex items-start justify-between gap-1.5">
        <span className="text-muted-foreground truncate font-mono text-[10px]">
          {r.code}
        </span>
        <span className="shrink-0 text-xs font-semibold tabular-nums">
          {fmtMoney(r.order_value, r.currency)}
        </span>
      </div>
      <div className="truncate text-sm font-medium">{r.customer_name}</div>
      <div className="mt-1.5">
        <ProgressMeter p={progress} showLabel={false} />
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        {r.due_date && (
          <span
            className={cn(
              'text-[10px]',
              late
                ? 'font-medium text-red-600 dark:text-red-400'
                : atRisk
                  ? 'font-medium text-amber-600 dark:text-amber-400'
                  : 'text-muted-foreground',
            )}
          >
            Hạn {fmtD(r.due_date)}
            {(late || atRisk) && ' ⚠'}
          </span>
        )}
        {hasIncident && (
          <span className="inline-flex items-center gap-0.5 rounded bg-red-50 px-1 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">
            <Flame className="size-3" /> Sự cố
          </span>
        )}
        {r.lines_bom_pending > 0 && (
          <span className="inline-flex items-center gap-0.5 rounded bg-amber-50 px-1 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            <AlertTriangle className="size-3" /> BOM {r.lines_bom_pending}
          </span>
        )}
        {r.pos_open > 0 && (
          <span className="inline-flex items-center gap-0.5 rounded bg-amber-50 px-1 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            <Package className="size-3" /> {r.pos_open} PO
          </span>
        )}
      </div>
    </a>
  )
}
