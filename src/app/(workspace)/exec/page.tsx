import Link from 'next/link'
import { authService } from '@/modules/core/auth/auth.service'
import { opsService } from '@/modules/dept/production/ops.service'
import { Badge } from '@/components/Badge'
import { MiniBarChart } from '@/components/erp/MiniBarChart'
import { ApprovalCardList } from './ApprovalCardList'

/**
 * BÁO CÁO CEO (/exec — trang đích của Giám đốc): tầm nhìn VĨ MÔ hoạt động,
 * quản trị theo NGOẠI LỆ (cảnh báo đỏ trên cùng, hết cháy thì một dòng xanh),
 * duyệt one-tap, mobile-first. Vận hành real-time chi tiết ở Tháp điều hành
 * (/exec/ops). Tài chính/doanh thu: GĐ2 (user chốt 07/2026 — kế toán MISA).
 */
export default async function CeoReportPage() {
  const user = (await authService.currentUser())!
  const d = await opsService.ceoOverview(user)

  const flags = d.red_flags
  const flagCount =
    flags.overdue_orders.length +
    flags.open_incidents.length +
    flags.late_pos.length +
    flags.low_stock.length
  const pendingCount = d.pending.lsx.length + d.pending.pos.length
  const fmtD = (x: string | null) => (x ? new Date(x).toLocaleDateString('vi-VN') : '—')

  const PIPELINE_LABEL: Record<string, string> = {
    confirmed: 'Đã xác nhận',
    lsx_pending: 'Chờ duyệt LSX',
    lsx_issued: 'Đã phát LSX',
    in_production: 'Đang sản xuất',
    completed: 'Hoàn thành',
    delivered: 'Đã giao',
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">Báo cáo CEO</h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Chào {user.name ?? user.email} · {d.key_orders.length} đơn đang chạy ·{' '}
          {pendingCount} phiếu chờ duyệt
        </p>
      </div>

      {/* ── 1. CẢNH BÁO ĐỎ — quản trị theo ngoại lệ ── */}
      {flagCount === 0 ? (
        <p className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-400">
          ✓ Không có cảnh báo — vận hành bình thường.
        </p>
      ) : (
        <section className="overflow-hidden rounded-xl border-2 border-red-300 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20">
          <div className="border-b border-red-200 px-4 py-2 dark:border-red-900/60">
            <h2 className="text-xs font-bold tracking-wider text-red-700 uppercase dark:text-red-400">
              🔴 Cảnh báo cần xử lý ({flagCount})
            </h2>
          </div>
          <ul className="divide-y divide-red-100 dark:divide-red-950">
            {flags.overdue_orders.map((o) => (
              <li key={o.order_id} className="px-4 py-2 text-sm">
                <Link href="/exec/tracking" className="flex flex-wrap items-center gap-2">
                  <Badge tone="red">Quá hạn giao</Badge>
                  <span className="font-mono text-xs">{o.code}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {o.customer_name}
                  </span>
                  <span className="text-xs text-zinc-500">hạn {fmtD(o.due_date)}</span>
                  {o.reasons.length > 0 && (
                    <span className="w-full text-xs text-red-600 sm:w-auto dark:text-red-400">
                      {o.reasons.join(' · ')}
                    </span>
                  )}
                </Link>
              </li>
            ))}
            {flags.open_incidents.map((i) => (
              <li key={i.id} className="px-4 py-2 text-sm">
                <Link href="/exec/ops" className="flex flex-wrap items-center gap-2">
                  <Badge tone="red">Sự cố xưởng</Badge>
                  <span className="min-w-0 flex-1 truncate">{i.message}</span>
                  <span className="text-xs text-zinc-500">{i.department_name}</span>
                </Link>
              </li>
            ))}
            {flags.late_pos.map((p) => (
              <li key={p.id} className="px-4 py-2 text-sm">
                <Link href="/planning/pos" className="flex flex-wrap items-center gap-2">
                  <Badge tone="amber">PO quá hẹn</Badge>
                  <span className="font-mono text-xs">{p.code}</span>
                  <span className="min-w-0 flex-1 truncate">{p.supplier_name}</span>
                  <span className="text-xs text-zinc-500">hẹn {fmtD(p.expected_at)}</span>
                </Link>
              </li>
            ))}
            {flags.low_stock.map((s) => (
              <li key={s.material_id} className="px-4 py-2 text-sm">
                <Link
                  href="/warehouse/stock"
                  className="flex flex-wrap items-center gap-2"
                >
                  <Badge tone="amber">Thiếu vật tư</Badge>
                  <span className="font-mono text-xs">{s.code}</span>
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                  <span className="text-xs text-amber-600">
                    tồn {Number(s.on_hand).toLocaleString('vi-VN')}/
                    {Number(s.min_stock).toLocaleString('vi-VN')} {s.unit}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── 2. Chờ giám đốc quyết — duyệt one-tap ── */}
      <section>
        <SectionLabel>
          Chờ giám đốc quyết ({pendingCount})
          <HeaderLink href="/exec/approvals">Xem tất cả phê duyệt →</HeaderLink>
        </SectionLabel>
        <ApprovalCardList pos={d.pending.pos} lsxs={d.pending.lsx} compact limit={4} />
      </section>

      {/* ── 3. Đơn hàng trọng điểm ── */}
      <section>
        <SectionLabel>
          Đơn hàng trọng điểm ({d.key_orders.length})
          <HeaderLink href="/exec/tracking">Theo dõi đơn →</HeaderLink>
        </SectionLabel>
        {d.key_orders.length === 0 ? (
          <EmptyNote>Không có đơn nào đang trong sản xuất.</EmptyNote>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {d.key_orders.map((o) => (
              <Link
                key={o.order_id}
                href="/exec/tracking"
                className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
              >
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate font-semibold">
                    {o.customer_name}
                  </span>
                  <span className="font-mono text-xs text-zinc-400">{o.code}</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  {o.late_level && (
                    <Badge tone={o.late_level === 'overdue' ? 'red' : 'amber'}>
                      {o.late_level === 'overdue' ? '⚠ Quá hạn' : '⚠ Sát hạn'}
                    </Badge>
                  )}
                  {o.stage_label && <Badge tone="amber">{o.stage_label}</Badge>}
                  <span className="text-zinc-500">Hạn giao {fmtD(o.due_date)}</span>
                  {o.bom_pending > 0 && (
                    <span className="text-red-500">⚑ {o.bom_pending} SP thiếu BOM</span>
                  )}
                  {o.pos_open > 0 && (
                    <span className="text-amber-600">⚑ {o.pos_open} PO chưa về</span>
                  )}
                </div>
                <div>
                  <div className="flex justify-between text-[10px] text-zinc-400">
                    <span>Đồng bộ bộ SP</span>
                    <span className="font-medium tabular-nums">
                      {Math.round(o.pct * 100)}%
                    </span>
                  </div>
                  <div className="mt-0.5 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div
                      className={`h-full rounded-full ${o.late_level === 'overdue' ? 'bg-red-500' : 'bg-sky-600'}`}
                      style={{ width: `${Math.round(o.pct * 100)}%` }}
                    />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ── 4. Biểu đồ hoạt động ── */}
      <section className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="mb-2 text-xs font-semibold tracking-wider text-zinc-500 uppercase">
            Sản lượng xưởng 8 tuần (SL chi tiết ghi sổ)
          </h3>
          <MiniBarChart
            data={d.weekly_output.map((w) => ({
              label: `${w.week_start.slice(8, 10)}/${w.week_start.slice(5, 7)}`,
              value: w.qty,
              hint: `Tuần ${fmtD(w.week_start)}`,
            }))}
            unit="sp"
          />
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="mb-2 text-xs font-semibold tracking-wider text-zinc-500 uppercase">
            Đường ống đơn hàng
          </h3>
          <div className="flex overflow-x-auto">
            {d.pipeline.map((p) => (
              <Link
                key={p.status}
                href="/exec/tracking"
                className="min-w-[96px] flex-1 border-r border-zinc-100 px-3 py-2 last:border-r-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/40"
              >
                <div
                  className={`text-xl font-bold tabular-nums ${p.count > 0 ? 'text-sky-700 dark:text-sky-400' : 'text-zinc-300 dark:text-zinc-700'}`}
                >
                  {p.count}
                </div>
                <div className="mt-0.5 text-xs font-medium text-zinc-500">
                  {PIPELINE_LABEL[p.status] ?? p.status}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. Truy cập nhanh ── */}
      <section>
        <SectionLabel>Truy cập nhanh</SectionLabel>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickLink
            href="/exec/ops"
            title="Tháp điều hành"
            desc="Sơ đồ xưởng, điểm nghẽn WIP, chất lượng"
          />
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
