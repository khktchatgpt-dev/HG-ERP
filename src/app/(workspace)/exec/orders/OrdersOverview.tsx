'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Package,
  PackageCheck,
  Play,
  Search,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { api, apiErrorText } from '@/lib/api'
import { assessLateRisk } from '@/lib/late-risk'
import { orderProgress, type Stage } from '@/lib/order-progress'
import { Card, CardContent } from '@/components/shadcn/card'
import { Button } from '@/components/shadcn/button'
import { PageHeader } from '@/components/erp/PageHeader'
import { EmptyState } from '@/components/erp/EmptyState'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'
import {
  Fact,
  Signal,
  SectionLabel,
  LsxProductTable,
  fmtD,
  daysUntil,
  dueBadge,
  DUE_TEXT,
} from '../approval-parts'
import type { ApprovalLsxLine } from '../approval-types'
import { useApprovalDecision, targetLsx } from '../useApprovalDecision'
import {
  KpiCard,
  LifecycleTimeline,
  ProgressMeter,
  StatusBadge,
  fmtMoney,
} from './order-parts'

export type OrderRow = {
  id: string
  code: string
  customer_name: string
  customer_po_no: string | null
  status: string
  currency: string
  due_date: string | null
  quote_code: string | null
  production_order_id: string | null
  lsx_code: string | null
  lsx_status: string | null
  lsx_priority: number | null
  jobs_total: number
  jobs_done: number
  ship_date: string | null
  lines_bom_pending: number
  pos_open: number
  deposit_percent: number | null
  payment_method: string | null
  order_value: number
  line_count: number
  created_at: string
}

const FINAL = new Set(['delivered', 'cancelled'])

/** VND lớn → tỷ/tr cho KPI; ngoại tệ giữ nguyên số. */
function fmtMoneyShort(value: number, currency: string): string {
  if (currency === 'VND') {
    if (value >= 1_000_000_000)
      return `${(value / 1_000_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tỷ ₫`
    if (value >= 1_000_000)
      return `${(value / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 0 })} tr ₫`
    return `${value.toLocaleString('vi-VN')} ₫`
  }
  return `${value.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} ${currency}`
}

const SEGMENTS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'pending', label: 'Chờ GĐ duyệt' },
  { key: 'inprod', label: 'Đang sản xuất' },
  { key: 'risk', label: '⚠ Nguy cơ trễ' },
  { key: 'to_deliver', label: 'Chờ giao' },
] as const
type SegmentKey = (typeof SEGMENTS)[number]['key']

/** Số mục hiện mỗi trang — render tăng dần để không phình DOM khi nhiều đơn. */
const PAGE = 60

const SORTS = [
  { key: 'health', label: 'Ưu tiên (rủi ro)' },
  { key: 'value', label: 'Giá trị cao' },
  { key: 'due', label: 'Hạn giao gần' },
  { key: 'recent', label: 'Mới nhất' },
] as const
type SortKey = (typeof SORTS)[number]['key']

export function OrdersOverview({ rows, stages }: { rows: OrderRow[]; stages: Stage[] }) {
  const router = useRouter()
  const today = new Date().toISOString().slice(0, 10)
  const [q, setQ] = useState('')
  const [seg, setSeg] = useState<SegmentKey>('all')
  const [sort, setSort] = useState<SortKey>('health')
  const [limit, setLimit] = useState(PAGE)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const detailRef = useRef<HTMLDivElement>(null)

  // Đổi lọc/tìm/sắp xếp → về trang đầu (reset ngay trong handler, không dùng effect).
  const resetPage = () => setLimit(PAGE)

  const { busy, askApprove, askReject, dialogs } = useApprovalDecision(() =>
    router.refresh(),
  )

  const riskOf = (r: OrderRow) => assessLateRisk(r, today)
  const progressOf = (r: OrderRow) => orderProgress(r, stages, today)

  // ── KPI ─────────────────────────────────────────────────────────────────
  const kpi = useMemo(() => {
    const bookByCur = new Map<string, number>()
    let activeCount = 0
    let inProd = 0
    let pending = 0
    let atRisk = 0
    let overdue = 0
    let dueSoon = 0
    for (const r of rows) {
      const active = !FINAL.has(r.status)
      if (active) {
        activeCount++
        bookByCur.set(r.currency, (bookByCur.get(r.currency) ?? 0) + r.order_value)
      }
      if (r.status === 'in_production') inProd++
      if (r.lsx_status === 'pending_approval') pending++
      const risk = riskOf(r)
      if (risk?.level === 'overdue') overdue++
      else if (risk?.level === 'at_risk') atRisk++
      const d = daysUntil(r.due_date, today)
      if (active && d != null && d >= 0 && d <= 7) dueSoon++
    }
    const book =
      [...bookByCur.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([cur, v]) => fmtMoneyShort(v, cur))
        .join(' · ') || '—'
    return { book, activeCount, inProd, pending, atRisk, overdue, dueSoon }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows])

  // ── Lọc + sắp xếp (theo lựa chọn) ─────────────────────────────────────────
  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    const rank = (r: OrderRow) => {
      const risk = riskOf(r)
      if (risk?.level === 'overdue') return 0
      if (r.lsx_status === 'pending_approval') return 1
      if (risk?.level === 'at_risk') return 2
      return 3
    }
    const cmp: Record<SortKey, (a: OrderRow, b: OrderRow) => number> = {
      health: (a, b) => rank(a) - rank(b) || b.order_value - a.order_value,
      value: (a, b) => b.order_value - a.order_value,
      due: (a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'),
      recent: (a, b) => b.created_at.localeCompare(a.created_at),
    }
    return rows
      .filter((r) => {
        if (seg === 'pending' && r.lsx_status !== 'pending_approval') return false
        if (seg === 'inprod' && r.status !== 'in_production') return false
        if (seg === 'risk' && !riskOf(r)) return false
        if (seg === 'to_deliver' && r.status !== 'completed') return false
        if (
          ql &&
          !`${r.code} ${r.customer_name} ${r.customer_po_no ?? ''} ${r.lsx_code ?? ''}`
            .toLowerCase()
            .includes(ql)
        )
          return false
        return true
      })
      .sort(cmp[sort])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, seg, sort])

  const shown = filtered.slice(0, limit)
  const selected = filtered.find((r) => r.id === selectedId) ?? null

  function selectRow(r: OrderRow) {
    setSelectedId(r.id)
    // Mobile: cuộn tới panel chi tiết (nằm dưới danh sách).
    requestAnimationFrame(() => {
      if (window.matchMedia('(max-width: 1023px)').matches) {
        detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <TopProgressBar active={busy} />
      <PageHeader
        breadcrumbs={[
          { label: 'Ban Giám đốc', href: '/exec' },
          { label: 'Quản lý đơn hàng' },
        ]}
        title="Quản lý đơn hàng"
        description="Sổ đơn theo giá trị & hạn giao, tiến độ sản xuất hiện tại từng đơn — duyệt LSX tại chỗ."
      />

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          label="Sổ đơn đang chạy"
          value={kpi.book}
          hint={`${kpi.activeCount} đơn mở`}
        />
        <KpiCard label="Đang sản xuất" value={kpi.inProd} />
        <KpiCard
          label="Chờ GĐ duyệt"
          value={kpi.pending}
          tone={kpi.pending ? 'amber' : 'default'}
        />
        <KpiCard label="Sắp giao ≤7 ngày" value={kpi.dueSoon} />
        <KpiCard
          label="Nguy cơ trễ"
          value={kpi.atRisk}
          tone={kpi.atRisk ? 'amber' : 'default'}
        />
        <KpiCard
          label="Trễ hạn"
          value={kpi.overdue}
          tone={kpi.overdue ? 'red' : 'default'}
        />
      </div>

      {/* Bộ lọc */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              resetPage()
            }}
            placeholder="Tìm đơn, khách, PO, LSX…"
            className="bg-card focus-visible:ring-ring/40 h-9 w-64 rounded-lg border border-zinc-200/70 py-1 pr-3 pl-8 text-sm shadow-sm outline-none focus-visible:border-zinc-300 focus-visible:ring-[3px] dark:border-zinc-800"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SEGMENTS.map((s) => (
            <Button
              key={s.key}
              size="sm"
              variant={seg === s.key ? 'default' : 'outline'}
              onClick={() => {
                setSeg(s.key)
                resetPage()
              }}
            >
              {s.label}
            </Button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-muted-foreground text-xs tabular-nums">
            {filtered.length} đơn
          </span>
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as SortKey)
              resetPage()
            }}
            className="bg-card h-9 rounded-lg border border-zinc-200/70 px-2 text-sm shadow-sm outline-none dark:border-zinc-800"
            aria-label="Sắp xếp"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Master + Detail */}
      <div className="lg:grid lg:grid-cols-12 lg:gap-4">
        {/* Danh sách đơn — hàng gọn, render tăng dần */}
        <div className="flex flex-col gap-1.5 lg:col-span-5">
          {filtered.length === 0 ? (
            <EmptyState
              icon="◫"
              title={rows.length === 0 ? 'Chưa có đơn hàng nào' : 'Không khớp bộ lọc'}
              description="Đơn Sales tạo & phát LSX sẽ hiện ở đây để GĐ theo dõi và duyệt."
            />
          ) : (
            <>
              {shown.map((r) => {
                const p = progressOf(r)
                const risk = riskOf(r)
                const active = selected?.id === r.id
                return (
                  <button
                    key={r.id}
                    onClick={() => selectRow(r)}
                    className={cn(
                      'group bg-card relative w-full overflow-hidden rounded-lg border py-2 pr-2.5 pl-3.5 text-left shadow-sm transition-all duration-150',
                      "before:absolute before:inset-y-1.5 before:left-0 before:w-1 before:rounded-full before:transition-colors before:content-['']",
                      active
                        ? 'border-zinc-300 bg-zinc-50/80 shadow before:bg-zinc-900 dark:border-zinc-700 dark:bg-zinc-800/40 dark:before:bg-zinc-100'
                        : 'border-zinc-200/70 before:bg-transparent hover:border-zinc-300 hover:shadow-md hover:before:bg-zinc-200 dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:before:bg-zinc-700',
                      r.status === 'cancelled' && 'opacity-60',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground truncate font-mono text-[10px]">
                        {r.code}
                        {r.customer_po_no && <span> · PO {r.customer_po_no}</span>}
                      </span>
                      <StatusBadge status={r.status} />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">
                        {r.customer_name}
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">
                        {fmtMoney(r.order_value, r.currency)}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <ProgressMeter p={p} showLabel={false} />
                      </div>
                      <span
                        className={cn(
                          'shrink-0 text-[10px] tabular-nums',
                          risk
                            ? DUE_TEXT[risk.level === 'overdue' ? 'red' : 'amber']
                            : 'text-muted-foreground',
                        )}
                      >
                        {r.due_date ? `${fmtD(r.due_date)}${risk ? ' ⚠' : ''}` : '—'}
                      </span>
                    </div>
                  </button>
                )
              })}
              {filtered.length > shown.length && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-1 w-full"
                  onClick={() => setLimit((n) => n + PAGE)}
                >
                  Tải thêm (còn {filtered.length - shown.length})
                </Button>
              )}
            </>
          )}
        </div>

        {/* Chi tiết */}
        <div ref={detailRef} className="mt-4 lg:col-span-7 lg:mt-0">
          <div className="lg:sticky lg:top-4">
            {selected ? (
              <OrderDetail
                r={selected}
                progress={progressOf(selected)}
                risk={riskOf(selected)}
                stages={stages}
                busy={busy}
                onApprove={() =>
                  selected.production_order_id &&
                  askApprove(
                    targetLsx({
                      id: selected.production_order_id,
                      code: selected.lsx_code ?? selected.code,
                      customer_name: selected.customer_name,
                      order_code: selected.code,
                    }),
                  )
                }
                onReject={() =>
                  selected.production_order_id &&
                  askReject(
                    targetLsx({
                      id: selected.production_order_id,
                      code: selected.lsx_code ?? selected.code,
                      customer_name: selected.customer_name,
                      order_code: selected.code,
                    }),
                  )
                }
              />
            ) : (
              <Card className="border-zinc-200/70 shadow-sm dark:border-zinc-800">
                <CardContent>
                  <EmptyState
                    icon="◧"
                    title="Chọn một đơn để xem chi tiết"
                    description="Thông tin thương mại, vòng đời, tiến độ sản xuất và hành động duyệt hiện ở đây."
                  />
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {dialogs}
    </div>
  )
}

// ── Panel chi tiết 1 đơn ────────────────────────────────────────────────────
function OrderDetail({
  r,
  progress,
  risk,
  stages,
  busy,
  onApprove,
  onReject,
}: {
  r: OrderRow
  progress: ReturnType<typeof orderProgress>
  risk: ReturnType<typeof assessLateRisk>
  stages: Stage[]
  busy: boolean
  onApprove: () => void
  onReject: () => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const due = dueBadge(daysUntil(r.due_date, today))
  const stageLabel =
    r.jobs_total > 0 ? `${r.jobs_done}/${r.jobs_total} công đoạn` : null
  const pendingApproval = r.lsx_status === 'pending_approval'
  const lsxHref = r.production_order_id ? `/exec/lsx/${r.production_order_id}` : null

  return (
    <Card className="gap-4 border-zinc-200/70 shadow-sm dark:border-zinc-800">
      <CardContent className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-zinc-100 pb-3 dark:border-zinc-800/70">
          <div className="min-w-0">
            <div className="text-muted-foreground font-mono text-xs">{r.code}</div>
            <h2 className="truncate text-lg font-bold">{r.customer_name}</h2>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="text-lg font-bold tabular-nums">
              {fmtMoney(r.order_value, r.currency)}
            </div>
            <StatusBadge status={r.status} />
          </div>
        </div>

        {/* Vòng đời */}
        <div className="rounded-lg border border-zinc-100 bg-zinc-50/60 px-3 py-3 dark:border-zinc-800/70 dark:bg-zinc-900/40">
          <LifecycleTimeline status={r.status} />
        </div>

        {/* Tiến độ SX */}
        <div>
          <SectionLabel>Tiến độ sản xuất</SectionLabel>
          <div className="mt-2">
            <ProgressMeter p={progress} />
          </div>
        </div>

        {/* Rủi ro */}
        {risk ? (
          <Signal tone={risk.level === 'overdue' ? 'alert' : 'warn'}>
            {risk.level === 'overdue' ? 'Đã trễ hạn giao' : 'Nguy cơ trễ'}
            {risk.reasons.length > 0 && `: ${risk.reasons.join(' · ')}`}
          </Signal>
        ) : (
          !FINAL.has(r.status) && <Signal tone="ok">Chưa có cảnh báo trễ</Signal>
        )}

        {/* Thương mại */}
        <div className="rounded-lg border border-zinc-100 bg-zinc-50/40 p-3 dark:border-zinc-800/70 dark:bg-zinc-900/30">
          <SectionLabel>Thương mại</SectionLabel>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
            {r.customer_po_no && <Fact label="PO khách">{r.customer_po_no}</Fact>}
            <Fact label="Giá trị đơn">{fmtMoney(r.order_value, r.currency)}</Fact>
            <Fact label="Số dòng SP">{r.line_count}</Fact>
            {r.deposit_percent != null && (
              <Fact label="Đặt cọc">{r.deposit_percent}%</Fact>
            )}
            {r.payment_method && <Fact label="Phương thức TT">{r.payment_method}</Fact>}
            <Fact label="Hạn giao" tone={due.tone}>
              {r.due_date ? `${fmtD(r.due_date)} · ${due.text}` : '—'}
            </Fact>
            {r.ship_date && <Fact label="Ngày xuất (dự kiến)">{fmtD(r.ship_date)}</Fact>}
            {r.quote_code && <Fact label="Từ báo giá">{r.quote_code}</Fact>}
          </dl>
        </div>

        {/* Hồ sơ sản xuất */}
        <div className="rounded-lg border border-zinc-100 bg-zinc-50/40 p-3 dark:border-zinc-800/70 dark:bg-zinc-900/30">
          <div className="flex items-center justify-between">
            <SectionLabel>Hồ sơ sản xuất</SectionLabel>
            {lsxHref && (
              <a
                href={lsxHref}
                className="text-[11px] font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                {r.lsx_code} →
              </a>
            )}
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
            <Fact label="Giai đoạn hiện tại">{stageLabel ?? 'Chưa bắt đầu'}</Fact>
            <Fact label="BOM" tone={r.lines_bom_pending > 0 ? 'amber' : undefined}>
              {r.lines_bom_pending > 0 ? `Thiếu ${r.lines_bom_pending} SP` : 'Đủ'}
            </Fact>
            <Fact label="Vật tư (PO mở)" tone={r.pos_open > 0 ? 'amber' : undefined}>
              {r.pos_open > 0 ? `${r.pos_open} PO chờ` : '—'}
            </Fact>
          </dl>

          {r.production_order_id ? (
            <ProductionDossier
              productionOrderId={r.production_order_id}
              stages={stages}
            />
          ) : (
            <p className="text-muted-foreground mt-3 text-xs">
              Đơn chưa phát LSX — chưa có hồ sơ sản xuất.
            </p>
          )}
        </div>

        {/* Hành động */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {pendingApproval ? (
            <>
              <Button disabled={busy} onClick={onApprove}>
                Duyệt LSX
              </Button>
              <Button variant="outline" disabled={busy} onClick={onReject}>
                Từ chối
              </Button>
              {lsxHref && (
                <Button variant="ghost" asChild>
                  <a href={lsxHref}>
                    <Package className="size-4" /> Xem hồ sơ LSX
                  </a>
                </Button>
              )}
            </>
          ) : lsxHref ? (
            <Button variant="outline" asChild>
              <a href={lsxHref}>
                Xem chi tiết LSX <ArrowRight className="size-4" />
              </a>
            </Button>
          ) : (
            <span className="text-muted-foreground text-sm">
              Đơn chưa phát LSX — chờ Sales phát lệnh.
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ── Hồ sơ sản xuất (lazy-load theo đơn được chọn) ───────────────────────────
type DossierProgress = {
  id: string
  stage: string
  action: string
  note: string | null
  by: string | null
  at: string
}
type Dossier = {
  status: string
  ship_date: string | null
  received_date: string | null
  completed_at: string | null
  approved_at: string | null
  issued_at: string | null
  rejected_reason: string | null
  note: string | null
  container_summary: string | null
  progress: DossierProgress[]
  lines: ApprovalLsxLine[]
}

const ACTION_META: Record<string, { label: string; Icon: typeof Play; cls: string }> = {
  start: { label: 'Bắt đầu', Icon: Play, cls: 'text-sky-600 dark:text-sky-400' },
  done: {
    label: 'Hoàn thành',
    Icon: CheckCircle2,
    cls: 'text-emerald-600 dark:text-emerald-400',
  },
  received: {
    label: 'Nhận vật tư',
    Icon: PackageCheck,
    cls: 'text-violet-600 dark:text-violet-400',
  },
  cancelled: { label: 'Huỷ', Icon: XCircle, cls: 'text-red-600 dark:text-red-400' },
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function ProductionDossier({
  productionOrderId,
  stages,
}: {
  productionOrderId: string
  stages: Stage[]
}) {
  const [state, setState] = useState<{
    loading: boolean
    error: string | null
    data: Dossier | null
  }>({ loading: true, error: null, data: null })
  const cache = useRef<Map<string, Dossier>>(new Map())

  useEffect(() => {
    let cancelled = false
    const cached = cache.current.get(productionOrderId)
    if (cached) {
      setState({ loading: false, error: null, data: cached })
      return
    }
    setState({ loading: true, error: null, data: null })
    api<{
      lsx: Record<string, unknown>
      progress: Record<string, unknown>[]
      lines: ApprovalLsxLine[]
    }>(`/api/dept/production/lsx/${productionOrderId}`)
      .then((raw) => {
        if (cancelled) return
        const l = raw.lsx
        const data: Dossier = {
          status: String(l.status ?? ''),
          ship_date: (l.ship_date as string | null) ?? null,
          received_date: (l.received_date as string | null) ?? null,
          completed_at: (l.completed_at as string | null) ?? null,
          approved_at: (l.approved_at as string | null) ?? null,
          issued_at: (l.issued_at as string | null) ?? null,
          rejected_reason: (l.rejected_reason as string | null) ?? null,
          note: (l.note as string | null) ?? null,
          container_summary: (l.container_summary as string | null) ?? null,
          progress: (raw.progress ?? []).map((p) => ({
            id: String(p.id),
            stage: String(p.stage ?? ''),
            action: String(p.action ?? ''),
            note: (p.note as string | null) ?? null,
            by: (p.updated_by_name as string | null) ?? null,
            at: String(p.created_at ?? ''),
          })),
          // Endpoint không trả đơn giá bán — bổ sung unit_price=0 cho khớp type
          // (LsxProductTable không hiển thị cột giá).
          lines: (raw.lines ?? []).map((ln) => ({ ...ln, unit_price: 0 })),
        }
        cache.current.set(productionOrderId, data)
        setState({ loading: false, error: null, data })
      })
      .catch((e) => {
        if (!cancelled) setState({ loading: false, error: apiErrorText(e), data: null })
      })
    return () => {
      cancelled = true
    }
  }, [productionOrderId])

  const stageLabel = (code: string) => stages.find((s) => s.code === code)?.label ?? code

  if (state.loading) {
    return (
      <div className="text-muted-foreground mt-3 flex items-center gap-2 text-xs">
        <Spinner size={12} /> Đang tải hồ sơ sản xuất…
      </div>
    )
  }
  if (state.error || !state.data) {
    return (
      <p className="mt-3 text-xs text-red-600 dark:text-red-400">
        {state.error ?? 'Không tải được hồ sơ sản xuất.'}
      </p>
    )
  }

  const d = state.data
  const logistics = [
    d.issued_at && { label: 'Phát lệnh', value: fmtD(d.issued_at) },
    d.approved_at && { label: 'GĐ duyệt', value: fmtD(d.approved_at) },
    d.received_date && { label: 'Nhận vật tư', value: fmtD(d.received_date) },
    d.ship_date && { label: 'Ngày xuất', value: fmtD(d.ship_date) },
    d.completed_at && { label: 'Hoàn thành', value: fmtD(d.completed_at) },
  ].filter((x): x is { label: string; value: string } => !!x)

  // Timeline theo thứ tự thời gian (repo trả mới→cũ, đảo lại cũ→mới).
  const timeline = [...d.progress].reverse()

  return (
    <div className="mt-3 flex flex-col gap-3 border-t border-zinc-100 pt-3 dark:border-zinc-800/70">
      {d.lines.length > 0 && <LsxProductTable lines={d.lines} />}

      {logistics.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
          {logistics.map((f) => (
            <Fact key={f.label} label={f.label}>
              {f.value}
            </Fact>
          ))}
        </dl>
      )}

      {d.container_summary && (
        <div className="text-xs">
          <span className="text-muted-foreground">Đóng cont: </span>
          {d.container_summary}
        </div>
      )}
      {d.rejected_reason && <Signal tone="alert">Từ chối: {d.rejected_reason}</Signal>}
      {d.note && (
        <div className="bg-background rounded-md border border-zinc-100 px-2.5 py-2 text-xs dark:border-zinc-800">
          <span className="text-muted-foreground">Ghi chú: </span>
          {d.note}
        </div>
      )}

      <div>
        <div className="text-muted-foreground mb-2 text-[11px] font-semibold tracking-wider uppercase">
          Mốc tiến độ ({timeline.length})
        </div>
        {timeline.length === 0 ? (
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <CircleDashed className="size-3.5" /> Chưa có mốc tiến độ nào.
          </div>
        ) : (
          <ol className="relative ml-1 space-y-3 border-l border-zinc-200 pl-4 dark:border-zinc-700">
            {timeline.map((p) => {
              const meta = ACTION_META[p.action]
              const Icon = meta?.Icon ?? CircleDashed
              return (
                <li key={p.id} className="relative">
                  <span
                    className={cn(
                      'bg-card absolute top-0.5 -left-[22px] flex size-4 items-center justify-center rounded-full ring-4 ring-zinc-50/40 dark:ring-zinc-900/30',
                      meta?.cls ?? 'text-muted-foreground',
                    )}
                  >
                    <Icon className="size-3.5" />
                  </span>
                  <div className="text-sm font-medium">
                    {stageLabel(p.stage)}
                    <span className={cn('ml-1.5 text-xs', meta?.cls)}>
                      · {meta?.label ?? p.action}
                    </span>
                  </div>
                  <div className="text-muted-foreground text-[11px]">
                    {p.by ? `${p.by} · ` : ''}
                    {fmtDateTime(p.at)}
                  </div>
                  {p.note && <div className="mt-0.5 text-xs">{p.note}</div>}
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </div>
  )
}
