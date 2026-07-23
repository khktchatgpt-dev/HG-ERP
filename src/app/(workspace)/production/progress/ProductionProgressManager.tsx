'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/Badge'
import { LSX_STATUS as ST } from '@/lib/lsx-status'
import { api, ApiError } from '@/lib/api'
import { assessLateRisk } from '@/lib/late-risk'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { PageHeader } from '@/components/erp/PageHeader'
import { StatsBar } from '@/components/erp/StatsBar'
import { Toolbar, ToolbarInput, ToolbarSelect } from '@/components/erp/Toolbar'
import { DataTable, type Column } from '@/components/erp/DataTable'
import { EmptyState } from '@/components/erp/EmptyState'
import { TopProgressBar } from '@/components/erp/Spinner'

type LsxStatus =
  'pending_approval' | 'approved' | 'in_progress' | 'completed' | 'rejected' | 'cancelled'

type Row = {
  id: string
  code: string
  order_code: string
  customer_name: string
  status: LsxStatus
  current_stage: string | null
  ship_date: string | null
  completed_at: string | null
  // Từ v_order_tracking — đầu vào cảnh báo trễ + tình trạng vật tư (FR-SAL-09).
  order_status: string | null
  due_date: string | null
  lines_bom_pending: number
  pos_open: number
  /** Đã nhập bảng chi tiết & định mức chưa (plan-lsx-components P3). */
  has_components: boolean
  /** Hợp lộ trình các SP (0063) — null = chưa định hình, hiện đủ danh mục. */
  route_stages: string[] | null
}

const ACTIVE: LsxStatus[] = ['approved', 'in_progress']

const fmtD = (d: string | null) => (d ? new Date(d).toLocaleDateString('vi-VN') : '—')

/** Tải việc 1 tổ (teamService.workloadByTeam) — thẻ Kanban theo trạng thái. */
type WorkloadRow = {
  department_id: string
  department_name: string
  stage: string
  stage_label: string
  todo: number
  doing: number
  done: number
}

/** Sự cố đang mở (subset Incident) — panel quản đốc. */
type OpenIncident = {
  id: string
  lsx_code: string | null
  stage: string | null
  department_name: string | null
  reported_by_name: string | null
  message: string
  created_at: string
}

export function ProductionProgressManager({
  rows,
  stages,
  canManage,
  workload,
  incidents,
}: {
  rows: Row[]
  stages: { code: string; label: string }[]
  /** GĐ/QL hoặc KH-CƯ — cập nhật giai đoạn / báo hoàn thành tại chỗ. */
  canManage: boolean
  /** Tải việc theo tổ (tách vai 07/2026) — mỗi tổ đã gán công đoạn 1 dòng. */
  workload: WorkloadRow[]
  /** Sự cố tổ báo, đang mở — quản đốc đóng khi xử lý xong. */
  incidents: OpenIncident[]
}) {
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'late' | LsxStatus>('all')

  const stageLabel = (code: string | null) =>
    code ? (stages.find((s) => s.code === code)?.label ?? code) : null

  const today = new Date().toISOString().slice(0, 10)
  // Nguy cơ trễ tính theo ĐƠN (hạn giao + BOM + vật tư) — LSX là mắt xích thực thi.
  const riskOf = (r: Row) =>
    r.order_status
      ? assessLateRisk(
          {
            status: r.order_status,
            due_date: r.due_date,
            lines_bom_pending: r.lines_bom_pending,
            pos_open: r.pos_open,
            production_order_id: r.id,
            lsx_status: r.status,
          },
          today,
        )
      : null

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return rows.filter((r) => {
      if (statusFilter === 'late') {
        if (!riskOf(r)) return false
      } else if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (
        ql &&
        !`${r.code} ${r.order_code} ${r.customer_name}`.toLowerCase().includes(ql)
      )
        return false
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, statusFilter, today])

  const count = (st: LsxStatus) => rows.filter((r) => r.status === st).length
  const lateCount = rows.filter((r) => riskOf(r)).length

  async function updateStage(r: Row, stage: string) {
    setBusy(true)
    try {
      await api(`/api/dept/production/lsx/${r.id}/stage`, {
        method: 'POST',
        body: { stage, action: 'done' },
      })
      toast.success('Đã cập nhật giai đoạn', r.code)
      router.refresh()
    } catch (e) {
      toast.error('Cập nhật thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  async function resolveIncident(inc: OpenIncident) {
    const ok = await confirm({
      title: 'Đánh dấu sự cố đã xử lý?',
      description: inc.message,
      confirmLabel: 'Đã xử lý',
    })
    if (!ok) return
    setBusy(true)
    try {
      await api(`/api/dept/production/incidents/${inc.id}/resolve`, {
        method: 'POST',
        body: {},
      })
      toast.success('Đã đóng sự cố', 'Người báo sẽ nhận được thông báo')
      router.refresh()
    } catch (e) {
      toast.error('Thao tác thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  async function completeLsx(r: Row) {
    const ok = await confirm({
      title: `Báo hoàn thành ${r.code}?`,
      description: `${r.customer_name} · đơn ${r.order_code} sẽ chuyển sang Hoàn thành để giao hàng.`,
      confirmLabel: 'Hoàn thành',
    })
    if (!ok) return
    setBusy(true)
    try {
      await api(`/api/dept/production/lsx/${r.id}/complete`, {
        method: 'POST',
        body: {},
      })
      toast.success('LSX hoàn thành', r.code)
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
      header: 'Số LSX',
      sortValue: (r) => r.code,
      cell: (r) => (
        <Link
          // Ở workspace Sản xuất thì mở bản LSX của Sản xuất — không nhảy shell
          // Sales (mỗi bộ phận một màn riêng, user chốt 07/2026).
          href={`/production/lsx/${r.id}`}
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
      key: 'materials',
      header: 'Vật tư / BOM',
      width: '150px',
      sortValue: (r) => r.pos_open + r.lines_bom_pending,
      cell: (r) => {
        if (!ACTIVE.includes(r.status) && r.status !== 'pending_approval')
          return <span className="text-xs text-zinc-400">—</span>
        const flags = [
          // Lệnh đã duyệt mà Kế hoạch chưa nhập bảng chi tiết → nhắc trước khi mua.
          !r.has_components && ACTIVE.includes(r.status) ? (
            <Badge key="comp" tone="amber">
              Chưa nhập chi tiết
            </Badge>
          ) : null,
          r.lines_bom_pending > 0 ? (
            <Badge key="bom" tone="red">
              {r.lines_bom_pending} chưa BOM
            </Badge>
          ) : null,
          r.pos_open > 0 ? (
            <Badge key="po" tone="amber">
              {r.pos_open} PO chưa về
            </Badge>
          ) : null,
        ].filter(Boolean)
        return flags.length ? (
          <div className="flex flex-wrap gap-1">{flags}</div>
        ) : (
          <Badge tone="green">Sẵn sàng</Badge>
        )
      },
    },
    {
      key: 'stage',
      header: 'Giai đoạn',
      width: '170px',
      cell: (r) => {
        // Điều phối tại chỗ: đổi giai đoạn ngay trên bảng (LSX đã duyệt/đang SX).
        if (canManage && ACTIVE.includes(r.status)) {
          return (
            <select
              value={r.current_stage ?? ''}
              disabled={busy}
              onChange={(e) => e.target.value && void updateStage(r, e.target.value)}
              className="w-full rounded border border-zinc-300 px-1 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">— giai đoạn —</option>
              {/* Chỉ giai đoạn có SP đi qua (lộ trình 0063); chưa định hình → đủ. */}
              {stages
                .filter((s) => !r.route_stages || r.route_stages.includes(s.code))
                .map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.label}
                  </option>
                ))}
            </select>
          )
        }
        const label = stageLabel(r.current_stage)
        if (r.status === 'in_progress' && label)
          return <Badge tone="amber">{label}</Badge>
        return <span className="text-xs text-zinc-400">{label ?? '—'}</span>
      },
    },
    {
      key: 'ship',
      header: 'Ngày xuất',
      width: '140px',
      sortValue: (r) => r.ship_date ?? '',
      cell: (r) => {
        const risk = riskOf(r)
        return (
          <div className="flex items-center gap-1.5">
            <span className="text-sm">{fmtD(r.ship_date)}</span>
            {risk && (
              <span title={risk.reasons.join(' · ') || 'Sát/quá hạn giao'}>
                <Badge tone={risk.level === 'overdue' ? 'red' : 'amber'}>⚠</Badge>
              </span>
            )}
          </div>
        )
      },
    },
    {
      key: 'status',
      header: 'Trạng thái',
      width: '150px',
      sortValue: (r) => r.status,
      cell: (r) => <Badge tone={ST[r.status].tone}>{ST[r.status].label}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      width: '110px',
      align: 'right',
      cell: (r) =>
        canManage && r.status === 'in_progress' ? (
          <button
            disabled={busy}
            onClick={() => void completeLsx(r)}
            className="rounded-md border border-green-300 px-2 py-1 text-xs text-green-700 hover:bg-green-50 disabled:opacity-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950"
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
          { label: 'Sản xuất', href: '/production' },
          { label: 'Tiến độ sản xuất' },
        ]}
        title="Tiến độ sản xuất"
        description="Bảng điều phối (FR-SUP-08): tiến độ + nguy cơ trễ + tình trạng vật tư/BOM từng LSX. Đổi giai đoạn / báo hoàn thành ngay trên bảng; bấm số LSX để vào chi tiết."
      />

      <StatsBar
        stats={[
          {
            label: 'Nguy cơ trễ',
            value: lateCount,
            tone: lateCount ? 'red' : 'gray',
          },
          { label: 'Chờ GĐ duyệt', value: count('pending_approval'), tone: 'amber' },
          { label: 'Chờ sản xuất', value: count('approved'), tone: 'blue' },
          { label: 'Đang sản xuất', value: count('in_progress'), tone: 'amber' },
          { label: 'Hoàn thành', value: count('completed'), tone: 'green' },
          {
            label: 'Sự cố đang mở',
            value: incidents.length,
            tone: incidents.length ? 'red' : 'gray',
          },
        ]}
      />

      {/* Sự cố tổ báo — xử lý xong thì đóng, người báo nhận thông báo. */}
      {incidents.length > 0 && (
        <section className="rounded-lg border border-red-200 bg-red-50/40 dark:border-red-900/50 dark:bg-red-950/20">
          <div className="border-b border-red-200 px-4 py-2 dark:border-red-900/50">
            <h2 className="text-xs font-semibold tracking-wider text-red-700 uppercase dark:text-red-400">
              ⚠ Sự cố đang mở ({incidents.length})
            </h2>
          </div>
          <ul className="divide-y divide-red-100 dark:divide-red-950">
            {incidents.map((inc) => (
              <li
                key={inc.id}
                className="flex flex-wrap items-center gap-2 px-4 py-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <span className="font-medium">{inc.message}</span>
                  <div className="text-xs text-zinc-500">
                    {[
                      inc.lsx_code,
                      inc.stage
                        ? (stages.find((s) => s.code === inc.stage)?.label ?? inc.stage)
                        : null,
                      inc.department_name,
                      inc.reported_by_name,
                    ]
                      .filter(Boolean)
                      .join(' · ')}{' '}
                    · {fmtD(inc.created_at)}
                  </div>
                </div>
                {canManage && (
                  <button
                    disabled={busy}
                    onClick={() => void resolveIncident(inc)}
                    className="rounded-md border border-red-300 px-2.5 py-1 text-xs text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
                  >
                    ✓ Đã xử lý
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Tải việc theo tổ — mỗi tổ đã gán công đoạn: thẻ chưa/đang/xong. */}
      {workload.length > 0 && (
        <section className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
            <h2 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
              Tải việc theo tổ (lệnh đang chạy)
            </h2>
          </div>
          <div className="grid grid-cols-2 divide-x divide-y divide-zinc-100 sm:grid-cols-3 lg:grid-cols-7 dark:divide-zinc-900">
            {workload.map((w) => (
              <Link
                key={w.department_id}
                href={`/production/team?stage=${w.stage}`}
                className="flex flex-col gap-0.5 px-3 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                title={`Mở bảng việc công đoạn ${w.stage_label}`}
              >
                <span className="truncate text-xs font-medium">{w.department_name}</span>
                <span className="text-[10px] text-zinc-400">{w.stage_label}</span>
                <span className="text-xs tabular-nums">
                  <span className="text-zinc-400">{w.todo} chờ</span>
                  {' · '}
                  <span
                    className={w.doing ? 'font-medium text-amber-600' : 'text-zinc-400'}
                  >
                    {w.doing} đang
                  </span>
                  {' · '}
                  <span className={w.done ? 'text-green-600' : 'text-zinc-400'}>
                    {w.done} xong
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

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
                  { value: 'late' as const, label: '⚠ Nguy cơ trễ' },
                  { value: 'pending_approval' as const, label: 'Chờ GĐ duyệt' },
                  { value: 'approved' as const, label: 'Chờ sản xuất' },
                  { value: 'in_progress' as const, label: 'Đang sản xuất' },
                  { value: 'completed' as const, label: 'Hoàn thành' },
                  { value: 'rejected' as const, label: 'Bị từ chối' },
                  { value: 'cancelled' as const, label: 'Đã huỷ theo đơn' },
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
              description="LSX do Sales phát từ đơn hàng đã xác nhận; GĐ duyệt xong sẽ hiện ở đây để điều phối."
            />
          }
        />
      </div>
    </div>
  )
}
