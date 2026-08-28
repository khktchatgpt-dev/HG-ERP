import Link from 'next/link'
import { authService } from '@/modules/core/auth/auth.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { jobsRepo } from '@/modules/dept/production/jobs.repo'
import { PageHeader } from '@/components/erp/PageHeader'
import { EmptyState } from '@/components/erp/EmptyState'

export const dynamic = 'force-dynamic'

/**
 * TIẾN ĐỘ THEO THỜI GIAN (GĐ2 plan-sx — mức đơn giản, KHÔNG kéo-thả):
 * mỗi lệnh một khối, mỗi công đoạn một vạch planned_start → planned_end
 * (min/max các job của công đoạn). Đỏ = quá hạn còn việc; xám = xong hết.
 * Màn ĐỌC — sửa lộ trình vẫn ở /kehoach-sx/[id].
 */

const DAYS_BACK = 7
const DAYS_AHEAD = 21

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const dayDiff = (a: string, b: string) =>
  Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)
const fmtD = (d: string | null) => (d ? new Date(d).toLocaleDateString('vi-VN') : '—')

type StageBar = {
  stage: string
  label: string
  start: string | null
  end: string | null
  total: number
  done: number
  /** Quá planned_end mà còn việc chưa xong. */
  late: boolean
}

export default async function TienDoPage() {
  await authService.requirePageUser()
  const [active, stages] = await Promise.all([
    productionRepo.listActive(),
    productionRepo.listStages(),
  ])
  const jobs = await jobsRepo.listByLsxBulk(active.map((l) => l.id))

  const today = new Date().toISOString().slice(0, 10)
  const windowStart = addDays(today, -DAYS_BACK)
  const n = DAYS_BACK + DAYS_AHEAD + 1
  const days = Array.from({ length: n }, (_, i) => addDays(windowStart, i))
  const todayIdx = DAYS_BACK

  // Vạch per (lệnh × công đoạn): min start / max end, theo thứ tự danh mục.
  const barsByLsx = new Map<string, StageBar[]>()
  for (const lsx of active) {
    const js = jobs.filter((j) => j.production_order_id === lsx.id)
    const bars: StageBar[] = []
    for (const s of stages) {
      const mine = js.filter((j) => j.stage === s.code)
      if (!mine.length) continue
      const starts = mine.map((j) => j.planned_start).filter(Boolean) as string[]
      const ends = mine.map((j) => j.planned_end).filter(Boolean) as string[]
      const end = ends.length ? ends.sort().at(-1)! : null
      const done = mine.filter((j) => j.status === 'done').length
      bars.push({
        stage: s.code,
        label: s.label,
        start: starts.length ? starts.sort()[0] : null,
        end,
        total: mine.length,
        done,
        late: !!end && end.slice(0, 10) < today && done < mine.length,
      })
    }
    barsByLsx.set(lsx.id, bars)
  }

  /** Cột grid [1..n] đã kẹp vào cửa sổ; null = vạch nằm hẳn ngoài cửa sổ. */
  const gridCols = (start: string, end: string): [number, number] | null => {
    const a = dayDiff(windowStart, start.slice(0, 10))
    const b = dayDiff(windowStart, end.slice(0, 10))
    if (b < 0 || a > n - 1) return null
    return [Math.max(a, 0) + 1, Math.min(b, n - 1) + 2]
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumbs={[
          { label: 'Kế hoạch sản xuất', href: '/kehoach-sx' },
          { label: 'Tiến độ' },
        ]}
        title="Tiến độ theo thời gian"
        description={`Vạch = khoảng kế hoạch của công đoạn (gộp các dòng SP). Cửa sổ ${fmtD(windowStart)} → ${fmtD(days[n - 1])}; vạch đứt dọc = hôm nay. Bấm mã lệnh để sửa lộ trình.`}
      />

      {active.length === 0 ? (
        <EmptyState
          icon="▦"
          title="Không có lệnh đang chạy"
          description="LSX được duyệt sẽ hiện tiến độ ở đây."
        />
      ) : (
        <div className="bg-card overflow-x-auto rounded-lg border">
          <div className="min-w-[880px] p-3">
            {/* Header ngày — hàng lịch dùng CHUNG lưới cột với các vạch. */}
            <div className="flex">
              <div className="w-52 shrink-0" />
              <div
                className="grid flex-1"
                style={{ gridTemplateColumns: `repeat(${n}, minmax(18px, 1fr))` }}
              >
                {days.map((d, i) => {
                  const day = new Date(`${d}T00:00:00Z`)
                  const sunday = day.getUTCDay() === 0
                  return (
                    <div
                      key={d}
                      className={`t-label border-l pb-1 text-center ${
                        i === todayIdx
                          ? 'font-semibold text-[var(--primary)]'
                          : sunday
                            ? 'text-muted-foreground/50'
                            : 'text-muted-foreground'
                      }`}
                      title={fmtD(d)}
                    >
                      {day.getUTCDate() === 1 || i === 0
                        ? `${day.getUTCDate()}/${day.getUTCMonth() + 1}`
                        : day.getUTCDate()}
                    </div>
                  )
                })}
              </div>
            </div>

            {active.map((lsx) => {
              const bars = barsByLsx.get(lsx.id) ?? []
              return (
                <div key={lsx.id} className="border-t py-2">
                  <div className="flex items-baseline gap-2">
                    <Link
                      href={`/kehoach-sx/${lsx.id}`}
                      className="t-data text-sm font-semibold hover:text-[var(--primary)]"
                    >
                      {lsx.code}
                    </Link>
                    <span className="text-muted-foreground truncate text-xs">
                      {lsx.customer_name}
                      {lsx.ship_date ? ` · xuất ${fmtD(lsx.ship_date)}` : ''}
                    </span>
                  </div>
                  {bars.length === 0 ? (
                    <p className="text-muted-foreground mt-1 text-xs">
                      Chưa lên lộ trình công đoạn.
                    </p>
                  ) : (
                    bars.map((b) => {
                      const cols = b.start && b.end ? gridCols(b.start, b.end) : null
                      return (
                        <div key={b.stage} className="mt-1 flex items-center">
                          <div className="text-muted-foreground w-52 shrink-0 truncate pr-2 text-xs">
                            {b.label}
                            <span className="t-data ml-1">
                              {b.done}/{b.total}
                            </span>
                          </div>
                          <div
                            className="grid h-3.5 flex-1"
                            style={{
                              gridTemplateColumns: `repeat(${n}, minmax(18px, 1fr))`,
                            }}
                          >
                            {/* Vạch hôm nay chạy xuyên các lane. */}
                            <div
                              className="-my-0.5 border-l border-dashed border-[var(--primary)]/40"
                              style={{ gridColumn: `${todayIdx + 1}`, gridRow: 1 }}
                            />
                            {cols ? (
                              <div
                                className={`h-2.5 self-center rounded-full ${
                                  b.late
                                    ? 'bg-[var(--stop)]'
                                    : b.done === b.total
                                      ? 'bg-muted-foreground/30'
                                      : 'bg-[color-mix(in_srgb,var(--primary)_55%,transparent)]'
                                }`}
                                style={{
                                  gridColumn: `${cols[0]} / ${cols[1]}`,
                                  gridRow: 1,
                                }}
                                title={`${b.label}: ${fmtD(b.start)} → ${fmtD(b.end)} · ${b.done}/${b.total} việc xong${b.late ? ' · QUÁ HẠN' : ''}`}
                              />
                            ) : (
                              <span
                                className="text-muted-foreground/60 self-center text-[10px]"
                                style={{ gridColumn: `1 / ${n + 1}`, gridRow: 1 }}
                              >
                                {b.start && b.end
                                  ? `ngoài cửa sổ (${fmtD(b.start)} → ${fmtD(b.end)})`
                                  : 'chưa đặt hạn'}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )
            })}

            <div className="text-muted-foreground mt-3 flex flex-wrap gap-4 border-t pt-2 text-xs">
              <span className="flex items-center gap-1.5">
                <i className="h-2 w-6 rounded-full bg-[color-mix(in_srgb,var(--primary)_55%,transparent)]" />
                đang trong kế hoạch
              </span>
              <span className="flex items-center gap-1.5">
                <i className="h-2 w-6 rounded-full bg-[var(--stop)]" />
                quá hạn còn việc
              </span>
              <span className="flex items-center gap-1.5">
                <i className="bg-muted-foreground/30 h-2 w-6 rounded-full" />
                xong hết
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
