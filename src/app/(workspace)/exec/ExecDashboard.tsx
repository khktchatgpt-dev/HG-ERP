import Link from 'next/link'
import { PageHeader } from '@/components/erp/PageHeader'
import { Badge } from '@/components/Badge'
import type { ExecDashboard as Data } from '@/modules/core/exec/exec.service'

/**
 * BẢNG TIN ĐIỀU HÀNH (/exec) — Giám đốc nhìn hai phòng đang vận hành trên hệ
 * thống: BÁN (Sale) và MUA (Cung ứng). Xếp theo lối quản trị NGOẠI LỆ: việc cần
 * quyết và thứ đang trục trặc đứng trước, số tổng hợp xuống dưới.
 *
 * Server component — chỉ đọc, mọi thẻ dẫn về màn tác nghiệp của phòng.
 */

const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN')

const PO_STATUS_LABEL: Record<string, string> = {
  draft: 'Nháp',
  pending_approval: 'Chờ duyệt',
  approved: 'Đã duyệt',
  ordered: 'Đã gửi NCC',
  confirmed: 'NCC xác nhận',
  in_transit: 'Đang giao',
  partial: 'Về một phần',
  received: 'Về đủ',
}

/** Tiền theo nhiều tiền tệ — không cộng chung USD với VND. */
function Money({ rows }: { rows: { currency: string; value: number }[] }) {
  if (rows.length === 0) return <span className="text-zinc-400">—</span>
  return (
    <span className="flex flex-wrap items-baseline gap-x-2">
      {rows.map((r) => (
        <span key={r.currency} className="tabular-nums">
          {fmt(r.value)} <span className="text-xs text-zinc-400">{r.currency}</span>
        </span>
      ))}
    </span>
  )
}

function Card({
  title,
  href,
  hint,
  children,
}: {
  title: string
  href?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
          {title}
        </h3>
        {href && (
          <Link href={href} className="text-xs text-sky-600 hover:underline">
            Mở →
          </Link>
        )}
      </div>
      {children}
      {hint && <p className="text-[11px] text-zinc-400">{hint}</p>}
    </div>
  )
}

/** Một dòng "ngoại lệ": số lớn + nhãn + vài mã ví dụ. */
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
  const color =
    tone === 'red'
      ? 'text-red-600 dark:text-red-400'
      : 'text-amber-600 dark:text-amber-500'
  return (
    <Link
      href={href}
      className="flex items-baseline gap-3 rounded-lg px-2 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-900"
    >
      <span className={`w-10 text-right text-xl font-semibold tabular-nums ${color}`}>
        {count}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-sm">{label}</span>
        {samples.length > 0 && (
          <span className="truncate text-[11px] text-zinc-400">
            {samples.join(' · ')}
          </span>
        )}
      </span>
    </Link>
  )
}

export function ExecDashboard({ data }: { data: Data }) {
  const { todo, issues, sales, supply, gaps } = data
  const issueCount =
    issues.overdue_orders.length +
    issues.late_pos.length +
    issues.stuck_pos.length +
    issues.low_stock.length
  const decideCount = todo.lsx_pending + todo.po_pending

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[{ label: 'Ban Giám đốc' }, { label: 'Bảng tin điều hành' }]}
        title="Bảng tin điều hành"
        description="Thông tin trọng yếu của hai phòng Bán hàng và Cung ứng — việc cần quyết, thứ đang trục trặc, rồi mới tới số tổng hợp."
      />

      {/* ── 1. Cần bạn quyết ── */}
      <section>
        <h2 className="mb-2 text-xs font-semibold tracking-wider text-zinc-500 uppercase">
          Cần bạn quyết
        </h2>
        {decideCount === 0 ? (
          <p className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
            Không có phiếu nào chờ chữ ký của bạn.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Card
              title="Lệnh sản xuất chờ duyệt"
              href="/exec/approvals"
              hint={
                todo.lsx_oldest_days != null
                  ? `Phiếu chờ lâu nhất: ${todo.lsx_oldest_days} ngày`
                  : undefined
              }
            >
              <p className="text-3xl font-semibold tabular-nums">{todo.lsx_pending}</p>
            </Card>
            <Card
              title="Đơn mua vật tư chờ duyệt"
              href="/exec/approvals"
              hint={
                todo.po_oldest_days != null
                  ? `Phiếu chờ lâu nhất: ${todo.po_oldest_days} ngày`
                  : undefined
              }
            >
              <p className="text-3xl font-semibold tabular-nums">{todo.po_pending}</p>
              <div className="text-sm text-zinc-600 dark:text-zinc-400">
                Giá trị: <Money rows={todo.po_pending_value} />
              </div>
            </Card>
          </div>
        )}
      </section>

      {/* ── 2. Đang trục trặc ── */}
      <section>
        <h2 className="mb-2 text-xs font-semibold tracking-wider text-zinc-500 uppercase">
          Đang trục trặc
        </h2>
        <div className="rounded-xl border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
          {issueCount === 0 ? (
            <p className="px-2 py-2 text-xs text-zinc-500">
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

      {/* ── 3. Hai vế Bán / Mua ── */}
      <section className="grid gap-3 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
            Bán — phòng Bán hàng
          </h2>
          <Card title="Đơn hàng đang mở" href="/exec/orders">
            <p className="text-3xl font-semibold tabular-nums">{sales.open_orders}</p>
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              Giá trị: <Money rows={sales.open_value} />
            </div>
          </Card>
          <Card
            title="Sắp tới hạn giao (≤ 7 ngày)"
            href="/exec/orders"
            hint={
              sales.due_soon.length === 0
                ? 'Không đơn nào tới hạn trong tuần.'
                : undefined
            }
          >
            {sales.due_soon.length > 0 && (
              <ul className="flex flex-col gap-1 text-sm">
                {sales.due_soon.slice(0, 5).map((o) => (
                  <li key={o.id} className="flex items-baseline justify-between gap-2">
                    <span className="truncate">
                      <span className="font-mono text-xs text-zinc-400">{o.code}</span>{' '}
                      {o.customer_name}
                    </span>
                    <Badge tone={o.days_left <= 2 ? 'red' : 'amber'}>
                      {o.days_left === 0 ? 'hôm nay' : `còn ${o.days_left}n`}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card
            title="Khách hàng lớn nhất (đơn đang mở)"
            href="/sales/customers"
            hint={
              gaps.order_lines_without_price > 0
                ? 'Xếp hạng theo giá trị — hiện chưa chuẩn vì đơn còn thiếu giá.'
                : undefined
            }
          >
            {sales.top_customers.length === 0 ? (
              <p className="text-xs text-zinc-400">Chưa có đơn đang mở.</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {sales.top_customers.map((c) => (
                  <li
                    key={`${c.name}${c.currency}`}
                    className="flex justify-between gap-2"
                  >
                    <span className="truncate">{c.name}</span>
                    <span className="whitespace-nowrap tabular-nums">
                      {fmt(c.value)}{' '}
                      <span className="text-xs text-zinc-400">
                        {c.currency} · {c.orders} đơn
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
            Mua — phòng Cung ứng
          </h2>
          <Card title="Đơn mua đang chạy" href="/exec/purchasing">
            <p className="text-3xl font-semibold tabular-nums">{supply.open_pos}</p>
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              Giá trị: <Money rows={supply.open_value} />
            </div>
          </Card>
          <Card title="Đơn mua theo trạng thái" href="/exec/purchasing">
            {supply.by_status.length === 0 ? (
              <p className="text-xs text-zinc-400">Chưa có đơn mua nào trên hệ thống.</p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {supply.by_status.map((s) => (
                  <li key={s.status}>
                    <Badge tone={s.status === 'pending_approval' ? 'amber' : 'gray'}>
                      {PO_STATUS_LABEL[s.status] ?? s.status}: {s.count}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Nhà cung cấp lớn nhất (đơn đang chạy)" href="/exec/purchasing">
            {supply.top_suppliers.length === 0 ? (
              <p className="text-xs text-zinc-400">Chưa có đơn mua đang chạy.</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {supply.top_suppliers.map((s) => (
                  <li
                    key={`${s.name}${s.currency}`}
                    className="flex justify-between gap-2"
                  >
                    <span className="truncate">{s.name}</span>
                    <span className="whitespace-nowrap tabular-nums">
                      {fmt(s.value)}{' '}
                      <span className="text-xs text-zinc-400">
                        {s.currency} · {s.pos} đơn
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </section>

      {/* ── 4. Nói thẳng vì sao số tiền đang bằng 0 ── */}
      {gaps.order_lines_without_price > 0 && (
        <section className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950/30">
          <b>Số liệu doanh số chưa dùng được:</b> {gaps.order_lines_without_price}/
          {gaps.order_lines_total} dòng đơn hàng chưa có đơn giá, nên mọi con số tiền ở vế
          Bán đang tính thiếu. Cần phòng Bán hàng nhập giá cho các đơn đang mở.{' '}
          <Link href="/sales/orders" className="underline">
            Mở sổ đơn hàng →
          </Link>
        </section>
      )}
    </div>
  )
}
