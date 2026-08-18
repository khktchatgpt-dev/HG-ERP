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
    'border-[color-mix(in_srgb,var(--primary)_35%,transparent)] bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-[var(--primary)]',
  lsx_pending:
    'border-[color-mix(in_srgb,var(--warn)_35%,transparent)] bg-[color-mix(in_srgb,var(--warn)_12%,transparent)] text-[var(--warn)]',
  lsx_issued:
    'border-[color-mix(in_srgb,var(--primary)_35%,transparent)] bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-[var(--primary)]',
  in_production:
    'border-[color-mix(in_srgb,var(--primary)_35%,transparent)] bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-[var(--primary)]',
  completed:
    'border-[color-mix(in_srgb,var(--done)_35%,transparent)] bg-[color-mix(in_srgb,var(--done)_12%,transparent)] text-[var(--done)]',
  delivered:
    'border-[color-mix(in_srgb,var(--done)_35%,transparent)] bg-[color-mix(in_srgb,var(--done)_12%,transparent)] text-[var(--done)]',
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
        <span className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
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
                  i === 0
                    ? 'opacity-0'
                    : done || active
                      ? 'bg-[var(--done)]'
                      : 'bg-border',
                )}
              />
              <span
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold',
                  done
                    ? 'border-[color-mix(in_srgb,var(--done)_35%,transparent)] bg-[var(--done)] text-white'
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
                      ? 'bg-[var(--done)]'
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

/**
 * Vạch sống bên trái dùng tiện ích `.spine` của chủ đề (globals.css) thay cho
 * `before:` gõ tay — cùng một vệt 3px với thẻ phiếu ở /design-lab, đổi bề dày
 * một chỗ là cả app theo.
 */
const KPI_TONE: Record<KpiTone, { value: string; dot: string; spine: string }> = {
  default: { value: 'text-foreground', dot: 'bg-muted', spine: 'var(--border)' },
  amber: {
    value: 'text-[var(--warn)]',
    dot: 'bg-[var(--warn)]',
    spine: 'var(--warn)',
  },
  red: {
    value: 'text-[var(--stop)]',
    dot: 'bg-[var(--stop)]',
    spine: 'var(--stop)',
  },
  emerald: {
    value: 'text-[var(--done)]',
    dot: 'bg-[var(--done)]',
    spine: 'var(--done)',
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
      className="spine bg-card relative overflow-hidden rounded-xl border px-4 py-3.5 shadow-xs"
      style={{ '--spine': t.spine } as React.CSSProperties}
    >
      <div className="t-label text-muted-foreground flex items-center gap-1.5">
        <span className={cn('size-1.5 shrink-0 rounded-full', t.dot)} />
        {label}
      </div>
      {/* Số KPI dùng mặt chữ DỮ LIỆU (JetBrains Mono, tabular) — chuẩn v3:
          mọi mã, tiền, số lượng, ngày đều đi mặt chữ này để cột số thẳng hàng
          giữa các thẻ, không so le theo bề rộng chữ số. */}
      <div
        className={cn(
          'mt-1.5 font-mono text-2xl leading-none font-bold tabular-nums',
          t.value,
        )}
      >
        {value}
      </div>
      {/* Chú thích KHÔNG dùng `t-label`: lớp đó ép viết hoa (đúng cho nhãn cột),
          còn đây là câu chữ thường — "23 đơn mở", không phải "23 ĐƠN MỞ". */}
      {hint && <div className="text-muted-foreground mt-1 text-[11px]">{hint}</div>}
    </div>
  )
}
