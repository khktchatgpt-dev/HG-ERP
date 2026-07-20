import Link from 'next/link'
import { authService } from '@/modules/core/auth/auth.service'
import { posService } from '@/modules/dept/supply/pos.service'
import { posRepo } from '@/modules/dept/supply/pos.repo'
import { productionService } from '@/modules/dept/production/production.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { teamService } from '@/modules/dept/production/team.service'
import { incidentsService } from '@/modules/dept/production/incidents.service'
import { stockRepo } from '@/modules/dept/warehouse/stock.repo'
import { assessLateRisk, assessPoLate } from '@/lib/late-risk'
import { Badge } from '@/components/Badge'
import { StatsBar } from '@/components/erp/StatsBar'

/**
 * TOÀN CẢNH ĐIỀU HÀNH — trang đích DUY NHẤT của Giám đốc/GĐ điều hành
 * (user chốt 07/2026): một màn bao quát mọi thông tin — chờ duyệt, nguy cơ
 * trễ, sản xuất theo tổ, sự cố, mua hàng & kho. Chỉ đọc + link; thao tác
 * duyệt ở /exec/approvals, xử lý sự cố/tiến độ ở /production/progress.
 * Workspace exec KÍN: chỉ admin/manager (access.ts) — NV không vào được.
 */
export default async function ExecOverviewPage() {
  const user = (await authService.currentUser())!
  const today = new Date().toISOString().slice(0, 10)

  const [
    tracking,
    { rows: pendingLsx },
    { rows: pendingPos },
    { rows: allLsx },
    allPos,
    workload,
    openIncidents,
    lowStock,
    stages,
  ] = await Promise.all([
    productionService.tracking(),
    productionService.list(user, { status: 'pending_approval', page: 1, page_size: 200 }),
    posService.list(user, { status: 'pending_approval', page: 1, page_size: 200 }),
    productionService.list(user, { page: 1, page_size: 500 }),
    posService.list(user, { page: 1, page_size: 500 }),
    teamService.workloadByTeam(),
    incidentsService.list(user, { status: 'open' }),
    stockRepo.list({ low_only: true }),
    productionRepo.listStages(),
  ])

  // GĐ cần thấy tổng tiền cam kết của hàng chờ duyệt.
  const poTotals = await Promise.all(
    pendingPos.map(async (p) => {
      const lines = await posRepo.listLines(p.id)
      return lines.reduce((s, l) => s + l.qty_ordered * (l.unit_price ?? 0), 0)
    }),
  )
  const pendingPoTotal = poTotals.reduce((a, b) => a + b, 0)

  const FINAL = new Set(['completed', 'delivered', 'cancelled'])
  const runningOrders = tracking.filter((r) => !FINAL.has(r.status))
  const lateOrders = runningOrders
    .map((r) => ({ r, risk: assessLateRisk(r, today) }))
    .filter((x) => x.risk)
    .sort((a, b) => {
      const rank = (l: 'overdue' | 'at_risk') => (l === 'overdue' ? 0 : 1)
      return rank(a.risk!.level) - rank(b.risk!.level)
    })
  const producing = allLsx.filter((l) => l.status === 'in_progress').length
  const waitingProd = allLsx.filter((l) => l.status === 'approved').length
  const latePos = allPos.rows.filter((p) => assessPoLate(p, today) === 'overdue')
  const stageLabel = (code: string | null) =>
    code ? (stages.find((s) => s.code === code)?.label ?? code) : null

  const fmtD = (d: string | null) => (d ? new Date(d).toLocaleDateString('vi-VN') : '—')
  const fmtT = (iso: string) =>
    new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  const money = (n: number) => n.toLocaleString('vi-VN')

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">Toàn cảnh điều hành</h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Chào {user.name ?? user.email} · {runningOrders.length} đơn đang chạy ·{' '}
          {producing} LSX đang sản xuất
        </p>
      </div>

      <StatsBar
        stats={[
          { label: 'Đơn đang chạy', value: runningOrders.length, tone: 'blue' },
          {
            label: 'Nguy cơ trễ',
            value: lateOrders.length,
            tone: lateOrders.length ? 'red' : 'gray',
          },
          {
            label: 'Chờ GĐ duyệt',
            value: pendingLsx.length + pendingPos.length,
            tone: pendingLsx.length + pendingPos.length ? 'amber' : 'gray',
            hint: `${pendingLsx.length} LSX · ${pendingPos.length} PO`,
          },
          {
            label: 'Đang sản xuất',
            value: producing,
            tone: 'amber',
            hint: `${waitingProd} chờ vào SX`,
          },
          {
            label: 'Sự cố đang mở',
            value: openIncidents.length,
            tone: openIncidents.length ? 'red' : 'gray',
          },
          {
            label: 'Vật tư dưới tồn min',
            value: lowStock.length,
            tone: lowStock.length ? 'amber' : 'gray',
          },
        ]}
      />

      {/* ── Chờ giám đốc quyết ── */}
      <section>
        <SectionLabel>Chờ giám đốc quyết</SectionLabel>
        <div className="grid gap-3 sm:grid-cols-2">
          <BigAction
            tone={pendingLsx.length ? 'amber' : 'gray'}
            value={pendingLsx.length}
            label="Lệnh sản xuất chờ duyệt"
            sub={
              pendingLsx.length
                ? pendingLsx
                    .slice(0, 3)
                    .map((l) => l.code)
                    .join(' · ') + (pendingLsx.length > 3 ? ' …' : '')
                : 'Không có lệnh nào chờ'
            }
            href="/exec/approvals"
          />
          <BigAction
            tone={pendingPos.length ? 'amber' : 'gray'}
            value={pendingPos.length}
            label="Đơn đặt vật tư chờ duyệt"
            sub={
              pendingPos.length
                ? `Tổng cam kết ~ ${money(pendingPoTotal)}`
                : 'Không có PO nào chờ'
            }
            href="/exec/approvals"
          />
        </div>
      </section>

      {/* ── Nguy cơ trễ hạn ── */}
      <section>
        <SectionLabel>
          Nguy cơ trễ hạn ({lateOrders.length})
          <HeaderLink href="/exec/tracking">Theo dõi đơn →</HeaderLink>
        </SectionLabel>
        {lateOrders.length === 0 ? (
          <EmptyNote>Không đơn nào sát/quá hạn giao trong 7 ngày tới.</EmptyNote>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {lateOrders.slice(0, 8).map(({ r, risk }) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center gap-2 px-4 py-2 text-sm"
                >
                  <Badge tone={risk!.level === 'overdue' ? 'red' : 'amber'}>
                    {risk!.level === 'overdue' ? 'Quá hạn' : 'Sát hạn'}
                  </Badge>
                  <span className="font-mono text-xs">{r.code}</span>
                  <span className="min-w-0 flex-1 truncate">{r.customer_name}</span>
                  <span className="text-xs text-zinc-500">
                    Hạn giao {fmtD(r.due_date)}
                    {r.lsx_code && ` · ${r.lsx_code}`}
                    {stageLabel(r.current_stage) && ` · ${stageLabel(r.current_stage)}`}
                  </span>
                  {risk!.reasons.length > 0 && (
                    <span className="text-xs text-red-500">
                      {risk!.reasons.join(' · ')}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {lateOrders.length > 8 && (
              <p className="border-t border-zinc-100 px-4 py-2 text-xs text-zinc-400 dark:border-zinc-800">
                … và {lateOrders.length - 8} đơn khác — xem Theo dõi đơn hàng.
              </p>
            )}
          </div>
        )}
      </section>

      {/* ── Sản xuất ── */}
      <section>
        <SectionLabel>
          Sản xuất — tải việc theo tổ
          <HeaderLink href="/production/progress">Tiến độ chi tiết →</HeaderLink>
        </SectionLabel>
        {workload.length === 0 ? (
          <EmptyNote>Chưa tổ nào được gán công đoạn (Quản trị → Phòng ban).</EmptyNote>
        ) : (
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 sm:grid-cols-4 lg:grid-cols-7 dark:border-zinc-800 dark:bg-zinc-800">
            {workload.map((w) => (
              <Link
                key={w.department_id}
                href={`/production/team?stage=${w.stage}`}
                className="flex flex-col gap-0.5 bg-white px-3 py-2.5 hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800/60"
              >
                <span className="truncate text-xs font-medium">{w.department_name}</span>
                <span className="text-[10px] text-zinc-400">{w.stage_label}</span>
                <span className="text-xs tabular-nums">
                  <span className="text-zinc-400">{w.todo} chờ</span>
                  {' · '}
                  <span
                    className={w.doing ? 'font-medium text-amber-600' : 'text-zinc-400'}
                  >
                    {w.doing} đang
                  </span>
                  {' · '}
                  <span className={w.done ? 'text-green-600' : 'text-zinc-400'}>
                    {w.done} xong
                  </span>
                </span>
              </Link>
            ))}
          </div>
        )}

        {openIncidents.length > 0 && (
          <div className="mt-3 overflow-hidden rounded-xl border border-red-200 bg-red-50/40 dark:border-red-900/50 dark:bg-red-950/20">
            <div className="flex items-center justify-between border-b border-red-200 px-4 py-2 dark:border-red-900/50">
              <h3 className="text-xs font-semibold tracking-wider text-red-700 uppercase dark:text-red-400">
                ⚠ Sự cố đang mở ({openIncidents.length})
              </h3>
              <Link
                href="/production/progress"
                className="text-xs text-red-600 hover:underline dark:text-red-400"
              >
                Xử lý →
              </Link>
            </div>
            <ul className="divide-y divide-red-100 dark:divide-red-950">
              {openIncidents.slice(0, 5).map((inc) => (
                <li key={inc.id} className="px-4 py-2 text-sm">
                  <span className="font-medium">{inc.message}</span>
                  <span className="ml-2 text-xs text-zinc-500">
                    {[inc.lsx_code, inc.department_name, inc.reported_by_name]
                      .filter(Boolean)
                      .join(' · ')}{' '}
                    · {fmtT(inc.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* ── Mua hàng & kho ── */}
      <section>
        <SectionLabel>Mua hàng &amp; kho</SectionLabel>
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-2 dark:border-zinc-800">
              <h3 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
                PO quá hẹn giao ({latePos.length})
              </h3>
              <HeaderLink href="/planning/pos">Đơn đặt vật tư →</HeaderLink>
            </div>
            {latePos.length === 0 ? (
              <p className="px-4 py-3 text-xs text-zinc-400">Không PO nào quá hẹn.</p>
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {latePos.slice(0, 5).map((p) => (
                  <li key={p.id} className="flex items-center gap-2 px-4 py-2 text-sm">
                    <span className="font-mono text-xs">{p.code}</span>
                    <span className="min-w-0 flex-1 truncate">{p.supplier_name}</span>
                    <span className="text-xs text-red-500">
                      hẹn {fmtD(p.expected_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-2 dark:border-zinc-800">
              <h3 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
                Vật tư dưới tồn tối thiểu ({lowStock.length})
              </h3>
              <HeaderLink href="/warehouse/stock">Tồn kho →</HeaderLink>
            </div>
            {lowStock.length === 0 ? (
              <p className="px-4 py-3 text-xs text-zinc-400">Tồn kho an toàn.</p>
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {lowStock.slice(0, 5).map((s) => (
                  <li
                    key={s.material_id}
                    className="flex items-center gap-2 px-4 py-2 text-sm"
                  >
                    <span className="font-mono text-xs">{s.code}</span>
                    <span className="min-w-0 flex-1 truncate">{s.name}</span>
                    <span className="text-xs text-amber-600">
                      {Number(s.on_hand).toLocaleString('vi-VN')}/
                      {Number(s.min_stock).toLocaleString('vi-VN')} {s.unit}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* ── Truy cập nhanh ── */}
      <section>
        <SectionLabel>Truy cập nhanh</SectionLabel>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickLink
            href="/production/progress"
            title="Tiến độ sản xuất"
            desc="Điều phối LSX, sự cố, tải việc theo tổ"
          />
          <QuickLink
            href="/production/board"
            title="Bảng tổng tiến độ"
            desc="Mọi chi tiết × công đoạn + xuất CSV"
          />
          <QuickLink
            href="/production/logbook"
            title="Sổ sản lượng"
            desc="Sổ toàn xưởng theo ngày, chốt sổ theo tổ"
          />
          <QuickLink
            href="/production/team"
            title="Việc của tổ"
            desc="Bảng Kanban từng tổ (chọn công đoạn)"
          />
        </div>
      </section>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 flex items-center justify-between text-xs font-semibold tracking-wide text-zinc-500 uppercase">
      {children}
    </h2>
  )
}

function HeaderLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-xs font-medium tracking-normal text-sky-600 normal-case hover:underline dark:text-sky-400"
    >
      {children}
    </Link>
  )
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900">
      {children}
    </p>
  )
}

const BIG_TONE = {
  amber: 'bg-amber-500',
  gray: 'bg-zinc-300 dark:bg-zinc-700',
} as const

function BigAction({
  tone,
  value,
  label,
  sub,
  href,
}: {
  tone: keyof typeof BIG_TONE
  value: number
  label: string
  sub: string
  href: string
}) {
  return (
    <Link
      href={href}
      className="relative flex items-center gap-4 overflow-hidden rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${BIG_TONE[tone]}`} />
      <span className="text-3xl font-bold tabular-nums">{value}</span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block truncate text-xs text-zinc-400">{sub}</span>
      </span>
      <span className="ml-auto text-xs font-semibold text-sky-600 dark:text-sky-400">
        Duyệt →
      </span>
    </Link>
  )
}

function QuickLink({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link
      href={href}
      className="block rounded-xl border border-zinc-200 bg-white p-4 hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
    >
      <div className="font-medium">{title}</div>
      <div className="mt-1 text-xs text-zinc-500">{desc}</div>
    </Link>
  )
}
