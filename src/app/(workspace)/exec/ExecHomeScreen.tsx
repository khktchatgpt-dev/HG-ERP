import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  Factory,
  FileText,
  ShoppingCart,
  Stamp,
} from 'lucide-react'
import { PageHeader } from '@/components/erp/PageHeader'
import { Badge } from '@/components/Badge'
import { cn } from '@/lib/utils'
import type { ExecDashboard } from '@/modules/core/exec/exec.service'

/**
 * TỔNG QUAN (/exec) — màn mở đầu của Giám đốc, thiết kế lại 15/08/2026 theo
 * mô hình "công việc cần xử lý" (docs/exec-v3-approval-center.md). Ba khối,
 * đúng thứ tự Giám đốc cần trả lời khi mở máy:
 *   1. CHỜ TÔI PHÊ DUYỆT — hôm nay tôi phải ký gì? (nổi bật nhất, bấm là tới
 *      Trung tâm phê duyệt đã lọc sẵn loại phiếu)
 *   2. TÌNH HÌNH HOẠT ĐỘNG — công ty đang chạy thế nào? (4 con số, chỉ đọc)
 *   3. CẦN CHÚ Ý — có gì đang trục trặc? (ngoại lệ đứng trước số đẹp)
 *
 * Server component, chỉ đọc. Mọi ô đều dẫn về màn xử lý tương ứng.
 */

const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN')

/** Tiền theo nhiều tiền tệ — USD và VND không bao giờ cộng chung. */
function Money({ rows }: { rows: { currency: string; value: number }[] }) {
  if (rows.length === 0) return <span className="text-muted-foreground">—</span>
  return (
    <span className="flex flex-wrap items-baseline gap-x-2">
      {rows.map((r) => (
        <span key={r.currency} className="tabular-nums">
          {fmt(r.value)}{' '}
          <span className="text-muted-foreground text-xs">{r.currency}</span>
        </span>
      ))}
    </span>
  )
}

/** Thẻ "chờ phê duyệt" — to, bấm được, dẫn thẳng vào Trung tâm phê duyệt. */
function ApprovalCard({
  href,
  icon: Icon,
  label,
  count,
  oldestDays,
  value,
}: {
  href: string
  icon: typeof Stamp
  label: string
  count: number
  oldestDays: number | null
  value?: { currency: string; value: number }[]
}) {
  return (
    <Link
      href={href}
      className={cn(
        'bg-card group flex flex-col gap-1 rounded-xl border p-4 transition-colors',
        count > 0
          ? 'border-amber-300 hover:border-amber-400 dark:border-amber-800 dark:hover:border-amber-700'
          : 'hover:bg-accent/50',
      )}
    >
      <span className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
        <Icon className="size-3.5" aria-hidden />
        {label}
      </span>
      <span className="flex items-baseline gap-2">
        <span
          className={cn(
            'text-4xl font-semibold tabular-nums',
            count > 0 && 'text-amber-700 dark:text-amber-400',
          )}
        >
          {count}
        </span>
        <span className="text-muted-foreground text-sm">chờ duyệt</span>
      </span>
      <span className="text-muted-foreground min-h-4 text-xs">
        {count > 0 ? (
          <>
            {oldestDays != null && oldestDays > 0 && `lâu nhất ${oldestDays} ngày`}
            {value && value.length > 0 && (
              <>
                {oldestDays != null && oldestDays > 0 && ' · '}
                <Money rows={value} />
              </>
            )}
          </>
        ) : (
          'không có phiếu chờ'
        )}
      </span>
      <span className="text-primary mt-1 inline-flex items-center gap-1 text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100">
        Mở duyệt <ArrowRight className="size-3" aria-hidden />
      </span>
    </Link>
  )
}

/** Ô số "tình hình hoạt động" — con số + nhãn + tiền (nếu có), bấm là tới màn theo dõi. */
function StatCard({
  href,
  label,
  count,
  sub,
}: {
  href: string
  label: string
  count: number
  sub?: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="bg-card hover:bg-accent/50 flex flex-col gap-0.5 rounded-xl border p-4 transition-colors"
    >
      <span className="text-2xl font-semibold tabular-nums">{count}</span>
      <span className="text-sm">{label}</span>
      {sub && <span className="text-muted-foreground text-xs">{sub}</span>}
    </Link>
  )
}

/** Một dòng "cần chú ý": số + chuyện gì + vài mã ví dụ, bấm là tới màn xử lý. */
function IssueRow({
  tone,
  count,
  label,
  samples,
  href,
}: {
  tone: 'red' | 'amber'
  count: number
  label: string
  samples: string[]
  href: string
}) {
  return (
    <Link
      href={href}
      className="hover:bg-accent/50 flex items-baseline gap-3 rounded-lg px-2 py-1.5"
    >
      <span
        className={cn(
          'w-10 text-right text-xl font-semibold tabular-nums',
          tone === 'red'
            ? 'text-red-600 dark:text-red-400'
            : 'text-amber-600 dark:text-amber-500',
        )}
      >
        {count}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-sm">{label}</span>
        {samples.length > 0 && (
          <span className="text-muted-foreground truncate text-[11px]">
            {samples.join(' · ')}
          </span>
        )}
      </span>
    </Link>
  )
}

export function ExecHomeScreen({
  data,
  userName,
}: {
  data: ExecDashboard
  userName: string
}) {
  const { todo, issues, sales, supply, production, gaps } = data
  const pendingTotal = todo.lsx_pending + todo.po_pending + todo.quote_pending
  const issueCount =
    issues.overdue_orders.length +
    issues.late_pos.length +
    issues.stuck_pos.length +
    issues.low_stock.length
  /* "0 phiếu chờ" có hai nghĩa trái ngược: đã duyệt hết ↔ chưa ai từng lập
     phiếu. by_status đếm MỌI trạng thái nên phân biệt được hai chuyện đó. */
  const poEverExists = supply.by_status.length > 0
  const lsxEverExists = production.by_status.length > 0

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Xin chào, ${userName}`}
        description={
          pendingTotal > 0
            ? `Có ${pendingTotal} phiếu đang chờ chữ ký của bạn.`
            : 'Không có phiếu nào chờ chữ ký của bạn.'
        }
        actions={
          pendingTotal > 0 ? (
            <Link
              href="/exec/approvals"
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium"
            >
              <Stamp className="size-4" aria-hidden />
              Duyệt ngay ({pendingTotal})
            </Link>
          ) : undefined
        }
      />

      {/* ── 1. Chờ tôi phê duyệt ─────────────────────────────────────────── */}
      <section>
        <h2 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
          Chờ tôi phê duyệt
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <ApprovalCard
            href="/exec/approvals?loai=lsx"
            icon={Factory}
            label="Lệnh sản xuất"
            count={todo.lsx_pending}
            oldestDays={todo.lsx_oldest_days}
          />
          <ApprovalCard
            href="/exec/approvals?loai=po"
            icon={ShoppingCart}
            label="Đơn mua vật tư"
            count={todo.po_pending}
            oldestDays={todo.po_oldest_days}
            value={todo.po_pending_value}
          />
          <ApprovalCard
            href="/exec/approvals?loai=quote"
            icon={FileText}
            label="Báo giá"
            count={todo.quote_pending}
            oldestDays={todo.quote_oldest_days}
          />
        </div>
        {pendingTotal === 0 && !(poEverExists && lsxEverExists) && (
          <p className="text-muted-foreground mt-2 text-xs">
            {!lsxEverExists && !poEverExists
              ? 'Hệ thống chưa từng có phiếu nào được lập — không phải bạn đã ký hết.'
              : !poEverExists
                ? 'Riêng đơn mua thì chưa có đơn nào trên hệ thống — phòng Cung ứng còn làm ngoài Excel.'
                : 'Chưa có lệnh sản xuất nào trên hệ thống.'}
          </p>
        )}
      </section>

      {/* ── 2. Tình hình hoạt động ───────────────────────────────────────── */}
      <section>
        <h2 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
          Tình hình hoạt động
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            href="/exec/orders"
            label="Đơn hàng đang thực hiện"
            count={sales.open_orders}
            sub={sales.open_value.length > 0 && <Money rows={sales.open_value} />}
          />
          <StatCard
            href="/exec/production"
            label="Lệnh sản xuất đang chạy"
            count={production.running}
          />
          <StatCard
            href="/exec/purchasing"
            label="Đơn mua đang xử lý"
            count={supply.open_pos}
            sub={supply.open_value.length > 0 && <Money rows={supply.open_value} />}
          />
          <StatCard
            href="/warehouse/stock"
            label="Vật tư dưới tồn tối thiểu"
            count={issues.low_stock.length}
          />
        </div>
      </section>

      {/* ── 3. Cần chú ý ─────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
          <AlertTriangle className="size-3.5" aria-hidden />
          Cần chú ý
        </h2>
        <div className="bg-card rounded-xl border p-2">
          {issueCount === 0 ? (
            <p className="text-muted-foreground px-2 py-2 text-xs">
              Không có cảnh báo nào — đơn hàng đúng hạn, hàng mua về đúng hẹn, tồn kho
              trên mức tối thiểu.
            </p>
          ) : (
            <div className="grid gap-1 sm:grid-cols-2">
              {issues.overdue_orders.length > 0 && (
                <IssueRow
                  tone="red"
                  count={issues.overdue_orders.length}
                  label="đơn hàng trễ hạn giao"
                  samples={issues.overdue_orders
                    .slice(0, 3)
                    .map((o) => `${o.code} (${o.days_late}n)`)}
                  href="/exec/orders"
                />
              )}
              {issues.late_pos.length > 0 && (
                <IssueRow
                  tone="red"
                  count={issues.late_pos.length}
                  label="đơn mua quá hẹn giao của NCC"
                  samples={issues.late_pos
                    .slice(0, 3)
                    .map((p) => `${p.code} (${p.days_late}n)`)}
                  href="/exec/purchasing"
                />
              )}
              {issues.stuck_pos.length > 0 && (
                <IssueRow
                  tone="amber"
                  count={issues.stuck_pos.length}
                  label="đơn đã duyệt nhưng chưa gửi NCC"
                  samples={issues.stuck_pos
                    .slice(0, 3)
                    .map((p) => `${p.code} (${p.days_idle}n)`)}
                  href="/exec/purchasing"
                />
              )}
              {issues.low_stock.length > 0 && (
                <IssueRow
                  tone="amber"
                  count={issues.low_stock.length}
                  label="vật tư dưới mức tồn tối thiểu"
                  samples={issues.low_stock.slice(0, 3).map((m) => m.code)}
                  href="/warehouse/stock"
                />
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── 4. Sắp tới hạn giao — GĐ cần thấy trước khi khách gọi ────────── */}
      {sales.due_soon.length > 0 && (
        <section>
          <h2 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
            Sắp tới hạn giao (≤ 7 ngày)
          </h2>
          <ul className="bg-card flex flex-col gap-1 rounded-xl border p-3 text-sm">
            {sales.due_soon.slice(0, 6).map((o) => (
              <li key={o.id} className="flex items-baseline justify-between gap-2">
                <span className="truncate">
                  <span className="text-muted-foreground font-mono text-xs">
                    {o.code}
                  </span>{' '}
                  {o.customer_name}
                </span>
                <Badge tone={o.days_left <= 2 ? 'red' : 'amber'}>
                  {o.days_left === 0 ? 'hôm nay' : `còn ${o.days_left}n`}
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── 5. Nói thẳng vì sao số tiền đang thiếu ───────────────────────── */}
      {gaps.order_lines_without_price > 0 && (
        <section className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950/30">
          <b>Số liệu doanh số chưa dùng được:</b> {gaps.order_lines_without_price}/
          {gaps.order_lines_total} dòng đơn hàng chưa có đơn giá, nên mọi con số tiền ở
          trên đang tính thiếu. Cần phòng Bán hàng nhập giá cho các đơn đang mở.{' '}
          <Link href="/sales/orders/gia" className="underline">
            Mở màn điền đơn giá →
          </Link>
        </section>
      )}
    </div>
  )
}
