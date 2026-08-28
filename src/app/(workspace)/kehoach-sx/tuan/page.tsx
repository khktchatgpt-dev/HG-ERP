import Link from 'next/link'
import { authService } from '@/modules/core/auth/auth.service'
import { weekService } from '@/modules/dept/production/week.service'
import { weekStartIso } from '@/lib/exec-ops'
import { PageHeader } from '@/components/erp/PageHeader'
import { Badge } from '@/components/Badge'

export const dynamic = 'force-dynamic'

/**
 * KẾ HOẠCH TUẦN — tuần là LĂNG KÍNH ĐỌC trên dữ liệu đã có, không phải thực
 * thể mới (từ chối "KH-tuần" lần 3 — plan-hoan-thien-ke-hoach-sx.md): lệnh
 * phải xuất trong tuần · việc đến hạn từng ngày · ma trận tổ × 7 ngày.
 */

const fmtN = (n: number) => n.toLocaleString('vi-VN')
const DOW = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

function shiftWeek(weekStart: string, weeks: number): string {
  const d = new Date(`${weekStart}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + weeks * 7)
  return d.toISOString().slice(0, 10)
}

const fmtDM = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`)
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`
}

export default async function WeekPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>
}) {
  const user = await authService.requirePageUser()
  const sp = await searchParams
  const today = new Date().toISOString().slice(0, 10)
  const weekStart = /^\d{4}-\d{2}-\d{2}$/.test(sp.week ?? '')
    ? weekStartIso(sp.week!)
    : weekStartIso(today)
  const board = await weekService.board(user, weekStart)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumbs={[
          { label: 'Kế hoạch sản xuất', href: '/kehoach-sx' },
          { label: 'Kế hoạch tuần' },
        ]}
        title={`Kế hoạch tuần ${fmtDM(board.days[0])} → ${fmtDM(board.days[6])}`}
        description="Tổng hợp tuần từ dữ liệu sẵn có: lệnh phải xuất, việc đến hạn, chỉ tiêu vs đạt per tổ. Giao chỉ tiêu cả tuần: màn Chỉ tiêu ngày → “Áp dụng đến ngày”."
      />

      <div className="flex items-center gap-2 text-sm">
        <Link
          href={`/kehoach-sx/tuan?week=${shiftWeek(weekStart, -1)}`}
          className="rounded-md border px-3 py-1.5 text-xs hover:bg-[var(--accent)]"
        >
          ← Tuần trước
        </Link>
        <Link
          href="/kehoach-sx/tuan"
          className="rounded-md border px-3 py-1.5 text-xs hover:bg-[var(--accent)]"
        >
          Tuần này
        </Link>
        <Link
          href={`/kehoach-sx/tuan?week=${shiftWeek(weekStart, 1)}`}
          className="rounded-md border px-3 py-1.5 text-xs hover:bg-[var(--accent)]"
        >
          Tuần sau →
        </Link>
      </div>

      {/* Lệnh phải xuất trong tuần */}
      <section className="bg-card rounded-lg border p-4">
        <h2 className="mb-2 text-sm font-semibold">
          Lệnh phải xuất trong tuần ({board.ships.length})
        </h2>
        {board.ships.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Không có lệnh nào hẹn xuất trong tuần này.
          </p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {board.ships.map((s) => (
              <li key={s.lsx_id} className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/kehoach-sx/${s.lsx_id}`}
                  className="t-data font-semibold hover:text-[var(--primary)] hover:underline"
                >
                  {s.lsx_code}
                </Link>
                <span className="text-muted-foreground text-xs">{s.customer_name}</span>
                <Badge tone="blue">xuất {fmtDM(s.ship_date)}</Badge>
                <span className="t-data text-xs tabular-nums">
                  {fmtN(s.qty_done)}/{fmtN(s.qty_needed)}
                  {s.qty_needed > 0 &&
                    ` (${Math.round(Math.min(s.qty_done / s.qty_needed, 1) * 100)}%)`}
                </span>
                {s.forecast_late ? (
                  <Badge tone="red">
                    dự kiến {s.forecast_date && fmtDM(s.forecast_date)} — TRỄ
                  </Badge>
                ) : s.forecast_date ? (
                  <Badge tone="green">dự kiến {fmtDM(s.forecast_date)} — kịp</Badge>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Việc đến hạn trong tuần */}
      <section className="bg-card rounded-lg border p-4">
        <h2 className="mb-2 text-sm font-semibold">Việc đến hạn trong tuần</h2>
        {board.due_by_day.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Không có việc nào hẹn xong trong tuần này.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {board.due_by_day.map((d) => (
              <div key={d.date} className="flex flex-wrap items-baseline gap-2 text-sm">
                <span
                  className={`t-data w-24 shrink-0 text-xs font-semibold ${
                    d.date < today ? 'text-[var(--stop)]' : ''
                  }`}
                >
                  {DOW[board.days.indexOf(d.date)]} {fmtDM(d.date)}
                  {d.date < today ? ' ⚠' : ''}
                </span>
                <span className="flex flex-wrap gap-1.5">
                  {d.jobs.map((j, i) => (
                    <span
                      key={i}
                      className="bg-muted rounded px-1.5 py-0.5 text-xs"
                      title={`${j.lsx_code} · ${j.product_code} · ${j.team_name ?? 'chưa giao tổ'}`}
                    >
                      {j.lsx_code} · {j.stage}
                      {j.team_name ? ` · ${j.team_name}` : ''}
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Ma trận tổ × ngày */}
      <section className="bg-card rounded-lg border">
        <h2 className="border-b px-4 py-2 text-sm font-semibold">
          Chỉ tiêu vs đạt theo tổ (chỉ tiêu do Kế hoạch giao; ô “—” = chưa giao)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-xs">
            <thead>
              <tr className="text-muted-foreground border-b text-left text-[10px] uppercase">
                <th className="px-3 py-1.5">Tổ</th>
                {board.days.map((d, i) => (
                  <th
                    key={d}
                    className={`px-2 py-1.5 text-right ${d === today ? 'text-[var(--primary)]' : ''}`}
                  >
                    {DOW[i]} {fmtDM(d)}
                  </th>
                ))}
                <th className="px-3 py-1.5 text-right">Σ tuần</th>
              </tr>
            </thead>
            <tbody>
              {board.teams.map((t) => (
                <tr key={t.team_id} className="border-b last:border-0">
                  <td className="px-3 py-1.5 font-medium">{t.team_name}</td>
                  {t.cells.map((c) => (
                    <td
                      key={c.date}
                      className={`t-data px-2 py-1.5 text-right tabular-nums ${
                        c.date === today ? 'bg-[var(--accent)]/40' : ''
                      }`}
                    >
                      {c.done > 0 || c.target != null ? (
                        <>
                          {fmtN(c.done)}
                          <span className="text-muted-foreground">
                            /{c.target != null ? fmtN(c.target) : '—'}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  ))}
                  <td className="t-data px-3 py-1.5 text-right font-semibold tabular-nums">
                    {fmtN(t.week_done)}
                    <span className="text-muted-foreground">
                      /{t.week_target > 0 ? fmtN(t.week_target) : '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-muted-foreground px-4 py-2 text-xs">
          Mỗi ô: <b>đạt/chỉ tiêu</b> trong ngày. Giao chỉ tiêu hàng loạt ở màn{' '}
          <Link
            href="/kehoach-sx/chi-tieu"
            className="text-[var(--primary)] hover:underline"
          >
            Chỉ tiêu ngày
          </Link>{' '}
          (chọn “Áp dụng đến ngày”).
        </p>
      </section>
    </div>
  )
}
