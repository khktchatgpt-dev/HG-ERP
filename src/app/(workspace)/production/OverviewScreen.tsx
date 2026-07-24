'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/Badge'
import { Modal } from '@/components/Modal'
import { PageHeader } from '@/components/erp/PageHeader'
import { StatsBar } from '@/components/erp/StatsBar'
import { Toolbar, ToolbarInput, ToolbarSelect } from '@/components/erp/Toolbar'
import { EmptyState } from '@/components/erp/EmptyState'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import type {
  OverviewRow,
  StageChip,
  TeamWorkloadRow,
} from '@/modules/dept/production/jobs.service'

export type WaitingDeliveryRow = {
  order_id: string
  order_code: string
  lsx_code: string
  customer_name: string
  ship_date: string | null
}

type Filter = 'all' | 'late' | 'plan_overdue' | 'no_plan'

const fmtD = (d: string | null) => (d ? new Date(d).toLocaleDateString('vi-VN') : '—')

/** Dải chip công đoạn: màu theo done/doing/todo. */
function StageChips({ chips }: { chips: StageChip[] }) {
  if (!chips.length) {
    return <span className="text-xs text-zinc-400">Chưa lên kế hoạch</span>
  }
  return (
    <div className="flex flex-wrap gap-1">
      {chips.map((c) => {
        const cls =
          c.done === c.total
            ? 'border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300'
            : c.doing > 0 || c.done > 0
              ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300'
              : 'border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400'
        return (
          <span
            key={c.stage}
            className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${cls}`}
            title={`${c.label}: ${c.done}/${c.total} dòng SP xong`}
          >
            {c.label} {c.done}/{c.total}
          </span>
        )
      })}
    </div>
  )
}

export function OverviewScreen({
  rows,
  workload,
  waiting,
  canOperate,
}: {
  rows: OverviewRow[]
  workload: TeamWorkloadRow[]
  stages: { code: string; label: string }[]
  waiting: WaitingDeliveryRow[]
  canOperate: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [busy, setBusy] = useState(false)
  // Modal hoàn thành: gate server chặn khi còn việc — cho QL ép kèm lý do.
  const [completeFor, setCompleteFor] = useState<OverviewRow | null>(null)
  const [overrideNote, setOverrideNote] = useState('')
  const [needOverride, setNeedOverride] = useState(false)

  const late = rows.filter((r) => r.lsx.late).length
  const planOverdue = rows.filter((r) => r.plan_overdue > 0).length
  const noPlan = rows.filter((r) => r.jobs_total === 0).length

  const shown = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return rows.filter((r) => {
      if (filter === 'late' && !r.lsx.late) return false
      if (filter === 'plan_overdue' && r.plan_overdue === 0) return false
      if (filter === 'no_plan' && r.jobs_total > 0) return false
      if (
        ql &&
        !`${r.lsx.code} ${r.lsx.customer_name} ${r.lsx.order_code}`
          .toLowerCase()
          .includes(ql)
      )
        return false
      return true
    })
  }, [rows, q, filter])

  async function doComplete(row: OverviewRow, override: boolean) {
    setBusy(true)
    try {
      await api(`/api/dept/production/lsx/${row.lsx.id}/complete`, {
        method: 'POST',
        body: JSON.stringify(
          override ? { override: true, note: overrideNote } : { note: null },
        ),
      })
      toast.success(`${row.lsx.code} đã hoàn thành — chờ Sales xác nhận giao hàng`)
      setCompleteFor(null)
      setNeedOverride(false)
      setOverrideNote('')
      router.refresh()
    } catch (e) {
      if (e instanceof ApiError && e.code === 'LSX_NOT_READY') {
        // Còn việc dở → mở nhánh ép hoàn thành (chỉ QL).
        setNeedOverride(true)
        toast.error(e.message)
      } else {
        toast.error(e instanceof ApiError ? e.message : 'Không hoàn thành được')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <TopProgressBar active={busy} />
      <PageHeader
        breadcrumbs={[{ label: 'Sản xuất' }]}
        title="Toàn cảnh xưởng"
        description="Lệnh đang chạy theo ưu tiên — dải công đoạn đọc từ kế hoạch, số đọc từ sổ thống kê. Trễ hạn nổi đỏ."
      />

      <StatsBar
        stats={[
          { label: 'Đang chạy', value: rows.length, tone: 'blue' },
          { label: 'Nguy cơ trễ hạn xuất', value: late, tone: late ? 'red' : 'gray' },
          {
            label: 'Trễ hạn kế hoạch',
            value: planOverdue,
            tone: planOverdue ? 'amber' : 'gray',
          },
          { label: 'Chưa lên kế hoạch', value: noPlan, tone: noPlan ? 'amber' : 'gray' },
          { label: 'Chờ giao hàng', value: waiting.length, tone: 'default' },
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
                { value: 'all' as const, label: 'Tất cả đang chạy' },
                { value: 'late' as const, label: 'Nguy cơ trễ hạn xuất' },
                { value: 'plan_overdue' as const, label: 'Trễ hạn kế hoạch' },
                { value: 'no_plan' as const, label: 'Chưa lên kế hoạch' },
              ]}
            />
          </>
        }
        right={<span className="text-xs text-zinc-500">{shown.length} lệnh</span>}
      />

      {shown.length === 0 ? (
        <EmptyState
          icon="◫"
          title={rows.length === 0 ? 'Không có lệnh đang chạy' : 'Không khớp bộ lọc'}
          description={
            rows.length === 0
              ? 'LSX được Giám đốc duyệt sẽ hiện ở đây.'
              : 'Thử đổi từ khoá hoặc bộ lọc.'
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {shown.map((r) => (
            <div
              key={r.lsx.id}
              className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/production/lsx/${r.lsx.id}`}
                  className="font-mono text-base font-semibold hover:text-red-600 dark:hover:text-red-400"
                >
                  {r.lsx.code}
                </Link>
                {r.lsx.priority > 0 && (
                  <Badge tone="purple">Ưu tiên {r.lsx.priority}</Badge>
                )}
                {r.lsx.late && (
                  <Badge tone={r.lsx.late === 'overdue' ? 'red' : 'amber'}>
                    {r.lsx.late === 'overdue' ? '⚠ Trễ hạn xuất' : '⚠ Sát hạn xuất'}
                  </Badge>
                )}
                {r.plan_overdue > 0 && (
                  <Badge tone="amber">{r.plan_overdue} việc quá hạn KH</Badge>
                )}
                {!r.lsx.materials_received_at && (
                  <Badge tone="gray">Chưa nhận vật tư</Badge>
                )}
                <span className="ml-auto text-xs text-zinc-500">
                  {r.lsx.customer_name} · Đơn {r.lsx.order_code} · Xuất:{' '}
                  <b>{fmtD(r.lsx.ship_date)}</b>
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <StageChips chips={r.chips} />
                <span className="ml-auto text-xs text-zinc-500">
                  {r.jobs_done}/{r.jobs_total} công đoạn xong
                </span>
                {canOperate && r.jobs_total > 0 && (
                  <button
                    onClick={() => {
                      setCompleteFor(r)
                      setNeedOverride(false)
                      setOverrideNote('')
                    }}
                    disabled={busy}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      r.jobs_done === r.jobs_total
                        ? 'bg-green-600 text-white hover:bg-green-500'
                        : 'border border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900'
                    }`}
                  >
                    ✓ Hoàn thành lệnh
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tải việc theo tổ */}
      {workload.length > 0 && (
        <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-3 text-sm font-semibold">Tải việc theo tổ</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {workload.map((w) => (
              <div
                key={w.department_id}
                className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
              >
                <span className="truncate font-medium">{w.department_name}</span>
                <span className="flex gap-2 text-xs">
                  <span className="text-zinc-500">{w.todo} chưa</span>
                  <span className="text-amber-600 dark:text-amber-400">
                    {w.doing} đang
                  </span>
                  <span className="text-green-600 dark:text-green-400">
                    {w.done} xong
                  </span>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Khép chuỗi: chờ Sales xác nhận giao */}
      {waiting.length > 0 && (
        <section className="rounded-xl border border-sky-200 bg-sky-50/50 p-4 dark:border-sky-900 dark:bg-sky-950/30">
          <h2 className="mb-2 text-sm font-semibold text-sky-800 dark:text-sky-300">
            Chờ giao hàng ({waiting.length})
          </h2>
          <p className="mb-3 text-xs text-zinc-500">
            Xưởng đã xong — Sales xác nhận giao ở màn Đơn hàng để khép chuỗi.
          </p>
          <div className="flex flex-wrap gap-2">
            {waiting.map((w) => (
              <span
                key={w.order_id}
                className="rounded-lg border border-sky-200 bg-white px-3 py-1.5 text-xs dark:border-sky-900 dark:bg-zinc-950"
              >
                <b className="font-mono">{w.lsx_code}</b> · {w.customer_name} · Đơn{' '}
                {w.order_code}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Modal hoàn thành lệnh */}
      <Modal
        open={!!completeFor}
        onClose={() => setCompleteFor(null)}
        title={`Hoàn thành ${completeFor?.lsx.code ?? ''}`}
      >
        {completeFor && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              {completeFor.jobs_done}/{completeFor.jobs_total} công đoạn đã xong.
              {completeFor.jobs_done < completeFor.jobs_total &&
                ' Còn việc dở — hệ sẽ chặn trừ khi Ban quản lý ép hoàn thành kèm lý do.'}
            </p>
            {needOverride && (
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-red-600 dark:text-red-400">
                  Lý do ép hoàn thành (bắt buộc)
                </span>
                <textarea
                  value={overrideNote}
                  onChange={(e) => setOverrideNote(e.target.value)}
                  rows={2}
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  placeholder="VD: khách lấy hàng gấp, phần thiếu giao bù sau"
                />
              </label>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setCompleteFor(null)}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
              >
                Huỷ
              </button>
              {needOverride ? (
                <button
                  onClick={() => doComplete(completeFor, true)}
                  disabled={busy || !overrideNote.trim()}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                >
                  {busy && <Spinner size={14} />} Ép hoàn thành
                </button>
              ) : (
                <button
                  onClick={() => doComplete(completeFor, false)}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50"
                >
                  {busy && <Spinner size={14} />} Xác nhận hoàn thành
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
