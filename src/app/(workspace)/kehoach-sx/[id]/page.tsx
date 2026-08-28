import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { planService } from '@/modules/dept/production/plan.service'
import { entriesService } from '@/modules/dept/production/entries.service'
import { canManagePlan, isProductionStaff } from '@/modules/dept/production/perms'
import { lsxStageProgress } from '@/lib/production-summary'
import { HttpError } from '@/server/http'
import { PlanEditor } from './PlanEditor'

export const dynamic = 'force-dynamic'

/** Lên kế hoạch 1 lệnh: per dòng SP — lộ trình công đoạn + giao tổ + hạn. */
export default async function PlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await authService.requirePageUser()
  // Màn ĐIỀU PHỐI (0086): thành viên xưởng thường không xem — về màn của vai.
  const canEdit = await canManagePlan(user)
  if (user.role === 'employee' && !canEdit && (await isProductionStaff(user))) {
    redirect('/to')
  }
  let data
  try {
    data = await planService.get(user, id)
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound()
    throw e
  }
  const prod = await entriesService.summary(user, id)

  // TIẾN ĐỘ THEO CÔNG ĐOẠN (24/08): trả lời tại chỗ "công đoạn này được bao
  // nhiêu, vướng gì" — SL quy về BỘ SP theo quy tắc đồng bộ SP=MIN của sổ
  // thống kê; việc/quá hạn/ghi chú đọc từ jobs. Nghẽn WIP & thiếu vật tư xem
  // ở Toàn cảnh (cần transfers, không kéo vào đây).
  const today = new Date().toISOString().slice(0, 10)
  const progress = lsxStageProgress(
    prod.stages.map((s) => s.code),
    data.lines.map((l) => ({ id: l.order_line_id, qty: l.qty })),
    prod.components.map((c) => ({
      order_line_id: c.order_line_id,
      total_needed: c.total_needed,
      stages: c.summary.stages,
    })),
  )
  const jobsOfStage = (code: string) =>
    data.lines.flatMap((l) => l.jobs.filter((j) => j.stage === code))
  const stageRows = progress.map((p) => {
    const jobs = jobsOfStage(p.stage)
    const notes = jobs.filter((j) => j.note?.trim())
    return {
      ...p,
      jobs_total: jobs.length,
      jobs_done: jobs.filter((j) => j.status === 'done').length,
      overdue: jobs.filter(
        (j) => j.status !== 'done' && j.planned_end && j.planned_end.slice(0, 10) < today,
      ).length,
      note: notes.length
        ? `${
            data.lines.find((l) => l.order_line_id === notes[0].production_order_line_id)
              ?.product_code ?? '?'
          }: ${notes[0].note}` + (notes.length > 1 ? ` (+${notes.length - 1})` : '')
        : null,
    }
  })
  // Nhật ký điều chỉnh (0169) — render server, không đụng client editor.
  const stageLabel = (c: string) => data.stages.find((s) => s.code === c)?.label ?? c
  const teamName = (id: string | null) =>
    id == null
      ? '(tự theo công đoạn)'
      : (data.teams.find((t) => t.id === id)?.name ?? '?')
  const lineName = (id: string | null) =>
    id == null
      ? 'CẢ LỆNH'
      : (data.lines.find((l) => l.order_line_id === id)?.product_code ?? '(dòng đã gỡ)')
  const fmtVal = (field: string, v: string | null) =>
    field === 'team' ? teamName(v) : (v ?? '—')
  const fieldLabel = { team: 'tổ', planned_start: 'bắt đầu', planned_end: 'hạn' } as const

  return (
    <div className="flex flex-col gap-4">
      <PlanEditor data={data} canEdit={canEdit} />

      {/* Tiến độ theo công đoạn — SL đạt/cần (bộ SP), việc, quá hạn, phế, ghi chú */}
      <section className="bg-card rounded-xl border p-4">
        <div className="mb-2 flex flex-wrap items-baseline gap-2">
          <h2 className="text-sm font-semibold">Tiến độ theo công đoạn</h2>
          <span className="text-muted-foreground text-xs">
            bộ SP đồng bộ (chi tiết chậm nhất quyết định) — số do thống kê ghi sổ
          </span>
          <Link
            href={`/kehoach-sx/lsx/${id}`}
            className="text-muted-foreground ml-auto text-xs hover:text-[var(--primary)]"
          >
            Chi tiết từng chi tiết/cụm →
          </Link>
        </div>
        {stageRows.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            Chưa có số — lệnh chưa định hình chi tiết hoặc thống kê chưa ghi sổ.
          </p>
        ) : (
          <div className="overflow-x-auto">
            {/* border-separate + viền trên Ô để cột đóng băng mang viền theo
                (cùng bẫy border-collapse×sticky của lưới định mức). */}
            <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="text-muted-foreground text-left text-xs">
                  <th className="bg-card sticky left-0 z-10 border-b py-1.5 pr-3">
                    Công đoạn
                  </th>
                  <th className="border-b py-1.5 pr-3 text-right">SL đạt / cần</th>
                  <th className="border-b py-1.5 pr-3 text-right">%</th>
                  <th className="border-b py-1.5 pr-3 text-right">Việc xong</th>
                  <th className="border-b py-1.5 pr-3 text-right">Quá hạn KH</th>
                  <th className="border-b py-1.5 pr-3 text-right">Phế</th>
                  <th className="border-b py-1.5">Ghi chú tổ</th>
                </tr>
              </thead>
              <tbody>
                {stageRows.map((r) => (
                  <tr key={r.stage}>
                    <td className="bg-card sticky left-0 z-10 border-b py-1.5 pr-3 font-medium">
                      {stageLabel(r.stage)}
                    </td>
                    <td className="border-b py-1.5 pr-3 text-right font-mono text-xs tabular-nums">
                      {r.done_sets.toLocaleString('vi-VN')}/
                      {r.need_sets.toLocaleString('vi-VN')}
                    </td>
                    <td
                      className={`border-b py-1.5 pr-3 text-right font-mono text-xs tabular-nums ${
                        r.pct >= 1 ? 'font-semibold text-[var(--done)]' : ''
                      }`}
                    >
                      {Math.round(r.pct * 100)}%
                    </td>
                    <td className="border-b py-1.5 pr-3 text-right font-mono text-xs tabular-nums">
                      {r.jobs_total ? `${r.jobs_done}/${r.jobs_total} dòng` : '—'}
                    </td>
                    <td
                      className={`border-b py-1.5 pr-3 text-right font-mono text-xs tabular-nums ${
                        r.overdue ? 'font-semibold text-[var(--stop)]' : ''
                      }`}
                    >
                      {r.overdue || '—'}
                    </td>
                    <td
                      className={`border-b py-1.5 pr-3 text-right font-mono text-xs tabular-nums ${
                        r.defect ? 'text-[var(--warn)]' : ''
                      }`}
                    >
                      {r.defect ? r.defect.toLocaleString('vi-VN') : '—'}
                    </td>
                    <td className="text-muted-foreground max-w-[260px] truncate border-b py-1.5 text-xs">
                      {r.note ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-muted-foreground mt-2 text-[11px]">
          Phế tính theo đơn vị chi tiết. Nghẽn WIP giữa tổ &amp; thiếu vật tư xem ở Toàn
          cảnh sản xuất.
        </p>
      </section>

      {data.history.length > 0 && (
        <section className="bg-card rounded-xl border p-4">
          <h2 className="mb-2 text-sm font-semibold">
            Lịch sử điều chỉnh kế hoạch ({data.history.length})
          </h2>
          <ul className="flex flex-col gap-2 text-xs">
            {data.history.map((h) => (
              <li key={h.id} className="rounded-lg border px-3 py-2">
                <div className="text-muted-foreground flex flex-wrap gap-2">
                  <span className="font-mono tabular-nums">
                    {new Date(h.created_at).toLocaleString('vi-VN')}
                  </span>
                  <span className="text-foreground font-medium">
                    {lineName(h.production_order_line_id)}
                  </span>
                  <span>· {h.actor_name ?? '?'}</span>
                  {h.reason && <span className="text-[var(--warn)]">— {h.reason}</span>}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
                  {h.changes.added.length > 0 && (
                    <span className="text-[var(--done)]">
                      + {h.changes.added.map(stageLabel).join(', ')}
                    </span>
                  )}
                  {h.changes.removed.length > 0 && (
                    <span className="text-[var(--stop)]">
                      − {h.changes.removed.map(stageLabel).join(', ')}
                    </span>
                  )}
                  {h.changes.changed.map((c, i) => (
                    <span key={i} className="text-muted-foreground">
                      {stageLabel(c.stage)}: {fieldLabel[c.field]}{' '}
                      {fmtVal(c.field, c.from)} → <b>{fmtVal(c.field, c.to)}</b>
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
