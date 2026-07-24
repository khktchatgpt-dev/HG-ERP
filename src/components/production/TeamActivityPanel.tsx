import type { ProductionEntryJoined } from '@/modules/dept/production/entries.repo'

/**
 * QUÁ TRÌNH CỦA TỔ (0087) — 4 ô Hôm nay/7 ngày/Phế/Đang làm + bảng sổ thống
 * kê đã ghi cho tổ. Component thuần (server render được) — trang Tổ dùng.
 */

const fmtD = (d: string) => new Date(d).toLocaleDateString('vi-VN')
const fmtN = (n: number) => n.toLocaleString('vi-VN')

export function TeamActivityPanel({
  rows,
  doingCount,
  full = false,
}: {
  /** Sổ 7 ngày gần nhất của tổ (entriesRepo.listRecentByTeam). */
  rows: ProductionEntryJoined[]
  doingCount: number
  /** true = bảng đầy đủ (trang Quá trình tổ); false = 10 dòng gần nhất. */
  full?: boolean
}) {
  const today = new Date().toISOString().slice(0, 10)
  const todayQty = rows
    .filter((r) => r.entry_date === today)
    .reduce((a, r) => a + r.qty, 0)
  const weekQty = rows.reduce((a, r) => a + r.qty, 0)
  const weekDefect = rows.reduce((a, r) => a + r.defect_qty, 0)
  const shown = full ? rows : rows.slice(0, 10)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl border border-green-200 bg-green-50/60 px-3 py-2 dark:border-green-900 dark:bg-green-950/30">
          <div className="text-[11px] text-zinc-500 uppercase">Hôm nay</div>
          <div className="text-lg font-bold text-green-700 dark:text-green-400">
            +{fmtN(todayQty)}
          </div>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="text-[11px] text-zinc-500 uppercase">7 ngày</div>
          <div className="text-lg font-bold">+{fmtN(weekQty)}</div>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="text-[11px] text-zinc-500 uppercase">Phế 7 ngày</div>
          <div
            className={`text-lg font-bold ${weekDefect > 0 ? 'text-red-600 dark:text-red-400' : ''}`}
          >
            {fmtN(weekDefect)}
          </div>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="text-[11px] text-zinc-500 uppercase">Việc đang làm</div>
          <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
            {doingCount}
          </div>
        </div>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
          <h2 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
            Sổ thống kê đã ghi ({full ? 'sổ 7 ngày' : '10 dòng gần nhất'})
          </h2>
        </div>
        {shown.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-zinc-400">
            Chưa có bản ghi nào trong 7 ngày.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
            {shown.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-4 py-2 text-sm"
              >
                <span className="w-16 shrink-0 text-xs text-zinc-400">
                  {fmtD(e.entry_date)}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">
                  {e.component_name ?? '?'}
                </span>
                <span className="font-mono text-xs text-zinc-400">{e.lsx_code}</span>
                <b className="text-green-600 dark:text-green-400">+{fmtN(e.qty)}</b>
                {e.defect_qty > 0 && (
                  <span className="text-xs text-red-500">phế {fmtN(e.defect_qty)}</span>
                )}
                {full && (
                  <span className="text-xs text-zinc-400">
                    {e.created_by_name ?? ''}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
