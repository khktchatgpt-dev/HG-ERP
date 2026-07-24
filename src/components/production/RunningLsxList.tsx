import Link from 'next/link'
import { Badge } from '@/components/Badge'
import { PageHeader } from '@/components/erp/PageHeader'
import { EmptyState } from '@/components/erp/EmptyState'
import type { OverviewRow } from '@/modules/dept/production/jobs.service'

/**
 * DANH SÁCH LỆNH ĐANG CHẠY (đọc) — dùng chung cho 3 workspace vai SX (0087):
 * lệnh + chip công đoạn (done/total per dòng SP), cảnh báo trễ/ưu tiên/vật tư.
 * `myStages` (per lệnh) tô viền công đoạn CỦA TỔ MÌNH — chỉ workspace Tổ dùng.
 * Server component thuần — không state.
 */

const fmtD = (d: string | null) => (d ? new Date(d).toLocaleDateString('vi-VN') : '—')

export function RunningLsxList({
  rows,
  myStages,
  lsxBase,
  breadcrumbs,
  description,
}: {
  rows: OverviewRow[]
  /** production_order_id → các công đoạn tổ mình phụ trách (tô viền). */
  myStages: Record<string, string[]>
  /** Gốc link hồ sơ lệnh của workspace hiện tại (vd '/to/lsx'). */
  lsxBase: string
  breadcrumbs: { label: string; href?: string }[]
  description: string
}) {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumbs={breadcrumbs}
        title="Lệnh đang chạy"
        description={description}
      />
      {rows.length === 0 ? (
        <EmptyState
          icon="◫"
          title="Không có lệnh đang chạy"
          description="LSX được Giám đốc duyệt sẽ hiện ở đây."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((r) => {
            const mine = new Set(myStages[r.lsx.id] ?? [])
            return (
              <div
                key={r.lsx.id}
                className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Link
                    href={`${lsxBase}/${r.lsx.id}`}
                    className="font-mono text-sm font-semibold hover:text-red-600 dark:hover:text-red-400"
                  >
                    {r.lsx.code}
                  </Link>
                  {r.lsx.priority > 0 && (
                    <Badge tone="purple">Ưu tiên {r.lsx.priority}</Badge>
                  )}
                  {r.lsx.late && (
                    <Badge tone={r.lsx.late === 'overdue' ? 'red' : 'amber'}>
                      {r.lsx.late === 'overdue' ? 'Trễ hạn xuất' : 'Sát hạn'}
                    </Badge>
                  )}
                  {r.plan_overdue > 0 && (
                    <Badge tone="amber">{r.plan_overdue} việc quá hạn KH</Badge>
                  )}
                  {!r.lsx.materials_received_at && <Badge tone="gray">Chưa nhận VT</Badge>}
                  <span className="ml-auto text-xs text-zinc-500">
                    Xuất: <b>{fmtD(r.lsx.ship_date)}</b>
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-zinc-500">
                  {r.lsx.customer_name} · Đơn {r.lsx.order_code}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  {r.chips.length === 0 ? (
                    <span className="text-xs text-zinc-400">Chưa lên kế hoạch</span>
                  ) : (
                    r.chips.map((ch) => {
                      const isMine = mine.has(ch.stage)
                      const doneAll = ch.done === ch.total
                      return (
                        <span
                          key={ch.stage}
                          className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${
                            doneAll
                              ? 'border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300'
                              : ch.doing > 0 || ch.done > 0
                                ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : 'border-zinc-200 text-zinc-500 dark:border-zinc-700'
                          } ${isMine ? 'ring-2 ring-sky-400 dark:ring-sky-600' : ''}`}
                          title={
                            isMine
                              ? `Công đoạn tổ mình — ${ch.done}/${ch.total} dòng SP xong`
                              : `${ch.done}/${ch.total} dòng SP xong`
                          }
                        >
                          {ch.label} {ch.done}/{ch.total}
                        </span>
                      )
                    })
                  )}
                  <span className="ml-auto text-[11px] text-zinc-400">
                    {r.jobs_done}/{r.jobs_total} công đoạn
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
