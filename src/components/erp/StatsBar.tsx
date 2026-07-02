/**
 * Bar KPI dense — dùng dưới PageHeader để show 4-8 số liệu inline.
 * Ưu điểm ERP: nhìn 1 phát ra ngay tình trạng, không tốn vertical space.
 */
export type Stat = {
  label: string
  value: number | string
  tone?: 'default' | 'purple' | 'blue' | 'green' | 'amber' | 'red' | 'gray'
  hint?: string
}

const DOT: Record<NonNullable<Stat['tone']>, string> = {
  default: 'bg-zinc-400',
  purple: 'bg-purple-500',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  gray: 'bg-zinc-300',
}

export function StatsBar({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-2 divide-x divide-zinc-200 rounded-lg border border-zinc-200 bg-white sm:grid-cols-3 lg:grid-cols-6 dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
      {stats.map((s, i) => (
        <div key={i} className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${DOT[s.tone ?? 'default']}`} />
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              {s.label}
            </span>
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</div>
          {s.hint && <div className="mt-0.5 text-xs text-zinc-400">{s.hint}</div>}
        </div>
      ))}
    </div>
  )
}
