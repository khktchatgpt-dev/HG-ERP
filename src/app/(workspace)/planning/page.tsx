import { authService } from '@/modules/core/auth/auth.service'
import { posService } from '@/modules/dept/supply/pos.service'
import { suppliersService } from '@/modules/dept/supply/suppliers.service'
import { productionService } from '@/modules/dept/production/production.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { stockRepo } from '@/modules/dept/warehouse/stock.repo'
import { assessLateRisk, assessPoLate } from '@/lib/late-risk'
import type { PoStatus } from '@/modules/dept/supply/pos.schema'

export default async function PlanningHomePage() {
  const user = (await authService.currentUser())!
  const today = new Date().toISOString().slice(0, 10)

  const [pending, approved, suppliers, producing, tracking, allPos, lowStock] =
    await Promise.all([
      posService.list(user, { status: 'pending_approval', page: 1, page_size: 1 }),
      posService.list(user, { status: 'approved', page: 1, page_size: 1 }),
      suppliersService.list(user, { active_only: true, page: 1, page_size: 1 }),
      productionService.list(user, { status: 'in_progress', page: 1, page_size: 1 }),
      productionRepo.listTracking(),
      posService.list(user, { page: 1, page_size: 500 }),
      stockRepo.list({ low_only: true }),
    ])

  const lateRisk = tracking.filter((r) => assessLateRisk(r, today)).length
  const poLate = allPos.rows.filter((p) => assessPoLate(p, today) === 'overdue').length
  const countBy = (s: PoStatus) => allPos.rows.filter((p) => p.status === s).length
  const inFlight =
    countBy('pending_approval') +
    countBy('approved') +
    countBy('ordered') +
    countBy('confirmed') +
    countBy('in_transit') +
    countBy('partial')

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-lg font-semibold">Bảng điều phối Cung ứng</h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Chào {user.name ?? user.email} · {inFlight} PO đang chạy
        </p>
      </div>

      {/* ── Cần xử lý ngay ── */}
      <section>
        <SectionLabel>Cần xử lý ngay</SectionLabel>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ActionCard
            tone="red"
            icon="⚠"
            value={poLate}
            label="PO quá hẹn giao"
            sub="NCC trễ — cần nhắc"
            action="Xem đơn trễ"
            href="/planning/pos"
          />
          <ActionCard
            tone="amber"
            icon="◷"
            value={pending.total}
            label="PO chờ GĐ duyệt"
            sub="Duyệt xong mới gửi NCC"
            action="Xem hàng đợi"
            href="/planning/pos"
          />
          <ActionCard
            tone="violet"
            icon="✈"
            value={approved.total}
            label="Đã duyệt · chưa gửi NCC"
            sub="Sẵn sàng phát đơn"
            action="Gửi NCC"
            href="/planning/pos"
          />
          <ActionCard
            tone="blue"
            icon="▦"
            value={lowStock.length}
            label="Vật tư dưới tồn tối thiểu"
            sub="Nguy cơ thiếu cho LSX"
            action="Tạo PO"
            href="/planning/pos/new"
          />
        </div>
      </section>

      {/* ── Đường ống mua hàng ── */}
      <section>
        <SectionLabel>Đường ống mua hàng</SectionLabel>
        <div className="flex overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <Stage n={countBy('pending_approval')} label="Chờ duyệt" tone="amber" hot />
          <Stage n={countBy('approved')} label="Đã duyệt" tone="violet" />
          <Stage n={countBy('ordered')} label="Đã gửi NCC" tone="blue" />
          <Stage n={countBy('confirmed')} label="NCC xác nhận" tone="blue" />
          <Stage n={countBy('in_transit')} label="Đang giao" tone="blue" />
          <Stage n={countBy('partial')} label="Về một phần" tone="indigo" />
          <Stage n={countBy('received')} label="Về đủ" tone="green" />
        </div>
        <p className="mt-2 text-xs text-zinc-400">
          {lateRisk > 0 ? (
            <span className="text-red-500">
              ⚠ {lateRisk} đơn hàng có nguy cơ trễ — kiểm ở Theo dõi đơn.
            </span>
          ) : (
            'Không có đơn nào nguy cơ trễ.'
          )}
          {' · '}
          {suppliers.total} nhà cung cấp · {producing.total} LSX đang sản xuất.
        </p>
      </section>

      {/* ── Truy cập nhanh ── */}
      <section>
        <SectionLabel>Truy cập nhanh</SectionLabel>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <QuickLink
            href="/planning/pos"
            title="Đơn đặt vật tư"
            desc="Tạo PO, gửi duyệt, theo dõi hàng về"
          />
          <QuickLink
            href="/planning/suppliers"
            title="Nhà cung cấp"
            desc="Hồ sơ NCC, lịch sử mua"
          />
          <QuickLink
            href="/planning/production"
            title="Tiến độ sản xuất"
            desc="Cập nhật giai đoạn từng LSX"
          />
          <QuickLink
            href="/planning/tracking"
            title="Theo dõi đơn hàng"
            desc="BOM · vật tư · sản xuất từng đơn"
          />
          <QuickLink
            href="/warehouse/docs"
            title="Phiếu kho"
            desc="Phiếu nhập theo PO, xuất theo LSX"
          />
        </div>
      </section>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
      {children}
    </h2>
  )
}

const CARD_TONE = {
  red: {
    stripe: 'bg-red-500',
    ic: 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400',
    act: 'text-red-600 dark:text-red-400',
  },
  amber: {
    stripe: 'bg-amber-500',
    ic: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
    act: 'text-amber-700 dark:text-amber-400',
  },
  violet: {
    stripe: 'bg-violet-500',
    ic: 'bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-400',
    act: 'text-violet-600 dark:text-violet-400',
  },
  blue: {
    stripe: 'bg-blue-500',
    ic: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
    act: 'text-blue-600 dark:text-blue-400',
  },
} as const

function ActionCard({
  tone,
  icon,
  value,
  label,
  sub,
  action,
  href,
}: {
  tone: keyof typeof CARD_TONE
  icon: string
  value: number
  label: string
  sub: string
  action: string
  href: string
}) {
  const t = CARD_TONE[tone]
  return (
    <a
      href={href}
      className="relative flex flex-col gap-2 overflow-hidden rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${t.stripe}`} />
      <div className="flex items-center justify-between">
        <span className="text-2xl font-bold tabular-nums">{value}</span>
        <span className={`grid h-8 w-8 place-items-center rounded-lg text-base ${t.ic}`}>
          {icon}
        </span>
      </div>
      <div>
        <div className="text-sm font-semibold">{label}</div>
        <div className="text-xs text-zinc-400">{sub}</div>
      </div>
      <span className={`text-xs font-semibold ${t.act}`}>{action} →</span>
    </a>
  )
}

const STAGE_TONE = {
  amber: 'text-amber-600 dark:text-amber-400',
  violet: 'text-violet-600 dark:text-violet-400',
  blue: 'text-blue-600 dark:text-blue-400',
  indigo: 'text-indigo-600 dark:text-indigo-400',
  green: 'text-green-600 dark:text-green-400',
} as const

function Stage({
  n,
  label,
  tone,
  hot,
}: {
  n: number
  label: string
  tone: keyof typeof STAGE_TONE
  hot?: boolean
}) {
  return (
    <a
      href="/planning/pos"
      className={`min-w-[104px] flex-1 border-r border-zinc-100 px-4 py-3 last:border-r-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/40 ${
        hot ? 'bg-amber-50/60 dark:bg-amber-950/20' : ''
      }`}
    >
      <div className={`text-xl font-bold tabular-nums ${STAGE_TONE[tone]}`}>{n}</div>
      <div className="mt-0.5 text-xs font-medium text-zinc-500">{label}</div>
    </a>
  )
}

function QuickLink({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <a
      href={href}
      className="block rounded-xl border border-zinc-200 bg-white p-4 hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
    >
      <div className="font-medium">{title}</div>
      <div className="mt-1 text-xs text-zinc-500">{desc}</div>
    </a>
  )
}
