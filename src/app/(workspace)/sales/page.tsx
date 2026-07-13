import Link from 'next/link'
import { authService } from '@/modules/core/auth/auth.service'
import { salesService } from '@/modules/dept/sales/sales.service'
import { quotesService } from '@/modules/dept/sales/quotes.service'
import { ordersRepo } from '@/modules/dept/sales/orders.repo'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { assessLateRisk } from '@/lib/late-risk'

/**
 * Trang chủ Sales — màn hình mở mỗi sáng: 8 KPI + "Việc cần làm" (đơn quá
 * hạn / sát hạn, LSX bị từ chối, báo giá nháp để lâu). Sales nhìn vào là biết
 * hôm nay phải xử lý gì, không cần đào từng trang.
 */

const FINAL = new Set(['completed', 'delivered', 'cancelled'])
const STALE_QUOTE_DAYS = 7

const money = (n: number) => n.toLocaleString('vi-VN')

/** Chênh lệch ngày (b − a) trên chuỗi yyyy-mm-dd, UTC. */
function daysBetween(a: string, b: string): number {
  return Math.round(
    (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000,
  )
}

/** Σ giá trị đơn theo từng loại tiền → "1.250.000 USD · 300.000.000 VND". */
function sumByCurrency(
  orders: { id: string; currency: string }[],
  totals: Record<string, number>,
): string {
  const by = new Map<string, number>()
  for (const o of orders) {
    const t = totals[o.id] ?? 0
    if (t > 0) by.set(o.currency, (by.get(o.currency) ?? 0) + t)
  }
  if (by.size === 0) return '0'
  return [...by.entries()].map(([cur, v]) => `${money(v)} ${cur}`).join(' · ')
}

type TodoItem = {
  severity: 'red' | 'amber' | 'gray'
  text: string
  detail: string | null
  href: string
}

export default async function SalesHomePage() {
  const user = (await authService.currentUser())!
  const today = new Date().toISOString().slice(0, 10)
  const thisMonth = today.slice(0, 7) // yyyy-mm

  const [{ total: customerCount }, draftQuotes, sentQuotes, tracking, { rows: orders }] =
    await Promise.all([
      salesService.list(user, { page: 1, page_size: 1, active_only: true }),
      quotesService.list(user, { status: 'draft', page: 1, page_size: 100 }),
      quotesService.list(user, { status: 'sent', page: 1, page_size: 1 }),
      productionRepo.listTracking(),
      ordersRepo.list({ page: 1, page_size: 500 }),
    ])
  const totals = await ordersRepo.totalsByOrderIds(orders.map((o) => o.id))

  // ── KPI ──────────────────────────────────────────────────────────────
  const openTracking = tracking.filter((r) => !FINAL.has(r.status))
  const dueSoon = openTracking.filter(
    (r) => r.due_date && r.due_date >= today && daysBetween(today, r.due_date) <= 7,
  )
  const overdue = openTracking.filter((r) => r.due_date && r.due_date < today)

  const monthOrders = orders.filter(
    (o) => o.created_at.slice(0, 7) === thisMonth && o.status !== 'cancelled',
  )
  const openOrders = orders.filter((o) => !['delivered', 'cancelled'].includes(o.status))

  // ── Việc cần làm ─────────────────────────────────────────────────────
  const todos: TodoItem[] = []
  const riskOrderIds = new Set<string>()

  for (const r of tracking) {
    const risk = assessLateRisk(r, today)
    if (!risk) continue
    riskOrderIds.add(r.id)
    const days = r.due_date ? Math.abs(daysBetween(today, r.due_date)) : 0
    todos.push({
      severity: risk.level === 'overdue' ? 'red' : 'amber',
      text:
        risk.level === 'overdue'
          ? `Đơn ${r.code} quá hạn giao ${days} ngày — ${r.customer_name}`
          : `Đơn ${r.code} giao trong ${days} ngày — ${r.customer_name}`,
      detail: risk.reasons.length ? risk.reasons.join(' · ') : null,
      href: `/sales/orders/${r.id}`,
    })
  }

  // LSX bị từ chối mà chưa nằm trong danh sách rủi ro ở trên.
  for (const r of tracking) {
    if (r.lsx_status !== 'rejected' || FINAL.has(r.status) || riskOrderIds.has(r.id))
      continue
    todos.push({
      severity: 'red',
      text: `LSX ${r.lsx_code} của đơn ${r.code} bị từ chối — sửa và nộp lại`,
      detail: r.customer_name,
      href: `/sales/orders/${r.id}`,
    })
  }

  // Báo giá nháp để lâu chưa gửi.
  for (const q of draftQuotes.rows) {
    const age = daysBetween(q.created_at.slice(0, 10), today)
    if (age < STALE_QUOTE_DAYS) continue
    todos.push({
      severity: 'gray',
      text: `Báo giá ${q.code} nháp ${age} ngày chưa gửi — ${q.customer_name}`,
      detail: null,
      href: '/sales/quotes',
    })
  }

  const sevRank = { red: 0, amber: 1, gray: 2 }
  todos.sort((a, b) => sevRank[a.severity] - sevRank[b.severity])

  return (
    <>
      <h1 className="mb-1 text-lg font-semibold">
        Trang chủ Sales — chào {user.name ?? user.email}
      </h1>
      <p className="mb-4 text-sm text-zinc-500">
        Hôm nay {new Date().toLocaleDateString('vi-VN')} · {todos.length} việc cần chú ý
      </p>

      {/* 8 KPI */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Khách hàng active"
          value={String(customerCount)}
          href="/sales/customers"
        />
        <Kpi
          label="Báo giá nháp"
          value={String(draftQuotes.total)}
          href="/sales/quotes"
        />
        <Kpi
          label="Đã gửi, chờ phản hồi"
          value={String(sentQuotes.total)}
          href="/sales/quotes"
        />
        <Kpi
          label="Đơn đang thực hiện"
          value={String(openTracking.length)}
          href="/sales/tracking"
        />
        <Kpi
          label="Sắp giao (≤7 ngày)"
          value={String(dueSoon.length)}
          tone={dueSoon.length ? 'amber' : undefined}
          href="/sales/tracking"
        />
        <Kpi
          label="Đơn trễ hạn"
          value={String(overdue.length)}
          tone={overdue.length ? 'red' : undefined}
          href="/sales/tracking"
        />
        <Kpi
          label="Giá trị đơn tháng này"
          value={sumByCurrency(monthOrders, totals)}
          small
          href="/sales/orders"
        />
        <Kpi
          label="Doanh thu dự kiến (đơn mở)"
          value={sumByCurrency(openOrders, totals)}
          small
          href="/sales/orders"
        />
      </div>

      {/* Việc cần làm */}
      <div className="mt-8">
        <h2 className="mb-2 text-sm font-semibold text-zinc-500 uppercase">
          Việc cần làm
        </h2>
        {todos.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 py-6 text-center text-sm text-zinc-400 dark:border-zinc-700">
            Không có việc gấp — mọi đơn và báo giá đều trong tầm kiểm soát 🎉
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {todos.slice(0, 12).map((t, i) => (
              <li key={i}>
                <Link
                  href={t.href}
                  className="flex items-start gap-2.5 px-4 py-2.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                >
                  <span
                    className={
                      'mt-1.5 h-2 w-2 shrink-0 rounded-full ' +
                      (t.severity === 'red'
                        ? 'bg-red-500'
                        : t.severity === 'amber'
                          ? 'bg-amber-500'
                          : 'bg-zinc-300 dark:bg-zinc-600')
                    }
                  />
                  <span className="min-w-0">
                    <span className="font-medium">{t.text}</span>
                    {t.detail && (
                      <span className="mt-0.5 block text-xs text-zinc-400">
                        {t.detail}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
            {todos.length > 12 && (
              <li className="px-4 py-2 text-center text-xs text-zinc-400">
                + {todos.length - 12} việc khác — xem Theo dõi đơn / Báo giá
              </li>
            )}
          </ul>
        )}
      </div>

      {/* Truy cập nhanh */}
      <div className="mt-8">
        <h2 className="mb-2 text-sm font-semibold text-zinc-500 uppercase">
          Truy cập nhanh
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickLink href="/sales/quotes" title="Báo giá" desc="Lập & gửi khách" />
          <QuickLink href="/sales/orders" title="Đơn hàng" desc="Tạo đơn, phát LSX" />
          <QuickLink
            href="/sales/tracking"
            title="Theo dõi đơn"
            desc="Tiến độ & cảnh báo"
          />
          <QuickLink href="/sales/customers" title="Khách hàng" desc="Hồ sơ & lịch sử" />
        </div>
      </div>
    </>
  )
}

function Kpi({
  label,
  value,
  hint,
  tone,
  small,
  href,
}: {
  label: string
  value: string
  hint?: string
  tone?: 'red' | 'amber'
  small?: boolean
  href: string
}) {
  const valueColor =
    tone === 'red'
      ? 'text-red-600 dark:text-red-400'
      : tone === 'amber'
        ? 'text-amber-600 dark:text-amber-500'
        : ''
  return (
    <Link
      href={href}
      className="block rounded-lg border border-zinc-200 bg-white p-4 hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
    >
      <div className="text-xs font-medium text-zinc-500 uppercase">{label}</div>
      <div
        className={`mt-2 font-semibold tabular-nums ${small ? 'text-base leading-snug' : 'text-3xl'} ${valueColor}`}
      >
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-zinc-400">{hint}</div>}
    </Link>
  )
}

function QuickLink({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-zinc-200 bg-white p-4 hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
    >
      <div className="font-medium">{title}</div>
      <div className="mt-1 text-xs text-zinc-500">{desc}</div>
    </Link>
  )
}
