import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/shadcn/badge'
import {
  LIFECYCLE_STEPS,
  STATUS_LABEL,
  type OrderProgress,
  type OrderStatus,
} from '@/lib/order-progress'

/**
 * Mảnh trình bày cho màn Quản lý đơn hàng (Ban Giám đốc) — thuần presentational.
 * Buồng lái master-detail đặt ở OrdersOverview (client, có state + hành động).
 */

// ── Tiền theo currency (không quy đổi FX — GĐ đọc nguyên tệ) ────────────────
export function fmtMoney(value: number, currency: string): string {
  const n = value.toLocaleString('vi-VN', { maximumFractionDigits: 0 })
  return currency === 'VND' ? `${n} ₫` : `${n} ${currency}`
}

// ── Badge trạng thái đơn — chip nền mềm (soft-fill), viền cùng tông ───────────
const STATUS_CLS: Record<string, string> = {
  confirmed:
    'border-sky-200/70 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300',
  lsx_pending:
    'border-amber-200/70 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300',
  lsx_issued:
    'border-indigo-200/70 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300',
  in_production:
    'border-violet-200/70 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300',
  completed:
    'border-emerald-200/70 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300',
  delivered:
    'border-green-200/70 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300',
  cancelled: 'border-transparent bg-muted text-muted-foreground line-through',
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn('rounded-full px-2 font-medium', STATUS_CLS[status])}
    >
      {STATUS_LABEL[status] ?? status}
    </Badge>
  )
}

// ── Thanh tiến độ sản xuất ─────────────────────────────────────────────────
export function ProgressMeter({
  p,
  showLabel = true,
}: {
  p: OrderProgress
  showLabel?: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      {showLabel && (
        <span className="flex items-center gap-1.5 text-xs font-medium">
          <span className={cn('h-2 w-2 shrink-0 rounded-full', p.tone)} />
          {p.label}
        </span>
      )}
      <span className="flex items-center gap-1.5">
        <span className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <span
            className={cn('block h-full rounded-full', p.tone)}
            style={{ width: `${p.pct}%` }}
          />
        </span>
        <span className="text-muted-foreground w-8 shrink-0 text-right text-[10px] tabular-nums">
          {p.pct}%
        </span>
      </span>
    </div>
  )
}

// ── Timeline vòng đời đơn (6 bước) ──────────────────────────────────────────
export function LifecycleTimeline({ status }: { status: string }) {
  // 'cancelled' là nhánh phụ — hiển thị mờ toàn chuỗi + nhãn huỷ.
  const cancelled = status === 'cancelled'
  const curIdx = LIFECYCLE_STEPS.findIndex((s) => s.status === (status as OrderStatus))
  return (
    <ol className={cn('flex items-center gap-1', cancelled && 'opacity-50')}>
      {LIFECYCLE_STEPS.map((step, i) => {
        const done = !cancelled && i < curIdx
        const active = !cancelled && i === curIdx
        return (
          <li
            key={step.status}
            className="flex min-w-0 flex-1 flex-col items-center gap-1"
          >
            <div className="flex w-full items-center">
              <span
                className={cn(
                  'h-0.5 flex-1',
                  i === 0 ? 'opacity-0' : done || active ? 'bg-emerald-500' : 'bg-border',
                )}
              />
              <span
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold',
                  done
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : active
                      ? 'border-primary text-primary ring-primary/30 ring-2'
                      : 'border-border text-muted-foreground',
                )}
              >
                {done ? <Check className="size-3" /> : i + 1}
              </span>
              <span
                className={cn(
                  'h-0.5 flex-1',
                  i === LIFECYCLE_STEPS.length - 1
                    ? 'opacity-0'
                    : done
                      ? 'bg-emerald-500'
                      : 'bg-border',
                )}
              />
            </div>
            <span
              className={cn(
                'text-center text-[10px] leading-tight',
                active
                  ? 'text-foreground font-semibold'
                  : done
                    ? 'text-muted-foreground'
                    : 'text-muted-foreground/60',
              )}
            >
              {step.label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

// ── Thẻ KPI ─────────────────────────────────────────────────────────────────
export type KpiTone = 'default' | 'amber' | 'red' | 'emerald'

const KPI_TONE: Record<KpiTone, { value: string; dot: string; rail: string }> = {
  default: {
    value: 'text-foreground',
    dot: 'bg-zinc-300 dark:bg-zinc-600',
    rail: 'before:bg-zinc-200 dark:before:bg-zinc-700',
  },
  amber: {
    value: 'text-amber-600 dark:text-amber-400',
    dot: 'bg-amber-500',
    rail: 'before:bg-amber-400/70',
  },
  red: {
    value: 'text-red-600 dark:text-red-400',
    dot: 'bg-red-500',
    rail: 'before:bg-red-400/70',
  },
  emerald: {
    value: 'text-emerald-600 dark:text-emerald-400',
    dot: 'bg-emerald-500',
    rail: 'before:bg-emerald-400/70',
  },
}

export function KpiCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string
  value: React.ReactNode
  hint?: string
  tone?: KpiTone
}) {
  const t = KPI_TONE[tone]
  return (
    <div
      className={cn(
        'bg-card relative overflow-hidden rounded-xl border border-zinc-200/70 px-4 py-3.5 shadow-sm dark:border-zinc-800',
        // Rail màu mảnh bên trái — chỉ báo mức độ, thay cho viền đậm.
        "before:absolute before:inset-y-0 before:left-0 before:w-1 before:content-['']",
        t.rail,
      )}
    >
      <div className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase">
        <span className={cn('size-1.5 shrink-0 rounded-full', t.dot)} />
        {label}
      </div>
      <div className={cn('mt-1.5 text-2xl leading-none font-bold tabular-nums', t.value)}>
        {value}
      </div>
      {hint && <div className="text-muted-foreground mt-1 text-[11px]">{hint}</div>}
    </div>
  )
}
