/**
 * Bar KPI dense — dùng dưới PageHeader để show 4-8 số liệu inline.
 * Ưu điểm ERP: nhìn 1 phát ra ngay tình trạng, không tốn vertical space.
 *
 * Chấm màu lấy từ TOKEN trạng thái: blue/purple → --primary (màu hành động),
 * green → --done, amber → --warn, red → --stop. Con số dùng mặt chữ dữ liệu
 * (mono, tabular) theo chuẩn v3 — cột số thẳng hàng giữa các ô.
 */
export type Stat = {
  label: string
  value: number | string
  tone?: 'default' | 'purple' | 'blue' | 'green' | 'amber' | 'red' | 'gray'
  hint?: string
}

const DOT: Record<NonNullable<Stat['tone']>, string> = {
  default: 'var(--muted-foreground)',
  purple: 'var(--primary)',
  blue: 'var(--primary)',
  green: 'var(--done)',
  amber: 'var(--warn)',
  red: 'var(--stop)',
  gray: 'var(--border)',
}

export function StatsBar({ stats }: { stats: Stat[] }) {
  return (
    <div className="divide-border bg-card grid grid-cols-2 divide-x rounded-lg border sm:grid-cols-3 lg:grid-cols-6">
      {stats.map((s, i) => (
        <div key={i} className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: DOT[s.tone ?? 'default'] }}
            />
            <span className="t-label text-muted-foreground truncate">{s.label}</span>
          </div>
          <div className="mt-1 font-mono text-2xl font-semibold tracking-tight tabular-nums">
            {s.value}
          </div>
          {s.hint && <div className="text-muted-foreground mt-0.5 text-xs">{s.hint}</div>}
        </div>
      ))}
    </div>
  )
}
